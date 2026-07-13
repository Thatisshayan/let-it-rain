/**
 * Phase 13a — cross-org data isolation suite (THE load-bearing test for this phase).
 *
 * Unlike the other service tests, this does NOT use a dumb prisma mock that
 * returns whatever you tell it. It uses a small in-memory fake Prisma that
 * genuinely enforces `where.organizationId` (and id/deletedAt/status/etc.). It
 * is seeded with TWO organizations' worth of data. The real service functions
 * and real API route handlers are then run against it with an Org A session.
 *
 * Because the fake actually filters, a query that FORGOT to pass organizationId
 * would return Org B's rows here and fail the assertion — that is the whole
 * point. This is the multi-tenant equivalent of Phase 0's audit: prove the
 * boundary can't be crossed, not just that the happy path works.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ----------------------------------------------------------------------------
// In-memory fake Prisma
//
// Wrapped in vi.hoisted so it is fully initialized before the (hoisted)
// vi.mock("@/lib/prisma") factory runs and before the services-under-test
// import prisma.
// ----------------------------------------------------------------------------

type Row = Record<string, any>;

const H = vi.hoisted(() => {
  const db: Record<string, Row[]> = {
    organization: [],
    user: [],
    item: [],
    movement: [],
    order: [],
    orderLineItem: [],
    auditLog: [],
    appConfig: [],
  };

  const state = { idCounter: 0 };
  const nextId = (p: string) => `${p}-${++state.idCounter}`;

function norm(v: any) {
  return v === undefined ? null : v;
}

function matchField(value: any, cond: any): boolean {
  value = norm(value);
  if (cond === null) return value === null;
  if (cond === undefined) return true; // absent filter matches anything
  if (typeof cond !== "object" || cond instanceof Date) {
    return value === cond;
  }
  if ("in" in cond) return Array.isArray(cond.in) && cond.in.includes(value);
  if ("not" in cond) {
    return cond.not === null ? value !== null : value !== cond.not;
  }
  let ok = true;
  if ("lt" in cond) ok = ok && value < cond.lt;
  if ("lte" in cond) ok = ok && value <= cond.lte;
  if ("gt" in cond) ok = ok && value > cond.gt;
  if ("gte" in cond) ok = ok && value >= cond.gte;
  if ("contains" in cond) {
    ok =
      ok &&
      String(value ?? "")
        .toLowerCase()
        .includes(String(cond.contains).toLowerCase());
  }
  return ok;
}

function matchesWhere(row: Row, where: any): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!(cond as any[]).some((w) => matchesWhere(row, w))) return false;
    } else if (key === "AND") {
      if (!(cond as any[]).every((w) => matchesWhere(row, w))) return false;
    } else if (!matchField(row[key], cond)) {
      return false;
    }
  }
  return true;
}

function resolveInclude(row: Row, model: string, include: any): Row {
  if (!include) return { ...row };
  const out: Row = { ...row };
  const rel = (m: string, pred: (r: Row) => boolean) => db[m].filter(pred);
  const relOne = (m: string, id: any) => (id == null ? null : db[m].find((r) => r.id === id) ?? null);

  for (const [key, spec] of Object.entries(include)) {
    if (!spec) continue;
    if (model === "order" && key === "lineItems") {
      const nested = (spec as any).include;
      out.lineItems = rel("orderLineItem", (r) => r.orderId === row.id).map((li) =>
        resolveInclude(li, "orderLineItem", nested)
      );
    } else if (model === "order" && key === "driver") out.driver = relOne("user", row.driverId);
    else if (model === "order" && key === "createdBy") out.createdBy = relOne("user", row.createdById);
    else if (model === "orderLineItem" && key === "item") out.item = relOne("item", row.itemId);
    else if (model === "movement" && key === "item") out.item = relOne("item", row.itemId);
    else if (model === "movement" && key === "user") out.user = relOne("user", row.userId);
    else if (model === "auditLog" && key === "actor") out.actor = relOne("user", row.actorId);
    else if (model === "auditLog" && key === "targetUser") out.targetUser = relOne("user", row.targetUserId);
    else if (model === "auditLog" && key === "order") out.order = relOne("order", row.orderId);
    else if (model === "item" && key === "movements") {
      out.movements = rel("movement", (r) => r.itemId === row.id);
    }
  }
  return out;
}

function orderRows(rows: Row[], orderBy: any): Row[] {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const c of clauses) {
      const [field, dir] = Object.entries(c)[0] as [string, string];
      if (a[field] < b[field]) return dir === "asc" ? -1 : 1;
      if (a[field] > b[field]) return dir === "asc" ? 1 : -1;
    }
    return 0;
  });
}

class NotFoundError extends Error {
  code = "P2025";
}

function modelApi(model: string) {
  return {
    findMany: async ({ where, orderBy, skip, take, include }: any = {}) => {
      let rows = db[model].filter((r) => matchesWhere(r, where));
      rows = orderRows(rows, orderBy);
      if (skip) rows = rows.slice(skip);
      if (take != null) rows = rows.slice(0, take);
      return rows.map((r) => resolveInclude(r, model, include));
    },
    findUnique: async ({ where, include }: any) => {
      const row = db[model].find((r) => matchesWhere(r, where));
      return row ? resolveInclude(row, model, include) : null;
    },
    findFirst: async ({ where, include }: any = {}) => {
      const row = db[model].find((r) => matchesWhere(r, where));
      return row ? resolveInclude(row, model, include) : null;
    },
    count: async ({ where }: any = {}) => db[model].filter((r) => matchesWhere(r, where)).length,
    create: async ({ data }: any) => {
      const row: Row = { id: data.id ?? nextId(model), ...data };
      delete row.lineItems;
      db[model].push(row);
      if (data.lineItems?.create) {
        for (const li of data.lineItems.create) {
          db.orderLineItem.push({ id: nextId("oli"), orderId: row.id, ...li });
        }
      }
      return { ...row };
    },
    update: async ({ where, data }: any) => {
      const row = db[model].find((r) => matchesWhere(r, where));
      if (!row) throw new NotFoundError("Record to update not found.");
      for (const [k, v] of Object.entries<any>(data)) {
        if (v && typeof v === "object" && "increment" in v) row[k] = (row[k] ?? 0) + v.increment;
        else row[k] = v;
      }
      return { ...row };
    },
  };
}

  const fakePrisma: any = {
    organization: modelApi("organization"),
    user: modelApi("user"),
    item: modelApi("item"),
    movement: modelApi("movement"),
    order: modelApi("order"),
    orderLineItem: modelApi("orderLineItem"),
    auditLog: modelApi("auditLog"),
    appConfig: modelApi("appConfig"),
    $transaction: async (fn: any) => fn(fakePrisma),
  };

  return { db, fakePrisma, nextId, state };
});

const { db, fakePrisma, nextId, state } = H;

vi.mock("@/lib/prisma", () => ({ prisma: H.fakePrisma }));
// Password hashing is irrelevant to isolation; keep it fast + deterministic.
vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hashed:${p}`),
  verifyPassword: vi.fn(async () => true),
}));
// Mock only the bearer-token resolver so we can drive API route handlers with a
// chosen org's session; everything else in @/lib/auth stays real.
vi.mock("@/lib/auth", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/auth")>();
  return { ...actual, verifyBearerToken: vi.fn() };
});

import { verifyBearerToken } from "@/lib/auth";
import { GET as itemsGET } from "@/app/api/v1/items/route";
import { GET as itemDetailGET } from "@/app/api/v1/items/[id]/route";
import { GET as usersGET } from "@/app/api/v1/users/route";
import { GET as auditGET } from "@/app/api/v1/audit/route";

import {
  createOrder,
  assignDriver,
  markOutForDelivery,
  cancelOrder,
  listOrders,
  getOrder,
} from "./orders/service";
import { adjustStock, updateItem, deleteItem } from "./items/service";
import { createUser, updateUserPermissions, setUserActive } from "./settings/service";
import { revokeUserSessions } from "./accounts/service";
import { listAuditLog, listUserActivity } from "./audit-log/service";

// ----------------------------------------------------------------------------
// Two-org seed
// ----------------------------------------------------------------------------

const ORG_A = "org-a";
const ORG_B = "org-b";

const ALL_PERMS = [
  "MANAGE_USERS",
  "EDIT_ITEMS",
  "DELETE_ITEMS",
  "ADJUST_STOCK",
  "CREATE_ORDERS",
  "ASSIGN_DRIVERS",
  "CANCEL_ORDERS",
  "VIEW_REPORTS",
  "VIEW_COSTS",
  "VIEW_AUDIT_LOG",
];

function session(userId: string, organizationId: string) {
  return { userId, email: `${userId}@x.com`, name: userId, permissions: ALL_PERMS, tokenVersion: 0, organizationId };
}

let sessionA: ReturnType<typeof session>;
let sessionB: ReturnType<typeof session>;
let ids: Record<string, string>;

function seed() {
  for (const k of Object.keys(db)) db[k] = [];
  state.idCounter = 0;
  ids = {};

  db.organization.push({ id: ORG_A, name: "Alpha" }, { id: ORG_B, name: "Bravo" });

  const mkUser = (key: string, org: string) => {
    const id = nextId("user");
    ids[key] = id;
    db.user.push({ id, name: key, email: `${key}@x.com`, passwordHash: "h", permissions: ALL_PERMS, active: true, tokenVersion: 0, organizationId: org });
  };
  mkUser("aAdmin", ORG_A);
  mkUser("aDriver", ORG_A);
  mkUser("bAdmin", ORG_B);
  mkUser("bDriver", ORG_B);

  const mkItem = (key: string, org: string) => {
    const id = nextId("item");
    ids[key] = id;
    db.item.push({ id, name: key, category: null, quantity: 100, minStock: 0, unitCost: 1, unitPrice: 2, deletedAt: null, organizationId: org });
  };
  mkItem("itemA", ORG_A);
  mkItem("itemB", ORG_B);

  const mkMovement = (key: string, org: string, itemId: string, userId: string) => {
    const id = nextId("mov");
    ids[key] = id;
    db.movement.push({ id, itemId, userId, type: "RECEIVE", delta: 10, quantityAfter: 10, isSale: false, createdAt: new Date("2026-01-01"), organizationId: org });
  };
  mkMovement("movA", ORG_A, ids.itemA, ids.aAdmin);
  mkMovement("movB", ORG_B, ids.itemB, ids.bAdmin);

  const mkOrder = (key: string, org: string, createdBy: string, driver: string | null) => {
    const id = nextId("order");
    ids[key] = id;
    db.order.push({ id, customerName: key, status: "PENDING", createdById: createdBy, driverId: driver, cancelledById: null, createdAt: new Date("2026-01-01"), organizationId: org });
  };
  mkOrder("orderA", ORG_A, ids.aAdmin, ids.aDriver);
  mkOrder("orderB", ORG_B, ids.bAdmin, ids.bDriver);

  const mkAudit = (key: string, org: string, actor: string) => {
    const id = nextId("audit");
    ids[key] = id;
    db.auditLog.push({ id, actorId: actor, action: "X", targetUserId: null, orderId: null, detail: "d", createdAt: new Date("2026-01-01"), organizationId: org });
  };
  mkAudit("logA", ORG_A, ids.aAdmin);
  mkAudit("logB", ORG_B, ids.bAdmin);

  db.appConfig.push(
    { id: nextId("cfg"), organizationId: ORG_A, businessName: "Alpha Co", defaultLowStock: 5 },
    { id: nextId("cfg"), organizationId: ORG_B, businessName: "Bravo Co", defaultLowStock: 9 }
  );

  sessionA = session(ids.aAdmin, ORG_A);
  sessionB = session(ids.bAdmin, ORG_B);
}

beforeEach(seed);

// ----------------------------------------------------------------------------
// Sanity: the fake actually enforces org scoping (guards against a broken fake
// that would make every assertion below pass vacuously).
// ----------------------------------------------------------------------------

describe("fake prisma enforces organizationId (test-infra sanity)", () => {
  it("filters findMany by organizationId", async () => {
    const aItems = await fakePrisma.item.findMany({ where: { organizationId: ORG_A } });
    expect(aItems.map((i: Row) => i.id)).toEqual([ids.itemA]);
  });
  it("a query WITHOUT an org filter would see both orgs (proves the filter is load-bearing)", async () => {
    const all = await fakePrisma.item.findMany({});
    expect(all).toHaveLength(2);
  });
});

// ----------------------------------------------------------------------------
// Items / movements
// ----------------------------------------------------------------------------

describe("items & movements isolation", () => {
  it("adjustStock cannot touch another org's item", async () => {
    const res = await adjustStock(sessionA, ids.itemB, { type: "RECEIVE", amount: 5, unitCost: 1, reason: undefined } as any);
    expect(res.ok).toBe(false);
    // Org B's item quantity is untouched.
    expect(db.item.find((i) => i.id === ids.itemB)!.quantity).toBe(100);
    // No movement leaked into Org B.
    expect(db.movement.filter((m) => m.itemId === ids.itemB)).toHaveLength(1);
  });

  it("updateItem cannot modify another org's item", async () => {
    await expect(updateItem(sessionA, ids.itemB, { name: "HACKED", minStock: 0 } as any)).rejects.toMatchObject({ code: "P2025" });
    expect(db.item.find((i) => i.id === ids.itemB)!.name).toBe("itemB");
  });

  it("deleteItem cannot soft-delete another org's item", async () => {
    await expect(deleteItem(sessionA, ids.itemB)).rejects.toMatchObject({ code: "P2025" });
    expect(db.item.find((i) => i.id === ids.itemB)!.deletedAt).toBeNull();
  });

  it("adjustStock CAN touch its own org's item (positive control)", async () => {
    const res = await adjustStock(sessionA, ids.itemA, { type: "RECEIVE", amount: 5, unitCost: 1, reason: undefined } as any);
    expect(res.ok).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Orders
// ----------------------------------------------------------------------------

describe("orders isolation", () => {
  it("listOrders returns only the caller's org's orders", async () => {
    const a = await listOrders(sessionA);
    expect(a.map((o: Row) => o.id)).toEqual([ids.orderA]);
    const b = await listOrders(sessionB);
    expect(b.map((o: Row) => o.id)).toEqual([ids.orderB]);
  });

  it("getOrder returns null for another org's order", async () => {
    expect(await getOrder(sessionA, ids.orderB)).toBeNull();
    expect(await getOrder(sessionA, ids.orderA)).not.toBeNull();
  });

  it("createOrder rejects line items from another org", async () => {
    const res = await createOrder(sessionA, { customerName: "X", lineItems: [{ itemId: ids.itemB, quantity: 1 }] } as any);
    expect(res.ok).toBe(false);
    expect(db.order.some((o) => o.organizationId === ORG_A && o.customerName === "X")).toBe(false);
  });

  it("assignDriver cannot act on another org's order", async () => {
    const res = await assignDriver(sessionA, ids.orderB, { driverId: ids.aDriver } as any);
    expect(res.ok).toBe(false);
  });

  it("assignDriver cannot assign a driver from another org", async () => {
    const res = await assignDriver(sessionA, ids.orderA, { driverId: ids.bDriver } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/driver not found/i);
  });

  it("markOutForDelivery / cancelOrder cannot act on another org's order", async () => {
    expect((await markOutForDelivery(sessionA, ids.orderB)).ok).toBe(false);
    expect((await cancelOrder(sessionA, ids.orderB)).ok).toBe(false);
    // Org B's order is untouched.
    expect(db.order.find((o) => o.id === ids.orderB)!.status).toBe("PENDING");
  });
});

// ----------------------------------------------------------------------------
// Audit log
// ----------------------------------------------------------------------------

describe("audit log isolation", () => {
  it("listAuditLog returns only the caller's org's entries", async () => {
    expect((await listAuditLog(ORG_A)).map((e) => e.id)).toEqual([ids.logA]);
    expect((await listAuditLog(ORG_B)).map((e) => e.id)).toEqual([ids.logB]);
  });

  it("listUserActivity for a foreign user returns nothing (org filter wins over userId)", async () => {
    const entries = await listUserActivity(ORG_A, ids.bAdmin);
    expect(entries).toHaveLength(0);
  });
});

// ----------------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------------

describe("user management isolation", () => {
  it("createUser creates the user in the admin's org", async () => {
    const res = await createUser(sessionA, { name: "New", email: "new@x.com", password: "password1", permissions: [] } as any);
    expect(res.ok).toBe(true);
    const created = db.user.find((u) => u.email === "new@x.com")!;
    expect(created.organizationId).toBe(ORG_A);
  });

  it("updateUserPermissions cannot touch a user in another org", async () => {
    const res = await updateUserPermissions(sessionA, ids.bAdmin, { permissions: [] } as any);
    expect(res.ok).toBe(false);
    expect(db.user.find((u) => u.id === ids.bAdmin)!.permissions).toEqual(ALL_PERMS);
  });

  it("setUserActive cannot deactivate a user in another org", async () => {
    const res = await setUserActive(sessionA, ids.bAdmin, false);
    expect(res.ok).toBe(false);
    expect(db.user.find((u) => u.id === ids.bAdmin)!.active).toBe(true);
  });

  it("revokeUserSessions cannot revoke a user in another org", async () => {
    const res = await revokeUserSessions(sessionA, ids.bAdmin);
    expect(res.ok).toBe(false);
    expect(db.user.find((u) => u.id === ids.bAdmin)!.tokenVersion).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// AppConfig (now one row per org, no id=1 global singleton)
// ----------------------------------------------------------------------------

describe("AppConfig isolation", () => {
  it("an org-scoped AppConfig lookup only ever returns that org's row", async () => {
    const a = await fakePrisma.appConfig.findUnique({ where: { organizationId: ORG_A } });
    const b = await fakePrisma.appConfig.findUnique({ where: { organizationId: ORG_B } });
    expect(a.businessName).toBe("Alpha Co");
    expect(b.businessName).toBe("Bravo Co");
    // There is no global id=1 row to accidentally read across tenants.
    expect(db.appConfig.every((c) => c.id !== 1 && c.id !== "1")).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// API route handlers (the enforcement boundary mobile + web clients call).
// Driven with an Org A session via the mocked verifyBearerToken.
// ----------------------------------------------------------------------------

describe("API route isolation (Org A session)", () => {
  const req = (url = "http://localhost/api/v1/x") => new Request(url);

  beforeEach(() => {
    (verifyBearerToken as any).mockResolvedValue(sessionA);
  });

  it("GET /items returns only Org A items", async () => {
    const res = await itemsGET(req());
    const body = await res.json();
    expect(body.items.map((i: Row) => i.id)).toEqual([ids.itemA]);
  });

  it("GET /items/[id] 404s for an Org B item", async () => {
    const res = await itemDetailGET(req(), { params: Promise.resolve({ id: ids.itemB }) } as any);
    expect(res.status).toBe(404);
  });

  it("GET /items/[id] succeeds for an Org A item", async () => {
    const res = await itemDetailGET(req(), { params: Promise.resolve({ id: ids.itemA }) } as any);
    expect(res.status).toBe(200);
  });

  it("GET /users returns only Org A users", async () => {
    const res = await usersGET(req());
    const body = await res.json();
    const returnedOrgs = new Set(body.users.map((u: Row) => u.id));
    expect(returnedOrgs.has(ids.bAdmin)).toBe(false);
    expect(returnedOrgs.has(ids.aAdmin)).toBe(true);
  });

  it("GET /audit returns only Org A audit entries", async () => {
    const res = await auditGET(req());
    const body = await res.json();
    expect(body.entries.map((e: Row) => e.id)).toEqual([ids.logA]);
  });
});
