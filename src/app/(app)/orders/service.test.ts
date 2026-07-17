import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    item: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    movement: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  createOrder,
  assignDriver,
  markOutForDelivery,
  markDelivered,
  cancelOrder,
  listOrders,
} from "./service";

const manager = {
  userId: "u1",
  email: "manager@b.com",
  name: "Manager",
  permissions: ["CREATE_ORDERS", "ASSIGN_DRIVERS", "CANCEL_ORDERS"],
  tokenVersion: 0,
  organizationId: "org-1",
};
const driver = {
  userId: "u2",
  email: "driver@b.com",
  name: "Driver",
  permissions: [] as string[],
  tokenVersion: 0,
  organizationId: "org-1",
};

beforeEach(() => vi.clearAllMocks());

describe("createOrder", () => {
  it("rejects without CREATE_ORDERS permission", async () => {
    const result = await createOrder(driver, {
      customerName: "Acme",
      lineItems: [{ itemId: "i1", quantity: 2 }],
    } as any);
    expect(result.ok).toBe(false);
  });

  it("rejects if a line item references a non-existent item", async () => {
    (prisma.item.findMany as any).mockResolvedValue([]);
    const result = await createOrder(manager, {
      customerName: "Acme",
      lineItems: [{ itemId: "i1", quantity: 2 }],
    } as any);
    expect(result.ok).toBe(false);
  });

  it("creates an order with valid line items", async () => {
    (prisma.item.findMany as any).mockResolvedValue([{ id: "i1" }]);
    (prisma.order.create as any).mockResolvedValue({ id: "o1" });
    const result = await createOrder(manager, {
      customerName: "Acme",
      lineItems: [{ itemId: "i1", quantity: 2 }],
    } as any);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.orderId).toBe("o1");
  });
});

describe("assignDriver", () => {
  it("rejects without ASSIGN_DRIVERS permission", async () => {
    const result = await assignDriver(driver, "o1", { driverId: "u2" });
    expect(result.ok).toBe(false);
  });

  it("assigns a driver to a pending order", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({ id: "o1", status: "PENDING", customerName: "Acme" });
    (prisma.order.update as any).mockResolvedValue({});
    (prisma.user.findUnique as any).mockResolvedValue({ name: "Driver" });
    const result = await assignDriver(manager, "o1", { driverId: "u2" });
    expect(result.ok).toBe(true);
  });
});

describe("markOutForDelivery", () => {
  it("allows the assigned driver even without MANAGE_ORDERS", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: "o1",
      driverId: "u2",
      status: "PENDING",
    });
    (prisma.order.update as any).mockResolvedValue({});
    const result = await markOutForDelivery(driver, "o1");
    expect(result.ok).toBe(true);
  });

  it("rejects a different, unassigned user without MANAGE_ORDERS", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: "o1",
      driverId: "someone-else",
      status: "PENDING",
    });
    const result = await markOutForDelivery(driver, "o1");
    expect(result.ok).toBe(false);
  });
});

describe("markDelivered", () => {
  it("creates a sale movement per line item when payment is provided and decrements stock", async () => {
    const movementCreate = vi.fn();
    const itemUpdate = vi.fn();
    (prisma.order.findUnique as any).mockResolvedValue({
      id: "o1",
      driverId: "u2",
      status: "OUT_FOR_DELIVERY",
    });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: "o1",
            customerName: "Acme",
            status: "OUT_FOR_DELIVERY",
            lineItems: [{ id: "li1", itemId: "i1", quantity: 3 }],
          }),
          update: vi.fn(),
        },
        item: {
          findUnique: vi.fn().mockResolvedValue({
            id: "i1",
            name: "Widget",
            quantity: 10,
            unitCost: 2,
            deletedAt: null,
          }),
          update: itemUpdate,
        },
        movement: { create: movementCreate },
      })
    );

    const result = await markDelivered(driver, "o1", {
      payments: [{ lineItemId: "li1", cashAmount: 12, interacAmount: 3 }],
    });

    expect(result.ok).toBe(true);
    expect(itemUpdate).toHaveBeenCalledWith({
      where: { id: "i1", organizationId: "org-1" },
      data: { quantity: 7 },
    });
    expect(movementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        itemId: "i1",
        type: "REMOVE",
        delta: -3,
        quantityAfter: 7,
        isSale: true,
        cashAmount: 12,
        interacAmount: 3,
        unitPriceAtTime: 5, // (12 + 3) / 3 units
      }),
    });
  });

  it("rejects (all-or-nothing) when a line item would take stock negative", async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: "o1",
      driverId: "u2",
      status: "OUT_FOR_DELIVERY",
    });
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: "o1",
            customerName: "Acme",
            status: "OUT_FOR_DELIVERY",
            lineItems: [{ id: "li1", itemId: "i1", quantity: 100 }],
          }),
          update: vi.fn(),
        },
        item: {
          findUnique: vi.fn().mockResolvedValue({
            id: "i1",
            name: "Widget",
            quantity: 5,
            unitCost: 2,
            deletedAt: null,
          }),
          update: vi.fn(),
        },
        movement: { create: vi.fn() },
      })
    );

    const result = await markDelivered(driver, "o1", { payments: [] });
    expect(result.ok).toBe(false);
  });
});

describe("cancelOrder", () => {
  it("rejects without CANCEL_ORDERS permission", async () => {
    const result = await cancelOrder(driver, "o1");
    expect(result.ok).toBe(false);
  });
});

describe("listOrders", () => {
  it("scopes to the caller's own assigned orders without order permissions", async () => {
    (prisma.order.findMany as any).mockResolvedValue([]);
    await listOrders(driver);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { driverId: "u2", organizationId: "org-1" } })
    );
  });

  it("returns everything for a CREATE_ORDERS holder", async () => {
    (prisma.order.findMany as any).mockResolvedValue([]);
    await listOrders(manager);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org-1" } })
    );
  });
});
