# Mobile App Phase 2 (Settings & User Management) Implementation Plan

> **For agentic workers:** Execute inline, task by task, in the current session. No subagent dispatch. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/api/v1/users*` and `/api/v1/account*` JSON endpoints and mobile Settings/Users/Account screens so an admin can manage users and any user can manage their own profile from the phone.

**Architecture:** Extract the Prisma logic from `src/app/(app)/settings/actions.ts` into `src/app/(app)/settings/service.ts` (same pattern as `items/service.ts`), call it from both the existing Server Actions and new Route Handlers. Mobile adds a Settings tab consuming those endpoints.

**Tech Stack:** Same as Phase 1 — Next.js Route Handlers, existing zod/bcrypt/jose stack, Expo Router + React Query.

---

## Task 1: Extract settings service functions

**Files:**
- Create: `src/app/(app)/settings/service.ts`
- Modify: `src/app/(app)/settings/actions.ts`
- Test: `src/app/(app)/settings/service.test.ts`

- [ ] **Step 1: Write failing tests covering permission checks and self-protection guards**

```ts
// src/app/(app)/settings/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => true),
}));

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createUser,
  updateUserPermissions,
  setUserActive,
  resetUserPassword,
  updateOwnProfile,
  changeOwnPassword,
} from "./service";

const admin = {
  userId: "admin-1",
  email: "admin@x.com",
  name: "Admin",
  permissions: ["MANAGE_USERS"],
};

beforeEach(() => vi.clearAllMocks());

describe("createUser", () => {
  it("rejects without MANAGE_USERS", async () => {
    const result = await createUser(
      { ...admin, permissions: [] },
      { name: "Bob", email: "bob@x.com", password: "password1", permissions: [] }
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a duplicate email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "existing" });
    const result = await createUser(admin, {
      name: "Bob", email: "bob@x.com", password: "password1", permissions: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already exists/);
  });

  it("creates a user with a hashed password", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: "u2" });
    const result = await createUser(admin, {
      name: "Bob", email: "bob@x.com", password: "password1", permissions: ["EDIT_ITEMS"],
    });
    expect(result.ok).toBe(true);
    expect(hashPassword).toHaveBeenCalledWith("password1");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { name: "Bob", email: "bob@x.com", passwordHash: "hashed:password1", permissions: ["EDIT_ITEMS"] },
    });
  });
});

describe("updateUserPermissions", () => {
  it("rejects without MANAGE_USERS", async () => {
    const result = await updateUserPermissions({ ...admin, permissions: [] }, "u2", { permissions: [] });
    expect(result.ok).toBe(false);
  });

  it("blocks removing your own MANAGE_USERS permission", async () => {
    const result = await updateUserPermissions(admin, "admin-1", { permissions: ["EDIT_ITEMS"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/remove your own/);
  });

  it("allows updating someone else's permissions", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    const result = await updateUserPermissions(admin, "u2", { permissions: ["EDIT_ITEMS"] });
    expect(result.ok).toBe(true);
  });
});

describe("setUserActive", () => {
  it("blocks deactivating yourself", async () => {
    const result = await setUserActive(admin, "admin-1", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/deactivate your own/);
  });

  it("allows deactivating someone else", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    const result = await setUserActive(admin, "u2", false);
    expect(result.ok).toBe(true);
  });
});

describe("resetUserPassword", () => {
  it("rejects without MANAGE_USERS", async () => {
    const result = await resetUserPassword({ ...admin, permissions: [] }, "u2", { password: "newpassword1" });
    expect(result.ok).toBe(false);
  });

  it("hashes and sets the new password", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    const result = await resetUserPassword(admin, "u2", { password: "newpassword1" });
    expect(result.ok).toBe(true);
    expect(hashPassword).toHaveBeenCalledWith("newpassword1");
  });
});

describe("updateOwnProfile", () => {
  it("updates the caller's own name", async () => {
    (prisma.user.update as any).mockResolvedValue({});
    const result = await updateOwnProfile(admin, { name: "New Name" });
    expect(result.ok).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: { name: "New Name" },
    });
  });
});

