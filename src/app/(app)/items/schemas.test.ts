import { describe, expect, it } from "vitest";
import { parseCustomFields } from "./schemas";

describe("parseCustomFields", () => {
  it("returns undefined for empty input", () => {
    expect(parseCustomFields(undefined)).toBeUndefined();
    expect(parseCustomFields("")).toBeUndefined();
  });

  it("parses key: value lines", () => {
    expect(parseCustomFields("Supplier: Acme Co\nUnit: box")).toEqual({
      Supplier: "Acme Co",
      Unit: "box",
    });
  });

  it("keeps everything after the first colon as the value", () => {
    expect(parseCustomFields("Time: 10:30")).toEqual({ Time: "10:30" });
  });

  it("ignores lines without a colon", () => {
    expect(parseCustomFields("Supplier: Acme Co\nnot a field")).toEqual({
      Supplier: "Acme Co",
    });
  });

  it("keeps the first occurrence when a key repeats", () => {
    expect(parseCustomFields("Unit: box\nUnit: crate")).toEqual({ Unit: "box" });
  });
});
