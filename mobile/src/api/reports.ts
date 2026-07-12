import { apiFetch } from "./client";

export type RevenueByDayEntry = { date: string; revenue: number };

export type ItemSalesSummary = {
  itemId: string;
  itemName: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  profit: number;
};

export type ReportsMonth = {
  year: number;
  month: number;
  monthLabel: string;
  todayRevenue: number;
  monthRevenue: number;
  monthCogs: number;
  monthProfit: number;
  monthCash: number;
  monthInterac: number;
  monthRestockCost: number;
  inventoryValuation: number;
  revenueByDay: RevenueByDayEntry[];
  salesByItem: ItemSalesSummary[];
};

export async function fetchReports(month?: string): Promise<ReportsMonth> {
  const qs = month ? `?month=${month}` : "";
  return apiFetch(`/api/v1/reports${qs}`);
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toFixed(2);
  const [whole, cents] = abs.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${withCommas}.${cents}`;
}