describe("changeOwnPassword", () => {
  it("rejects when current password is wrong", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "admin-1", passwordHash: "h" });
    (verifyPassword as any).mockResolvedValue(false);
    const result = await changeOwnPassword(admin, { currentPassword: "wrong", newPassword: "newpassword1" });
    expect(result.ok).toBe(false);
  });

  it("updates the password when current password is correct", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "admin-1", passwordHash: "h" });
    (verifyPassword as any).mockResolvedValue(true);
    (prisma.user.update as any).mockResolvedValue({});
    const result = await changeOwnPassword(admin, { currentPassword: "right", newPassword: "newpassword1" });
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "src/app/(app)/settings/service.test.ts"`
Expected: FAIL — `./service` module does not exist.

- [ ] **Step 3: Implement `service.ts`**

```ts
// src/app/(app)/settings/service.ts
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { SessionPayload } from "@/lib/auth";
import type { z } from "zod";
import type {
  createUserFormSchema,
  updatePermissionsFormSchema,
  resetPasswordFormSchema,
  updateOwnProfileFormSchema,
  changeOwnPasswordFormSchema,
} from "./schemas";

type CreateUserInput = z.infer<typeof createUserFormSchema>;
type UpdatePermissionsInput = z.infer<typeof updatePermissionsFormSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordFormSchema>;
type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileFormSchema>;
type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordFormSchema>;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function createUser(
  session: SessionPayload,
  input: CreateUserInput
): Promise<Result<{ userId: string }>> {
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { ok: false, error: "You don't have permission to manage users." };
  }

  const { name, email, password, permissions } = input;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "A user with that email already exists." };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, permissions },
  });

  return { ok: true, userId: user.id };
}

export async function updateUserPermissions(
  session: SessionPayload,
  userId: string,
  input: UpdatePermissionsInput
): Promise<Result> {
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { ok: false, error: "You don't have permission to manage users." };
  }

  if (userId === session.userId && !input.permissions.includes("MANAGE_USERS")) {
    return { ok: false, error: "You can't remove your own ability to manage users." };
  }

  await prisma.user.update({ where: { id: userId }, data: { permissions: input.permissions } });
  return { ok: true };
}

export async function setUserActive(
  session: SessionPayload,
  userId: string,
  active: boolean
): Promise<Result> {
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { ok: false, error: "You don't have permission to manage users." };
  }
  if (userId === session.userId && !active) {
    return { ok: false, error: "You can't deactivate your own account." };
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  return { ok: true };
}

