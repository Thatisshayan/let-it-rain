# Mobile App Phase 1 (Core Inventory) Implementation Plan

> **For agentic workers:** Execute inline, task by task, in the current session. No subagent dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a versioned JSON API to the Next.js app and a new Expo/React Native app that together let a signed-in user browse items, view an item's movement history, adjust stock, and create/edit items from a phone.

**Architecture:** Extract the Prisma/business logic currently inline in the web Server Actions into shared `service.ts` functions; call those from both the existing Server Actions (unchanged behavior) and new `src/app/api/v1/**/route.ts` Route Handlers (JSON in/out, Bearer-JWT auth). The Expo app in `/mobile` is a thin client over that API using React Query.

**Tech Stack:** Next.js 16 Route Handlers, existing Prisma/zod/jose stack, Expo + Expo Router + TypeScript + React Query + expo-secure-store.

---

## Task 1: Bearer token auth helper

**Files:**
- Modify: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/auth.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";
import { verifyBearerToken } from "./auth";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long";
});

function makeRequest(header?: string) {
  return new Request("http://localhost/api/v1/items", {
    headers: header ? { authorization: header } : {},
  });
}

describe("verifyBearerToken", () => {
  it("returns null when there is no Authorization header", async () => {
    expect(await verifyBearerToken(makeRequest())).toBeNull();
  });

  it("returns null for a malformed header", async () => {
    expect(await verifyBearerToken(makeRequest("NotBearer abc"))).toBeNull();
  });

  it("returns null for an invalid token", async () => {
    expect(await verifyBearerToken(makeRequest("Bearer not-a-real-token"))).toBeNull();
  });

  it("returns the session payload for a valid token", async () => {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    const token = await new SignJWT({
      userId: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secret);

    const session = await verifyBearerToken(makeRequest(`Bearer ${token}`));
    expect(session).toEqual({
      userId: "u1",
      email: "a@b.com",
      name: "Ada",
      permissions: ["EDIT_ITEMS"],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/auth.test.ts`
Expected: FAIL — `verifyBearerToken` is not exported from `./auth`.

- [ ] **Step 3: Implement `verifyBearerToken`**

Add to `src/lib/auth.ts` (keep everything else in the file unchanged):

```ts
export async function verifyBearerToken(req: Request): Promise<SessionPayload | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}
```

Also refactor `createSession` to reuse `signSessionToken` instead of duplicating the
signing logic:

```ts
export async function createSession(payload: SessionPayload) {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/auth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "Add bearer-token verification for the mobile API"
```

---

## Task 2: Extract item/movement service functions

**Files:**
- Create: `src/app/(app)/items/service.ts`
- Modify: `src/app/(app)/items/actions.ts`
- Test: `src/app/(app)/items/service.test.ts`

The existing `movementFormSchema`/`itemFormSchema`/`computeMovement`/
`nextWeightedAverageCost` stay as-is and are imported by the new service module. This
task moves the *Prisma calls* out of the Server Actions into functions that take
already-parsed input, so both Server Actions and API routes can call them.

- [ ] **Step 1: Write failing test for `createItem`**

```ts
// src/app/(app)/items/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    movement: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { createItem, updateItem, deleteItem, adjustStock } from "./service";

const session = { userId: "u1", email: "a@b.com", name: "Ada", permissions: ["EDIT_ITEMS", "DELETE_ITEMS", "ADJUST_STOCK"] };

beforeEach(() => vi.clearAllMocks());

describe("createItem", () => {
  it("rejects without EDIT_ITEMS permission", async () => {
    const result = await createItem({ ...session, permissions: [] }, {
      name: "Widget", category: undefined, description: undefined, minStock: 0,
      initialQuantity: 0, customFields: undefined, unitCost: 0, unitPrice: 0,
    });
    expect(result.ok).toBe(false);
  });

  it("creates an item and, when initialQuantity > 0, a RECEIVE movement", async () => {
    (prisma.item.create as any).mockResolvedValue({ id: "item-1" });
    const result = await createItem(session, {
      name: "Widget", category: undefined, description: undefined, minStock: 5,
      initialQuantity: 10, customFields: undefined, unitCost: 2, unitPrice: 5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.itemId).toBe("item-1");
    expect(prisma.movement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemId: "item-1", type: "RECEIVE", delta: 10 }),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/\(app\)/items/service.test.ts`
Expected: FAIL — `./service` module does not exist.

- [ ] **Step 3: Implement `service.ts`**

```ts
// src/app/(app)/items/service.ts
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import type { SessionPayload } from "@/lib/auth";
import { computeMovement, nextWeightedAverageCost } from "./movement";
import { parseCustomFields } from "./schemas";
import type { z } from "zod";
import type { itemFormSchema, createItemFormSchema, movementFormSchema } from "./schemas";

type ItemFormInput = z.infer<typeof itemFormSchema>;
type CreateItemInput = z.infer<typeof createItemFormSchema>;
type MovementInput = z.infer<typeof movementFormSchema>;

type Result<T> = { ok: true } & T | { ok: false; error: string };

export async function createItem(
  session: SessionPayload,
  input: CreateItemInput
): Promise<Result<{ itemId: string }>> {
  if (!hasPermission(session, "EDIT_ITEMS")) {
    return { ok: false, error: "You don't have permission to add items." };
  }

  const { name, category, description, minStock, initialQuantity, customFields, unitCost, unitPrice } = input;

  const item = await prisma.item.create({
    data: {
      name,
      category: category ?? null,
      description: description ?? null,
      minStock,
      quantity: initialQuantity,
      customFields: parseCustomFields(customFields),
      unitCost,
      unitPrice,
    },
  });

  if (initialQuantity > 0) {
    await prisma.movement.create({
      data: {
        itemId: item.id,
        type: "RECEIVE",
        delta: initialQuantity,
        quantityAfter: initialQuantity,
        reason: "Initial stock",
        unitCostAtTime: unitCost,
        userId: session.userId,
      },
    });
  }

  return { ok: true, itemId: item.id };
}

export async function updateItem(
  session: SessionPayload,
  itemId: string,
  input: ItemFormInput
): Promise<Result<Record<string, never>>> {
  if (!hasPermission(session, "EDIT_ITEMS")) {
    return { ok: false, error: "You don't have permission to edit items." };
  }

  const { name, category, description, minStock, customFields, unitCost, unitPrice } = input;

  await prisma.item.update({
    where: { id: itemId, deletedAt: null },
    data: {
      name,
      category: category ?? null,
      description: description ?? null,
      minStock,
      customFields: parseCustomFields(customFields),
      unitCost,
      unitPrice,
    },
  });

  return { ok: true };
}

export async function deleteItem(
  session: SessionPayload,
  itemId: string
): Promise<Result<Record<string, never>>> {
  if (!hasPermission(session, "DELETE_ITEMS")) {
    return { ok: false, error: "You don't have permission to delete items." };
  }

  await prisma.item.update({
    where: { id: itemId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return { ok: true };
}

const MAX_SERIALIZATION_RETRIES = 3;

export async function adjustStock(
  session: SessionPayload,
  itemId: string,
  input: MovementInput
): Promise<Result<Record<string, never>>> {
  if (!hasPermission(session, "ADJUST_STOCK")) {
    return { ok: false, error: "You don't have permission to adjust stock." };
  }

  const reason = input.reason ?? null;

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const item = await tx.item.findUnique({ where: { id: itemId, deletedAt: null } });
          if (!item) return { error: "Item not found." } as const;

          const movement = computeMovement(item.quantity, input);
          if (!movement.ok) return { error: movement.error } as const;

          const currentCost = Number(item.unitCost);
          const isReceive = input.type === "RECEIVE";
          const isSale = input.type === "REMOVE" && input.isSale;
          const receivedCost = isReceive ? (input.unitCost ?? currentCost) : currentCost;
          const newAvgCost = isReceive
            ? nextWeightedAverageCost(item.quantity, currentCost, input.amount, receivedCost)
            : currentCost;

          await tx.item.update({
            where: { id: itemId },
            data: {
              quantity: movement.quantityAfter,
              ...(isReceive ? { unitCost: newAvgCost } : {}),
            },
          });
          await tx.movement.create({
            data: {
              itemId,
              type: input.type,
              delta: movement.delta,
              quantityAfter: movement.quantityAfter,
              reason,
              isSale,
              unitCostAtTime: isReceive ? receivedCost : isSale ? currentCost : null,
              unitPriceAtTime: isSale ? item.unitPrice : null,
              userId: session.userId,
            },
          });

          return { error: undefined } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      if (result.error) return { ok: false, error: result.error };
      return { ok: true };
    } catch (err) {
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!isSerializationFailure || attempt === MAX_SERIALIZATION_RETRIES - 1) {
        throw err;
      }
    }
  }

  return { ok: false, error: "Could not save movement, please try again." };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/\(app\)/items/service.test.ts`
Expected: PASS

- [ ] **Step 5: Rewrite `actions.ts` to call the service (behavior-preserving)**

Replace the bodies of `createItemAction`, `updateItemAction`, `deleteItemAction`,
`adjustStockAction` in `src/app/(app)/items/actions.ts` to call the new service
functions instead of duplicating Prisma calls, keeping `redirect()`/`revalidatePath()`
exactly as before:

```ts
// src/app/(app)/items/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  createItemFormSchema,
  itemFormSchema,
  movementFormSchema,
} from "./schemas";
import { createItem, updateItem, deleteItem, adjustStock } from "./service";

export type ActionState = {
  error?: string;
};

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createItemAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = createItemFormSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    minStock: formData.get("minStock"),
    initialQuantity: formData.get("initialQuantity"),
    customFields: formData.get("customFields"),
    unitCost: formData.get("unitCost"),
    unitPrice: formData.get("unitPrice"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await createItem(session, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/items");
  redirect(`/items/${result.itemId}`);
}

export async function updateItemAction(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = itemFormSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
    minStock: formData.get("minStock"),
    customFields: formData.get("customFields"),
    unitCost: formData.get("unitCost"),
    unitPrice: formData.get("unitPrice"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await updateItem(session, itemId, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  redirect(`/items/${itemId}`);
}

export async function deleteItemAction(itemId: string) {
  const session = await getSession();
  if (!session) redirect("/login");

  const result = await deleteItem(session, itemId);
  if (!result.ok) redirect(`/items/${itemId}?error=forbidden`);

  revalidatePath("/items");
  redirect("/items");
}

export async function adjustStockAction(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = movementFormSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    counted: formData.get("counted"),
    unitCost: formData.get("unitCost"),
    isSale: formData.get("isSale"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await adjustStock(session, itemId, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/items/${itemId}`);
  revalidatePath("/items");
  revalidatePath("/");
  return {};
}
```

- [ ] **Step 6: Run full test suite to confirm no regressions**

Run: `npm test`
Expected: PASS (all existing + new tests)

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/items/service.ts src/app/\(app\)/items/service.test.ts src/app/\(app\)/items/actions.ts
git commit -m "Extract item/movement Prisma logic into a shared service module"
```

---

## Task 3: `POST /api/v1/auth/login`

**Files:**
- Create: `src/app/api/v1/auth/login/route.ts`
- Test: `src/app/api/v1/auth/login/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/v1/auth/login/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn() } }));

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long";
});

function req(body: unknown) {
  return new Request("http://localhost/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/auth/login", () => {
  it("returns 400 for invalid input", async () => {
    const res = await POST(req({ email: "not-an-email", password: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when the user doesn't exist", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    const res = await POST(req({ email: "a@b.com", password: "secret123" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the password is wrong", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1", email: "a@b.com", name: "Ada", passwordHash: "hash", permissions: [], active: true,
    });
    (bcrypt.compare as any).mockResolvedValue(false);
    const res = await POST(req({ email: "a@b.com", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns a token and user on success", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: "u1", email: "a@b.com", name: "Ada", passwordHash: "hash", permissions: ["EDIT_ITEMS"], active: true,
    });
    (bcrypt.compare as any).mockResolvedValue(true);
    const res = await POST(req({ email: "a@b.com", password: "secret123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).toEqual({ id: "u1", email: "a@b.com", name: "Ada", permissions: ["EDIT_ITEMS"] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/v1/auth/login/route.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/v1/auth/login/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSessionToken } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const permissions = user.permissions;
  const token = await signSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    permissions,
  });

  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, permissions },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/v1/auth/login/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/auth/login/route.ts src/app/api/v1/auth/login/route.test.ts
git commit -m "Add POST /api/v1/auth/login"
```

---

## Task 4: `POST /api/v1/auth/logout`

**Files:**
- Create: `src/app/api/v1/auth/logout/route.ts`
- Test: `src/app/api/v1/auth/logout/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/v1/auth/logout/route.test.ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/v1/auth/logout", () => {
  it("returns 200", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/v1/auth/logout/route.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/v1/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/v1/auth/logout/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/auth/logout/route.ts src/app/api/v1/auth/logout/route.test.ts
git commit -m "Add POST /api/v1/auth/logout"
```

---

## Task 5: `GET /api/v1/items` and `POST /api/v1/items`

**Files:**
- Create: `src/app/api/v1/items/route.ts`
- Test: `src/app/api/v1/items/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/v1/items/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: { item: { findMany: vi.fn(), create: vi.fn() }, movement: { create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  return new SignJWT({ userId: "u1", email: "a@b.com", name: "Ada", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("GET /api/v1/items", () => {
  it("returns 401 without a token", async () => {
    const res = await GET(new Request("http://localhost/api/v1/items"));
    expect(res.status).toBe(401);
  });

  it("returns items for an authenticated user", async () => {
    (prisma.item.findMany as any).mockResolvedValue([
      { id: "i1", name: "Widget", category: null, quantity: 3, minStock: 5, unitCost: 1, unitPrice: 2 },
    ]);
    const token = await tokenFor([]);
    const res = await GET(new Request("http://localhost/api/v1/items", {
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });
});

describe("POST /api/v1/items", () => {
  it("returns 403 without EDIT_ITEMS permission", async () => {
    const token = await tokenFor([]);
    const res = await POST(new Request("http://localhost/api/v1/items", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Widget" }),
    }));
    expect(res.status).toBe(403);
  });

  it("creates an item with EDIT_ITEMS permission", async () => {
    (prisma.item.create as any).mockResolvedValue({ id: "i1" });
    const token = await tokenFor(["EDIT_ITEMS"]);
    const res = await POST(new Request("http://localhost/api/v1/items", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Widget" }),
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.itemId).toBe("i1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/v1/items/route.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/v1/items/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBearerToken } from "@/lib/auth";
import { createItemFormSchema } from "@/app/(app)/items/schemas";
import { createItem } from "@/app/(app)/items/service";

export async function GET(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const low = url.searchParams.get("low") === "1";

  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
  });

  const filtered = low ? items.filter((i) => i.quantity < i.minStock) : items;

  return NextResponse.json({
    items: filtered.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      quantity: i.quantity,
      minStock: i.minStock,
      unitCost: Number(i.unitCost),
      unitPrice: Number(i.unitPrice),
      lowStock: i.quantity < i.minStock,
    })),
  });
}

export async function POST(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createItemFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const result = await createItem(session, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ itemId: result.itemId }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/v1/items/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/items/route.ts src/app/api/v1/items/route.test.ts
git commit -m "Add GET and POST /api/v1/items"
```

---

## Task 6: `GET/PATCH/DELETE /api/v1/items/:id`

**Files:**
- Create: `src/app/api/v1/items/[id]/route.ts`
- Test: `src/app/api/v1/items/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/v1/items/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findUnique: vi.fn(), update: vi.fn() },
    movement: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, PATCH, DELETE } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  return new SignJWT({ userId: "u1", email: "a@b.com", name: "Ada", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("GET /api/v1/items/:id", () => {
  it("returns 404 when the item doesn't exist", async () => {
    (prisma.item.findUnique as any).mockResolvedValue(null);
    const token = await tokenFor([]);
    const res = await GET(
      new Request("http://localhost/api/v1/items/i1", { headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns the item and its movements", async () => {
    (prisma.item.findUnique as any).mockResolvedValue({
      id: "i1", name: "Widget", category: null, description: null,
      quantity: 3, minStock: 5, unitCost: 1, unitPrice: 2, customFields: null,
    });
    (prisma.movement.findMany as any).mockResolvedValue([]);
    const token = await tokenFor([]);
    const res = await GET(
      new Request("http://localhost/api/v1/items/i1", { headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.id).toBe("i1");
    expect(body.movements).toEqual([]);
  });
});

describe("DELETE /api/v1/items/:id", () => {
  it("returns 403 without DELETE_ITEMS", async () => {
    const token = await tokenFor([]);
    const res = await DELETE(
      new Request("http://localhost/api/v1/items/i1", { method: "DELETE", headers: { authorization: `Bearer ${token}` } }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "src/app/api/v1/items/\[id\]/route.test.ts"`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/v1/items/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBearerToken } from "@/lib/auth";
import { itemFormSchema } from "@/app/(app)/items/schemas";
import { updateItem, deleteItem } from "@/app/(app)/items/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const item = await prisma.item.findUnique({ where: { id, deletedAt: null } });
  if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

  const movements = await prisma.movement.findMany({
    where: { itemId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { user: { select: { name: true } } },
    take: 20,
  });

  return NextResponse.json({
    item: {
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      minStock: item.minStock,
      unitCost: Number(item.unitCost),
      unitPrice: Number(item.unitPrice),
      customFields: item.customFields,
    },
    movements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      delta: m.delta,
      quantityAfter: m.quantityAfter,
      reason: m.reason,
      isSale: m.isSale,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = itemFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const result = await updateItem(session, id, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const result = await deleteItem(session, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "src/app/api/v1/items/\[id\]/route.test.ts"`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/v1/items/[id]/route.ts" "src/app/api/v1/items/[id]/route.test.ts"
git commit -m "Add GET, PATCH, DELETE /api/v1/items/:id"
```

---

## Task 7: `POST /api/v1/items/:id/movements`

**Files:**
- Create: `src/app/api/v1/items/[id]/movements/route.ts`
- Test: `src/app/api/v1/items/[id]/movements/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/v1/items/[id]/movements/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findUnique: vi.fn(), update: vi.fn() },
    movement: { create: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn({
      item: { findUnique: vi.fn().mockResolvedValue({ id: "i1", quantity: 5, unitCost: 1, unitPrice: 2, deletedAt: null }), update: vi.fn() },
      movement: { create: vi.fn() },
    })),
  },
}));

import { POST } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  return new SignJWT({ userId: "u1", email: "a@b.com", name: "Ada", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("POST /api/v1/items/:id/movements", () => {
  it("returns 403 without ADJUST_STOCK", async () => {
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/items/i1/movements", {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ type: "RECEIVE", amount: 5 }),
      }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 for a valid RECEIVE with ADJUST_STOCK", async () => {
    const token = await tokenFor(["ADJUST_STOCK"]);
    const res = await POST(
      new Request("http://localhost/api/v1/items/i1/movements", {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ type: "RECEIVE", amount: 5 }),
      }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid movement input", async () => {
    const token = await tokenFor(["ADJUST_STOCK"]);
    const res = await POST(
      new Request("http://localhost/api/v1/items/i1/movements", {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ type: "RECEIVE", amount: -5 }),
      }),
      { params: Promise.resolve({ id: "i1" }) }
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "src/app/api/v1/items/\[id\]/movements/route.test.ts"`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/v1/items/[id]/movements/route.ts
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { movementFormSchema } from "@/app/(app)/items/schemas";
import { adjustStock } from "@/app/(app)/items/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = movementFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const result = await adjustStock(session, id, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission")
      ? 403
      : result.error.includes("try again")
        ? 409
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "src/app/api/v1/items/\[id\]/movements/route.test.ts"`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites (existing + new)

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/v1/items/[id]/movements/route.ts" "src/app/api/v1/items/[id]/movements/route.test.ts"
git commit -m "Add POST /api/v1/items/:id/movements"
```

---

## Task 8: Scaffold the Expo app

**Files:**
- Create: `mobile/` (Expo project)
- Create: `mobile/src/api/client.ts`
- Create: `mobile/.env.example`

- [ ] **Step 1: Scaffold the project**

Run from repo root:

```bash
npx create-expo-app@latest mobile --template default
```

- [ ] **Step 2: Add dependencies**

```bash
cd mobile
npx expo install expo-secure-store
npm install @tanstack/react-query
cd ..
```

- [ ] **Step 3: Create the API client**

```ts
// mobile/src/api/client.ts
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "litr_token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "Something went wrong.");
  }
  return body as T;
}
```

- [ ] **Step 4: Create `.env.example`**

```
# mobile/.env.example
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

- [ ] **Step 5: Commit**

```bash
git add mobile package-lock.json
git commit -m "Scaffold Expo mobile app with API client"
```

---

## Task 9: Auth screens and typed API calls

**Files:**
- Create: `mobile/src/api/auth.ts`
- Create: `mobile/src/api/AuthContext.tsx`
- Create: `mobile/app/login.tsx`
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Typed auth API calls**

```ts
// mobile/src/api/auth.ts
import { apiFetch, setToken, clearToken } from "./client";

export type User = { id: string; email: string; name: string; permissions: string[] };

export async function login(email: string, password: string): Promise<User> {
  const { token, user } = await apiFetch<{ token: string; user: User }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  await setToken(token);
  return user;
}

export async function logout(): Promise<void> {
  await apiFetch("/api/v1/auth/logout", { method: "POST" });
  await clearToken();
}
```

- [ ] **Step 2: Auth context**

```tsx
// mobile/src/api/AuthContext.tsx
import { createContext, useContext, useState, type ReactNode } from "react";
import type { User } from "./auth";

type AuthState = {
  user: User | null;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 3: Login screen**

```tsx
// mobile/app/login.tsx
import { useState } from "react";
import { View, TextInput, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { login } from "../src/api/auth";
import { useAuth } from "../src/api/AuthContext";
import { ApiError } from "../src/api/client";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      setUser(user);
      router.replace("/items");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Let It Rain</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign in"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
  button: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 4: Wrap root layout with providers**

```tsx
// mobile/app/_layout.tsx
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../src/api/AuthContext";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `cd mobile && npx expo start`, open in Expo Go, load the login screen, submit
invalid credentials (see inline error), then valid seeded credentials (redirects toward
`/items`, built in Task 10).

- [ ] **Step 6: Commit**

```bash
git add mobile
git commit -m "Add mobile login screen and auth context"
```

---

## Task 10: Items list, item detail, adjust stock, new/edit item screens

**Files:**
- Create: `mobile/src/api/items.ts`
- Create: `mobile/app/items/index.tsx`
- Create: `mobile/app/items/[id]/index.tsx`
- Create: `mobile/app/items/[id]/adjust.tsx`
- Create: `mobile/app/items/new.tsx`
- Create: `mobile/app/items/[id]/edit.tsx`

- [ ] **Step 1: Typed items API calls**

```ts
// mobile/src/api/items.ts
import { apiFetch } from "./client";

export type Item = {
  id: string; name: string; category: string | null;
  quantity: number; minStock: number; unitCost: number; unitPrice: number; lowStock: boolean;
};

export type Movement = {
  id: string; type: "RECEIVE" | "REMOVE" | "ADJUST"; delta: number; quantityAfter: number;
  reason: string | null; isSale: boolean; createdAt: string; user: { name: string };
};

export type ItemDetail = Omit<Item, "lowStock"> & { description: string | null; customFields: unknown };

export async function fetchItems(params: { q?: string; low?: boolean } = {}): Promise<Item[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.low) qs.set("low", "1");
  const { items } = await apiFetch<{ items: Item[] }>(`/api/v1/items?${qs.toString()}`);
  return items;
}

export async function fetchItem(id: string): Promise<{ item: ItemDetail; movements: Movement[] }> {
  return apiFetch(`/api/v1/items/${id}`);
}

export async function createItem(input: {
  name: string; category?: string; description?: string; minStock: number;
  initialQuantity: number; unitCost: number; unitPrice: number;
}): Promise<{ itemId: string }> {
  return apiFetch("/api/v1/items", { method: "POST", body: JSON.stringify(input) });
}

export async function updateItem(id: string, input: {
  name: string; category?: string; description?: string; minStock: number;
  unitCost: number; unitPrice: number;
}): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/items/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function adjustStock(id: string, input:
  | { type: "RECEIVE"; amount: number; unitCost?: number; reason?: string }
  | { type: "REMOVE"; amount: number; isSale?: boolean; reason?: string }
  | { type: "ADJUST"; counted: number; reason?: string }
): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/items/${id}/movements`, { method: "POST", body: JSON.stringify(input) });
}
```

- [ ] **Step 2: Items list screen**

```tsx
// mobile/app/items/index.tsx
import { useState } from "react";
import { View, TextInput, FlatList, Text, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { fetchItems } from "../../src/api/items";

export default function ItemsScreen() {
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: ["items", q, lowOnly],
    queryFn: () => fetchItems({ q, low: lowOnly }),
  });

  return (
    <View style={styles.container}>
      <TextInput style={styles.search} placeholder="Search items" value={q} onChangeText={setQ} />
      <Pressable onPress={() => setLowOnly((v) => !v)} style={styles.filterButton}>
        <Text>{lowOnly ? "Showing low stock only" : "Show all"}</Text>
      </Pressable>
      {isLoading ? <Text>Loading...</Text> : null}
      {error ? (
        <View>
          <Text style={styles.error}>Could not load items.</Text>
          <Pressable onPress={() => refetch()}><Text>Retry</Text></Pressable>
        </View>
      ) : null}
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/items/${item.id}`)}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={item.lowStock ? styles.lowStock : undefined}>
              {item.quantity} in stock
            </Text>
          </Pressable>
        )}
      />
      <Pressable style={styles.addButton} onPress={() => router.push("/items/new")}>
        <Text style={styles.addButtonText}>+ New item</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  search: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  filterButton: { padding: 8 },
  error: { color: "#c00" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  rowName: { fontWeight: "500" },
  lowStock: { color: "#c00", fontWeight: "600" },
  addButton: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  addButtonText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 3: Item detail screen**

```tsx
// mobile/app/items/[id]/index.tsx
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { fetchItem } from "../../../src/api/items";

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["item", id],
    queryFn: () => fetchItem(id),
  });

  if (isLoading) return <Text style={styles.padded}>Loading...</Text>;
  if (error || !data) return <Text style={[styles.padded, styles.error]}>Could not load item.</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{data.item.name}</Text>
      <Text>{data.item.quantity} in stock (min {data.item.minStock})</Text>
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => router.push(`/items/${id}/adjust`)}>
          <Text style={styles.buttonText}>Adjust stock</Text>
        </Pressable>
        <Pressable style={styles.buttonSecondary} onPress={() => router.push(`/items/${id}/edit`)}>
          <Text>Edit item</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionTitle}>Movement history</Text>
      <FlatList
        data={data.movements}
        keyExtractor={(m) => m.id}
        renderItem={({ item: m }) => (
          <View style={styles.movementRow}>
            <Text>{m.type} {m.delta > 0 ? "+" : ""}{m.delta} -> {m.quantityAfter}</Text>
            <Text style={styles.movementMeta}>{m.user.name} · {new Date(m.createdAt).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  padded: { padding: 16 },
  error: { color: "#c00" },
  title: { fontSize: 22, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, marginVertical: 12 },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonSecondary: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  sectionTitle: { fontWeight: "600", marginTop: 8 },
  movementRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: "#eee" },
  movementMeta: { color: "#666", fontSize: 12 },
});
```

- [ ] **Step 4: Adjust stock screen**

```tsx
// mobile/app/items/[id]/adjust.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { adjustStock } from "../../../src/api/items";
import { ApiError } from "../../../src/api/client";

const TYPES = ["RECEIVE", "REMOVE", "ADJUST"] as const;

export default function AdjustStockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [type, setType] = useState<(typeof TYPES)[number]>("RECEIVE");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  async function onSubmit() {
    setError(null);
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) {
      setError("Enter a valid number.");
      return;
    }
    setSubmitting(true);
    try {
      if (type === "ADJUST") {
        await adjustStock(id, { type: "ADJUST", counted: numeric, reason: reason || undefined });
      } else {
        await adjustStock(id, { type, amount: numeric, reason: reason || undefined });
      }
      await queryClient.invalidateQueries({ queryKey: ["item", id] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.typeRow}>
        {TYPES.map((t) => (
          <Pressable
            key={t}
            style={[styles.typeButton, type === t && styles.typeButtonActive]}
            onPress={() => setType(t)}
          >
            <Text style={type === t ? styles.typeTextActive : undefined}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder={type === "ADJUST" ? "Counted quantity" : "Amount"}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />
      <TextInput style={styles.input} placeholder="Reason (optional)" value={reason} onChangeText={setReason} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.submit} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? "Saving..." : "Save"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeButton: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  typeButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  typeTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
  submit: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 5: New item screen**

```tsx
// mobile/app/items/new.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { createItem } from "../../src/api/items";
import { ApiError } from "../../src/api/client";

export default function NewItemScreen() {
  const [name, setName] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const { itemId } = await createItem({
        name,
        minStock: Number(minStock) || 0,
        initialQuantity: Number(initialQuantity) || 0,
        unitCost: Number(unitCost) || 0,
        unitPrice: Number(unitPrice) || 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      router.replace(`/items/${itemId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Item name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Min stock" keyboardType="numeric" value={minStock} onChangeText={setMinStock} />
      <TextInput style={styles.input} placeholder="Initial quantity" keyboardType="numeric" value={initialQuantity} onChangeText={setInitialQuantity} />
      <TextInput style={styles.input} placeholder="Unit cost" keyboardType="numeric" value={unitCost} onChangeText={setUnitCost} />
      <TextInput style={styles.input} placeholder="Unit price" keyboardType="numeric" value={unitPrice} onChangeText={setUnitPrice} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.submit} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? "Saving..." : "Create item"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
  submit: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 6: Edit item screen**

```tsx
// mobile/app/items/[id]/edit.tsx
import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchItem, updateItem } from "../../../src/api/items";
import { ApiError } from "../../../src/api/client";

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useQuery({ queryKey: ["item", id], queryFn: () => fetchItem(id) });
  const [name, setName] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [unitPrice, setUnitPrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!data) return;
    setName(data.item.name);
    setMinStock(String(data.item.minStock));
    setUnitCost(String(data.item.unitCost));
    setUnitPrice(String(data.item.unitPrice));
  }, [data]);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await updateItem(id, {
        name,
        minStock: Number(minStock) || 0,
        unitCost: Number(unitCost) || 0,
        unitPrice: Number(unitPrice) || 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["item", id] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Item name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Min stock" keyboardType="numeric" value={minStock} onChangeText={setMinStock} />
      <TextInput style={styles.input} placeholder="Unit cost" keyboardType="numeric" value={unitCost} onChangeText={setUnitCost} />
      <TextInput style={styles.input} placeholder="Unit price" keyboardType="numeric" value={unitPrice} onChangeText={setUnitPrice} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.submit} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? "Saving..." : "Save changes"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
  submit: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 7: Manual end-to-end verification**

Run `npm run dev` in the repo root and `cd mobile && npx expo start` in a second
terminal (set `EXPO_PUBLIC_API_BASE_URL` to the machine's LAN IP if testing on a physical
device via Expo Go, since `localhost` won't resolve to the dev machine from the phone).
Walk through: login → items list (search, low-stock toggle) → item detail → adjust stock
→ confirm the change appears in both the mobile app and the existing web UI (same
database) → create a new item → edit an item.

- [ ] **Step 8: Commit**

```bash
git add mobile
git commit -m "Add items list, detail, adjust-stock, and new/edit item screens"
```

---

## Self-Review Notes

- **Spec coverage:** login/logout (Tasks 3–4, 9), items list+search+low-stock (Task 5,
  10), item detail+movement history (Task 6, 10), create/edit item (Task 5/6, 10),
  adjust stock with retry-on-conflict preserved (Task 2/7, 10), Bearer JWT auth reusing
  existing secret (Task 1, 3), Expo Go dev workflow (Task 8, 10) — all covered. Settings,
  permissions UI, calendar, accounting reports are explicitly out of scope per the spec.
- **Type consistency:** `Result<T>` / `{ ok: boolean }` shape used consistently across
  `service.ts` and all route handlers; `Item`/`ItemDetail`/`Movement` types in
  `mobile/src/api/items.ts` match the JSON shapes returned by the Task 5/6 routes.
