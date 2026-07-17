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

const session = {
  userId: "u1",
  email: "a@b.com",
  name: "Ada",
  permissions: ["EDIT_ITEMS", "DELETE_ITEMS", "ADJUST_STOCK"],
  tokenVersion: 0,
  organizationId: "org-1",
};

beforeEach(() => vi.clearAllMocks());

describe("createItem", () => {
  it("rejects without EDIT_ITEMS permission", async () => {
    const result = await createItem(
      { ...session, permissions: [] },
      {
        name: "Widget",
        category: undefined,
        description: undefined,
        minStock: 0,
        initialQuantity: 0,
        customFields: undefined,
        unitCost: 0,
        unitPrice: 0,
      }
    );
    expect(result.ok).toBe(false);
  });

  it("creates an item and, when initialQuantity > 0, a RECEIVE movement", async () => {
    (prisma.item.create as any).mockResolvedValue({ id: "item-1" });
    const result = await createItem(session, {
      name: "Widget",
      category: undefined,
      description: undefined,
      minStock: 5,
      initialQuantity: 10,
      customFields: undefined,
      unitCost: 2,
      unitPrice: 5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.itemId).toBe("item-1");
    expect(prisma.movement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemId: "item-1", type: "RECEIVE", delta: 10 }),
    });
  });
});

describe("updateItem", () => {
  it("rejects without EDIT_ITEMS permission", async () => {
    const result = await updateItem({ ...session, permissions: [] }, "item-1", {
      name: "Widget",
      category: undefined,
      description: undefined,
      minStock: 0,
      customFields: undefined,
      unitCost: 0,
      unitPrice: 0,
    });
    expect(result.ok).toBe(false);
  });

  it("updates an item with permission", async () => {
    (prisma.item.update as any).mockResolvedValue({});
    const result = await updateItem(session, "item-1", {
      name: "Widget",
      category: undefined,
      description: undefined,
      minStock: 0,
      customFields: undefined,
      unitCost: 0,
      unitPrice: 0,
    });
    expect(result.ok).toBe(true);
  });
});

describe("deleteItem", () => {
  it("rejects without DELETE_ITEMS permission", async () => {
    const result = await deleteItem({ ...session, permissions: [] }, "item-1");
    expect(result.ok).toBe(false);
  });

  it("soft deletes with permission", async () => {
    (prisma.item.update as any).mockResolvedValue({});
    const result = await deleteItem(session, "item-1");
    expect(result.ok).toBe(true);
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item-1", organizationId: "org-1", deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe("adjustStock", () => {
  it("rejects without ADJUST_STOCK permission", async () => {
    const result = await adjustStock({ ...session, permissions: [] }, "item-1", {
      type: "RECEIVE",
      amount: 5,
    } as any);
    expect(result.ok).toBe(false);
  });

  it("returns not found when the item doesn't exist", async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        item: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
        movement: { create: vi.fn() },
      })
    );
    const result = await adjustStock(session, "item-1", { type: "RECEIVE", amount: 5 } as any);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Item not found.");
  });

  it("applies a RECEIVE movement successfully", async () => {
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        item: {
          findUnique: vi.fn().mockResolvedValue({
            id: "item-1",
            quantity: 5,
            unitCost: 1,
            unitPrice: 2,
            deletedAt: null,
          }),
          update: vi.fn(),
        },
        movement: { create: vi.fn() },
      })
    );
    const result = await adjustStock(session, "item-1", { type: "RECEIVE", amount: 5 } as any);
    expect(result.ok).toBe(true);
  });

  it("splits a sale's cash/interac amounts and snapshots the effective unit price", async () => {
    const movementCreate = vi.fn();
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        item: {
          findUnique: vi.fn().mockResolvedValue({
            id: "item-1",
            quantity: 10,
            unitCost: 1,
            unitPrice: 5,
            deletedAt: null,
          }),
          update: vi.fn(),
        },
        movement: { create: movementCreate },
      })
    );
    const result = await adjustStock(session, "item-1", {
      type: "REMOVE",
      amount: 4,
      cashAmount: 12,
      interacAmount: 8,
    } as any);
    expect(result.ok).toBe(true);
    expect(movementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isSale: true,
        cashAmount: 12,
        interacAmount: 8,
        // (12 + 8) / 4 units = 5/unit, not the item's list unitPrice
        unitPriceAtTime: 5,
      }),
    });
  });

  it("does not mark a REMOVE as a sale when cash/interac amounts are both zero", async () => {
    const movementCreate = vi.fn();
    (prisma.$transaction as any).mockImplementation(async (fn: any) =>
      fn({
        item: {
          findUnique: vi.fn().mockResolvedValue({
            id: "item-1",
            quantity: 10,
            unitCost: 1,
            unitPrice: 5,
            deletedAt: null,
          }),
          update: vi.fn(),
        },
        movement: { create: movementCreate },
      })
    );
    const result = await adjustStock(session, "item-1", {
      type: "REMOVE",
      amount: 2,
      cashAmount: 0,
      interacAmount: 0,
      reason: "Damaged",
    } as any);
    expect(result.ok).toBe(true);
    expect(movementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isSale: false,
        cashAmount: null,
        interacAmount: null,
        unitPriceAtTime: null,
      }),
    });
  });
});