export async function resetUserPassword(
  session: SessionPayload,
  userId: string,
  input: ResetPasswordInput
): Promise<Result> {
  if (!hasPermission(session, "MANAGE_USERS")) {
    return { ok: false, error: "You don't have permission to manage users." };
  }

  const passwordHash = await hashPassword(input.password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { ok: true };
}

export async function updateOwnProfile(
  session: SessionPayload,
  input: UpdateOwnProfileInput
): Promise<Result> {
  await prisma.user.update({ where: { id: session.userId }, data: { name: input.name } });
  return { ok: true };
}

export async function changeOwnPassword(
  session: SessionPayload,
  input: ChangeOwnPasswordInput
): Promise<Result> {
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { ok: false, error: "User not found." };

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({ where: { id: session.userId }, data: { passwordHash } });
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "src/app/(app)/settings/service.test.ts"`
Expected: PASS (12 tests)

- [ ] **Step 5: Rewrite `actions.ts` to call the service (behavior-preserving)**

```ts
// src/app/(app)/settings/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  createUserFormSchema,
  updatePermissionsFormSchema,
  resetPasswordFormSchema,
  updateOwnProfileFormSchema,
  changeOwnPasswordFormSchema,
} from "./schemas";
import {
  createUser,
  updateUserPermissions,
  setUserActive,
  resetUserPassword,
  updateOwnProfile,
  changeOwnPassword,
} from "./service";

export type ActionState = {
  error?: string;
  success?: string;
};

function firstIssueMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function createUserAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = createUserFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await createUser(session, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  return { success: `Created ${parsed.data.name}.` };
}

export async function updateUserPermissionsAction(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = updatePermissionsFormSchema.safeParse({
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await updateUserPermissions(session, userId, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  return { success: "Permissions updated." };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const result = await setUserActive(session, userId, active);
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  return {};
}

export async function resetUserPasswordAction(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = resetPasswordFormSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await resetUserPassword(session, userId, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  return { success: "Password reset. Share the new password with them directly." };
}

export async function updateOwnProfileAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = updateOwnProfileFormSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await updateOwnProfile(session, parsed.data);
  if (!result.ok) return { error: result.error };

  revalidatePath("/settings");
  return { success: "Profile updated. Sign out and back in to see your new name everywhere." };
}

export async function changeOwnPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = changeOwnPasswordFormSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const result = await changeOwnPassword(session, parsed.data);
  if (!result.ok) return { error: result.error };

  return { success: "Password changed." };
}
```

- [ ] **Step 6: Run full test suite to confirm no regressions**

Run: `npm test`
Expected: PASS (all existing + new tests)

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/settings/service.ts src/app/\(app\)/settings/service.test.ts src/app/\(app\)/settings/actions.ts
git commit -m "Extract settings/user-management Prisma logic into a shared service module"
```

---

## Task 2: `GET/POST /api/v1/users`

**Files:**
- Create: `src/app/api/v1/users/route.ts`
- Test: `src/app/api/v1/users/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/v1/users/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => true),
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  return new SignJWT({ userId: "admin-1", email: "admin@x.com", name: "Admin", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("GET /api/v1/users", () => {
  it("returns 403 without MANAGE_USERS", async () => {
    const token = await tokenFor([]);
    const res = await GET(new Request("http://localhost/api/v1/users", { headers: { authorization: `Bearer ${token}` } }));
    expect(res.status).toBe(403);
  });

  it("returns users with MANAGE_USERS", async () => {
    (prisma.user.findMany as any).mockResolvedValue([
      { id: "u1", name: "Ada", email: "ada@x.com", permissions: ["EDIT_ITEMS"], active: true },
    ]);
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await GET(new Request("http://localhost/api/v1/users", { headers: { authorization: `Bearer ${token}` } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(1);
  });
});

describe("POST /api/v1/users", () => {
  it("returns 403 without MANAGE_USERS", async () => {
    const token = await tokenFor([]);
    const res = await POST(new Request("http://localhost/api/v1/users", {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Bob", email: "bob@x.com", password: "password1", permissions: [] }),
    }));
    expect(res.status).toBe(403);
  });

  it("creates a user with MANAGE_USERS", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({ id: "u2" });
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await POST(new Request("http://localhost/api/v1/users", {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Bob", email: "bob@x.com", password: "password1", permissions: [] }),
    }));
    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/v1/users/route.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/v1/users/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBearerToken } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createUserFormSchema } from "@/app/(app)/settings/schemas";
import { createUser } from "@/app/(app)/settings/service";

export async function GET(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!hasPermission(session, "MANAGE_USERS")) {
    return NextResponse.json({ error: "You don't have permission to manage users." }, { status: 403 });
  }

  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      permissions: u.permissions,
      active: u.active,
    })),
  });
}

export async function POST(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createUserFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const result = await createUser(session, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ userId: result.userId }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/v1/users/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/v1/users/route.ts src/app/api/v1/users/route.test.ts
git commit -m "Add GET and POST /api/v1/users"
```

---

## Task 3: `PATCH /api/v1/users/:id/permissions` and `PATCH /api/v1/users/:id/active`

**Files:**
- Create: `src/app/api/v1/users/[id]/permissions/route.ts`
- Create: `src/app/api/v1/users/[id]/active/route.ts`
- Test: `src/app/api/v1/users/[id]/permissions/route.test.ts`
- Test: `src/app/api/v1/users/[id]/active/route.test.ts`

- [ ] **Step 1: Write failing test for permissions route**

```ts
// src/app/api/v1/users/[id]/permissions/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));

import { PATCH } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  return new SignJWT({ userId: "admin-1", email: "admin@x.com", name: "Admin", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("PATCH /api/v1/users/:id/permissions", () => {
  it("returns 400 when removing your own MANAGE_USERS permission", async () => {
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await PATCH(
      new Request("http://localhost/api/v1/users/admin-1/permissions", {
        method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ permissions: ["EDIT_ITEMS"] }),
      }),
      { params: Promise.resolve({ id: "admin-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 for updating someone else's permissions", async () => {
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await PATCH(
      new Request("http://localhost/api/v1/users/u2/permissions", {
        method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ permissions: ["EDIT_ITEMS"] }),
      }),
      { params: Promise.resolve({ id: "u2" }) }
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "src/app/api/v1/users/\[id\]/permissions/route.test.ts"`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement permissions route**

```ts
// src/app/api/v1/users/[id]/permissions/route.ts
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { updatePermissionsFormSchema } from "@/app/(app)/settings/schemas";
import { updateUserPermissions } from "@/app/(app)/settings/service";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updatePermissionsFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const result = await updateUserPermissions(session, id, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission to manage") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "src/app/api/v1/users/\[id\]/permissions/route.test.ts"`
Expected: PASS (2 tests)

- [ ] **Step 5: Write failing test for active route**

```ts
// src/app/api/v1/users/[id]/active/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));

import { PATCH } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  return new SignJWT({ userId: "admin-1", email: "admin@x.com", name: "Admin", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("PATCH /api/v1/users/:id/active", () => {
  it("returns 400 when deactivating yourself", async () => {
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await PATCH(
      new Request("http://localhost/api/v1/users/admin-1/active", {
        method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: "admin-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 for deactivating someone else", async () => {
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await PATCH(
      new Request("http://localhost/api/v1/users/u2/active", {
        method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: "u2" }) }
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- "src/app/api/v1/users/\[id\]/active/route.test.ts"`
Expected: FAIL — route file does not exist.

- [ ] **Step 7: Implement active route**

```ts
// src/app/api/v1/users/[id]/active/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearerToken } from "@/lib/auth";
import { setUserActive } from "@/app/(app)/settings/service";

type Ctx = { params: Promise<{ id: string }> };

const activeSchema = z.object({ active: z.boolean() });

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = activeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const result = await setUserActive(session, id, parsed.data.active);
  if (!result.ok) {
    const status = result.error.includes("permission to manage") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- "src/app/api/v1/users/\[id\]/active/route.test.ts"`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add "src/app/api/v1/users/[id]/permissions" "src/app/api/v1/users/[id]/active"
git commit -m "Add PATCH /api/v1/users/:id/permissions and /active"
```

---

## Task 4: `POST /api/v1/users/:id/reset-password`

**Files:**
- Create: `src/app/api/v1/users/[id]/reset-password/route.ts`
- Test: `src/app/api/v1/users/[id]/reset-password/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/app/api/v1/users/[id]/reset-password/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => true),
}));

