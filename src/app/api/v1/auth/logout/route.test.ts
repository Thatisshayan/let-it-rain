import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/v1/auth/logout", () => {
  it("returns 200", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
  });
});
