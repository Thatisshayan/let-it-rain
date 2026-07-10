export type SaleMovement = {
  itemId: string;
  itemName: string;
  delta: number;
  unitPriceAtTime: number | null;
  unitCostAtTime: number | null;
  createdAt: string | Date;
};

export type RestockMovement = {
  delta: number;
  unitCostAtTime: number | null;
  createdAt: string | Date;
};

export type ItemSalesSummary = {
  itemId: string;
  itemName: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  profit: number;
};

function dateKey(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function totalRevenue(sales: SaleMovement[]): number {
  return sales.reduce((sum, m) => sum + -m.delta * (m.unitPriceAtTime ?? 0), 0);
}

export function totalCogs(sales: SaleMovement[]): number {
  return sales.reduce((sum, m) => sum + -m.delta * (m.unitCostAtTime ?? 0), 0);
}

export function totalRestockCost(restocks: RestockMovement[]): number {
  return restocks.reduce((sum, m) => sum + m.delta * (m.unitCostAtTime ?? 0), 0);
}

export function revenueByDay(sales: SaleMovement[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of sales) {
    const key = dateKey(m.createdAt);
    const revenue = -m.delta * (m.unitPriceAtTime ?? 0);
    map.set(key, (map.get(key) ?? 0) + revenue);
  }
  return map;
}

export function salesByItem(sales: SaleMovement[]): ItemSalesSummary[] {
  const map = new Map<string, ItemSalesSummary>();
  for (const m of sales) {
    const units = -m.delta;
    const revenue = units * (m.unitPriceAtTime ?? 0);
    const cogs = units * (m.unitCostAtTime ?? 0);
    const entry = map.get(m.itemId) ?? {
      itemId: m.itemId,
      itemName: m.itemName,
      unitsSold: 0,
      revenue: 0,
      cogs: 0,
      profit: 0,
    };
    entry.unitsSold += units;
    entry.revenue += revenue;
    entry.cogs += cogs;
    entry.profit += revenue - cogs;
    map.set(m.itemId, entry);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}