import { POST } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function tokenFor(permissions: string[]) {
  return new SignJWT({ userId: "admin-1", email: "admin@x.com", name: "Admin", permissions })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("POST /api/v1/users/:id/reset-password", () => {
  it("returns 403 without MANAGE_USERS", async () => {
    const token = await tokenFor([]);
    const res = await POST(
      new Request("http://localhost/api/v1/users/u2/reset-password", {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ password: "newpassword1" }),
      }),
      { params: Promise.resolve({ id: "u2" }) }
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with MANAGE_USERS", async () => {
    const token = await tokenFor(["MANAGE_USERS"]);
    const res = await POST(
      new Request("http://localhost/api/v1/users/u2/reset-password", {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ password: "newpassword1" }),
      }),
      { params: Promise.resolve({ id: "u2" }) }
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "src/app/api/v1/users/\[id\]/reset-password/route.test.ts"`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement route**

```ts
// src/app/api/v1/users/[id]/reset-password/route.ts
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { resetPasswordFormSchema } from "@/app/(app)/settings/schemas";
import { resetUserPassword } from "@/app/(app)/settings/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = resetPasswordFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const result = await resetUserPassword(session, id, parsed.data);
  if (!result.ok) {
    const status = result.error.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "src/app/api/v1/users/\[id\]/reset-password/route.test.ts"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/v1/users/[id]/reset-password"
git commit -m "Add POST /api/v1/users/:id/reset-password"
```

---

## Task 5: `PATCH /api/v1/account` and `POST /api/v1/account/password`

**Files:**
- Create: `src/app/api/v1/account/route.ts`
- Create: `src/app/api/v1/account/password/route.ts`
- Test: `src/app/api/v1/account/route.test.ts`
- Test: `src/app/api/v1/account/password/route.test.ts`

- [ ] **Step 1: Write failing test for `PATCH /api/v1/account`**

```ts
// src/app/api/v1/account/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));

import { PATCH } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function token() {
  return new SignJWT({ userId: "u1", email: "a@b.com", name: "Ada", permissions: [] })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("PATCH /api/v1/account", () => {
  it("returns 401 without a token", async () => {
    const res = await PATCH(new Request("http://localhost/api/v1/account", {
      method: "PATCH", body: JSON.stringify({ name: "New Name" }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 200 for a valid name update", async () => {
    const t = await token();
    const res = await PATCH(new Request("http://localhost/api/v1/account", {
      method: "PATCH", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "New Name" }),
    }));
    expect(res.status).toBe(200);
  });

  it("returns 400 for an empty name", async () => {
    const t = await token();
    const res = await PATCH(new Request("http://localhost/api/v1/account", {
      method: "PATCH", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/v1/account/route.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 3: Implement account route**

```ts
// src/app/api/v1/account/route.ts
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { updateOwnProfileFormSchema } from "@/app/(app)/settings/schemas";
import { updateOwnProfile } from "@/app/(app)/settings/service";

export async function PATCH(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateOwnProfileFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const result = await updateOwnProfile(session, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/v1/account/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write failing test for `POST /api/v1/account/password`**

```ts
// src/app/api/v1/account/password/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { POST } from "./route";

const SECRET = "test-secret-at-least-32-chars-long";

async function token() {
  return new SignJWT({ userId: "u1", email: "a@b.com", name: "Ada", permissions: [] })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_SECRET = SECRET;
});

describe("POST /api/v1/account/password", () => {
  it("returns 400 when the current password is wrong", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1", passwordHash: "h" });
    (verifyPassword as any).mockResolvedValue(false);
    const t = await token();
    const res = await POST(new Request("http://localhost/api/v1/account/password", {
      method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: "wrong", newPassword: "newpassword1" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 200 on a valid password change", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "u1", passwordHash: "h" });
    (verifyPassword as any).mockResolvedValue(true);
    const t = await token();
    const res = await POST(new Request("http://localhost/api/v1/account/password", {
      method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: "right", newPassword: "newpassword1" }),
    }));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- src/app/api/v1/account/password/route.test.ts`
Expected: FAIL — route file does not exist.

- [ ] **Step 7: Implement password route**

```ts
// src/app/api/v1/account/password/route.ts
import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/auth";
import { changeOwnPasswordFormSchema } from "@/app/(app)/settings/schemas";
import { changeOwnPassword } from "@/app/(app)/settings/service";

export async function POST(req: Request) {
  const session = await verifyBearerToken(req);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = changeOwnPasswordFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const result = await changeOwnPassword(session, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- src/app/api/v1/account/password/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: PASS, all suites (existing + new)

- [ ] **Step 10: Commit**

```bash
git add src/app/api/v1/account
git commit -m "Add PATCH /api/v1/account and POST /api/v1/account/password"
```

---

## Task 6: Mobile Settings, Users, and Account screens

**Files:**
- Create: `mobile/src/api/settings.ts`
- Create: `mobile/app/settings/index.tsx`
- Create: `mobile/app/settings/users/index.tsx`
- Create: `mobile/app/settings/users/new.tsx`
- Create: `mobile/app/settings/users/[id].tsx`
- Create: `mobile/app/settings/account.tsx`
- Modify: `mobile/app/items/index.tsx` (add a settings link in the header area)

- [ ] **Step 1: Typed settings API calls**

```ts
// mobile/src/api/settings.ts
import { apiFetch } from "./client";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  permissions: string[];
  active: boolean;
};

export async function fetchUsers(): Promise<UserRow[]> {
  const { users } = await apiFetch<{ users: UserRow[] }>("/api/v1/users");
  return users;
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  permissions: string[];
}): Promise<{ userId: string }> {
  return apiFetch("/api/v1/users", { method: "POST", body: JSON.stringify(input) });
}

export async function updateUserPermissions(id: string, permissions: string[]): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/users/${id}/permissions`, {
    method: "PATCH",
    body: JSON.stringify({ permissions }),
  });
}

export async function setUserActive(id: string, active: boolean): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/users/${id}/active`, { method: "PATCH", body: JSON.stringify({ active }) });
}

export async function resetUserPassword(id: string, password: string): Promise<{ ok: true }> {
  return apiFetch(`/api/v1/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function updateOwnProfile(name: string): Promise<{ ok: true }> {
  return apiFetch("/api/v1/account", { method: "PATCH", body: JSON.stringify({ name }) });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  return apiFetch("/api/v1/account/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export const ALL_PERMISSIONS = ["MANAGE_USERS", "DELETE_ITEMS", "EDIT_ITEMS", "ADJUST_STOCK"] as const;
```

- [ ] **Step 2: Settings entry screen**

```tsx
// mobile/app/settings/index.tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../src/api/AuthContext";

export default function SettingsScreen() {
  const { user } = useAuth();
  const canManageUsers = user?.permissions.includes("MANAGE_USERS");

  return (
    <View style={styles.container}>
      {canManageUsers ? (
        <Pressable style={styles.row} onPress={() => router.push("/settings/users")}>
          <Text style={styles.rowText}>Users</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.row} onPress={() => router.push("/settings/account")}>
        <Text style={styles.rowText}>Account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  row: { paddingVertical: 16, borderBottomWidth: 1, borderColor: "#eee" },
  rowText: { fontSize: 16, fontWeight: "500" },
});
```

- [ ] **Step 3: Users list screen**

```tsx
// mobile/app/settings/users/index.tsx
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { fetchUsers } from "../../../src/api/settings";

export default function UsersScreen() {
  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  return (
    <View style={styles.container}>
      {isLoading ? <Text>Loading...</Text> : null}
      {error ? (
        <View>
          <Text style={styles.error}>Could not load users.</Text>
          <Pressable onPress={() => refetch()}><Text>Retry</Text></Pressable>
        </View>
      ) : null}
      <FlatList
        data={users ?? []}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/settings/users/${item.id}`)}>
            <Text style={styles.rowName}>{item.name}</Text>
            <Text style={item.active ? styles.active : styles.inactive}>
              {item.active ? "Active" : "Inactive"}
            </Text>
          </Pressable>
        )}
      />
      <Pressable style={styles.addButton} onPress={() => router.push("/settings/users/new")}>
        <Text style={styles.addButtonText}>+ New user</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  error: { color: "#c00" },
  row: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: 12,
    borderBottomWidth: 1, borderColor: "#eee",
  },
  rowName: { fontWeight: "500" },
  active: { color: "#080" },
  inactive: { color: "#888" },
  addButton: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  addButtonText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 4: New user screen**

```tsx
// mobile/app/settings/users/new.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { createUser, ALL_PERMISSIONS } from "../../../src/api/settings";
import { ApiError } from "../../../src/api/client";

export default function NewUserScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  function togglePermission(p: string) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await createUser({ name, email, password, permissions });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <View style={styles.permissions}>
        {ALL_PERMISSIONS.map((p) => (
          <Pressable
            key={p}
            style={[styles.permButton, permissions.includes(p) && styles.permButtonActive]}
            onPress={() => togglePermission(p)}
          >
            <Text style={permissions.includes(p) ? styles.permTextActive : undefined}>{p}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.submit} onPress={onSubmit} disabled={submitting}>
        <Text style={styles.submitText}>{submitting ? "Creating..." : "Create user"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  permissions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  permButton: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  permButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  permTextActive: { color: "#fff" },
  error: { color: "#c00" },
  submit: { backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 5: User detail screen**

```tsx
// mobile/app/settings/users/[id].tsx
import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUsers,
  updateUserPermissions,
  setUserActive,
  resetUserPassword,
  ALL_PERMISSIONS,
} from "../../../src/api/settings";
import { ApiError } from "../../../src/api/client";
import { useAuth } from "../../../src/api/AuthContext";

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const target = users?.find((u) => u.id === id);

  const [permissions, setPermissions] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (target) setPermissions(target.permissions);
  }, [target]);

  function togglePermission(p: string) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function savePermissions() {
    setError(null);
    setSaving(true);
    try {
      await updateUserPermissions(id, permissions);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!target) return;
    setError(null);
    try {
      await setUserActive(id, !target.active);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    }
  }

  async function submitResetPassword() {
    setError(null);
    try {
      await resetUserPassword(id, newPassword);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    }
  }

  if (!target) return <Text style={styles.padded}>Loading...</Text>;

  const isSelf = target.id === currentUser?.id;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{target.name}</Text>
      <Text>{target.email}</Text>

      <Text style={styles.sectionTitle}>Permissions</Text>
      <View style={styles.permissions}>
        {ALL_PERMISSIONS.map((p) => (
          <Pressable
            key={p}
            style={[styles.permButton, permissions.includes(p) && styles.permButtonActive]}
            onPress={() => togglePermission(p)}
          >
            <Text style={permissions.includes(p) ? styles.permTextActive : undefined}>{p}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.button} onPress={savePermissions} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? "Saving..." : "Save permissions"}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Status</Text>
      <Pressable style={styles.buttonSecondary} onPress={toggleActive} disabled={isSelf && target.active}>
        <Text>{target.active ? "Deactivate" : "Activate"}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Reset password</Text>
      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <Pressable style={styles.buttonSecondary} onPress={submitResetPassword}>
        <Text>Reset password</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  padded: { padding: 16 },
  title: { fontSize: 22, fontWeight: "600" },
  sectionTitle: { fontWeight: "600", marginTop: 12 },
  permissions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  permButton: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#ccc" },
  permButtonActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  permTextActive: { color: "#fff" },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonSecondary: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", alignItems: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
});
```

- [ ] **Step 6: Account screen**

```tsx
// mobile/app/settings/account.tsx
import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { updateOwnProfile, changeOwnPassword } from "../../src/api/settings";
import { ApiError } from "../../src/api/client";
import { useAuth } from "../../src/api/AuthContext";

export default function AccountScreen() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  async function saveName() {
    setNameError(null);
    setNameSuccess(null);
    try {
      await updateOwnProfile(name);
      setNameSuccess("Name updated.");
    } catch (err) {
      setNameError(err instanceof ApiError ? err.message : "Could not update name.");
    }
  }

  async function savePassword() {
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess("Password changed.");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Could not change password.");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      {nameError ? <Text style={styles.error}>{nameError}</Text> : null}
      {nameSuccess ? <Text style={styles.success}>{nameSuccess}</Text> : null}
      <Pressable style={styles.button} onPress={saveName}>
        <Text style={styles.buttonText}>Save name</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Change password</Text>
      <TextInput
        style={styles.input}
        placeholder="Current password"
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
      {passwordSuccess ? <Text style={styles.success}>{passwordSuccess}</Text> : null}
      <Pressable style={styles.button} onPress={savePassword}>
        <Text style={styles.buttonText}>Change password</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  sectionTitle: { fontWeight: "600", marginTop: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
  success: { color: "#080" },
  button: { backgroundColor: "#2563eb", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 7: Add a settings entry point from the items list**

Add a small header link in `mobile/app/items/index.tsx` so Settings is reachable. Insert
right after the opening `<View style={styles.container}>` in the existing file:

```tsx
      <Pressable onPress={() => router.push("/settings")} style={styles.settingsLink}>
        <Text>Settings</Text>
      </Pressable>
```

And add to that file's `StyleSheet.create` object:

```ts
  settingsLink: { alignSelf: "flex-end", padding: 4 },
```

- [ ] **Step 8: Type-check and manual verification**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors.

With `npm run dev` running at the repo root and `npx expo start` in `/mobile`, log in as
the seeded admin, open Settings → Users, create a second user, edit their permissions,
deactivate then reactivate them, reset their password, then open Settings → Account and
change your own name and password. Confirm the changes are visible on the existing web
`/settings` page (same database).

- [ ] **Step 9: Commit**

```bash
git add mobile
git commit -m "Add mobile settings, users, and account screens"
```

---

## Self-Review Notes

- **Spec coverage:** list/create/edit-permissions/activate-deactivate/reset-password for
  users (Tasks 2–4, 6), own name/password (Task 5, 6), both self-protection guards
  reused unchanged from the existing web logic (Task 1), mobile Settings entry point
  gated on `MANAGE_USERS` (Task 6) — all covered. Calendar and accounting remain
  out of scope per the spec.
- **Type consistency:** `Result<T = object>` pattern from Phase 1's `items/service.ts`
  reused identically in `settings/service.ts`; `UserRow` type in
  `mobile/src/api/settings.ts` matches the JSON shape returned by `GET /api/v1/users`.
