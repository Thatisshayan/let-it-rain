import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));

import { apiFetch } from "./client";
import { fetchOrgSettings, updateOrgSettings, fetchOrgInfo, startCheckout } from "./settings";

beforeEach(() => vi.clearAllMocks());

describe("org settings/plan API client (Phase 13c/13d)", () => {
  it("fetchOrgSettings unwraps the settings object", async () => {
    (apiFetch as any).mockResolvedValue({ settings: { businessName: "Alpha", defaultLowStock: 5 } });
    const res = await fetchOrgSettings();
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/org/settings");
    expect(res).toEqual({ businessName: "Alpha", defaultLowStock: 5 });
  });

  it("updateOrgSettings PATCHes the settings", async () => {
    (apiFetch as any).mockResolvedValue({ ok: true });
    await updateOrgSettings({ businessName: "New", defaultLowStock: 3 });
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/org/settings", {
      method: "PATCH",
      body: JSON.stringify({ businessName: "New", defaultLowStock: 3 }),
    });
  });

  it("fetchOrgInfo unwraps the organization object", async () => {
    (apiFetch as any).mockResolvedValue({
      organization: { name: "Alpha", plan: "PRO", planLabel: "Pro", seatLimit: 25, subscriptionStatus: "ACTIVE", emailVerified: true, usage: { activeUsers: 4 } },
    });
    const res = await fetchOrgInfo();
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/org");
    expect(res.plan).toBe("PRO");
    expect(res.usage.activeUsers).toBe(4);
  });

  it("startCheckout posts the chosen plan and returns the url", async () => {
    (apiFetch as any).mockResolvedValue({ url: "https://checkout.stripe.test/x" });
    const res = await startCheckout("PRO");
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "PRO" }) });
    expect(res.url).toContain("stripe");
  });
});
