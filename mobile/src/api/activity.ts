import { apiFetch } from "./client";

export type MonthCell = { date: string; inMonth: boolean };

export type ActivityMovement = {
  id: string;
  itemId: string;
  itemName: string;
  type: "RECEIVE" | "REMOVE" | "ADJUST";
  delta: number;
  reason: string | null;
  userName: string;
  createdAt: string;
};

export type ActivityMonth = {
  year: number;
  month: number;
  monthLabel: string;
  weeks: MonthCell[][];
  days: Record<string, { net: number; count: number }>;
  movements: ActivityMovement[];
};

export async function fetchActivity(month?: string): Promise<ActivityMonth> {
  const qs = month ? `?month=${month}` : "";
  return apiFetch(`/api/v1/activity${qs}`);
}

export function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function adjacentMonthParam(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return monthParam(d.getUTCFullYear(), d.getUTCMonth() + 1);
}
