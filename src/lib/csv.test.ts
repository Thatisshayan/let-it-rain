import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins simple rows with commas and CRLF line endings", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d\r\n");
  });

  it("quotes fields containing commas", () => {
    expect(toCsv([["Acme, Inc.", "10"]])).toBe('"Acme, Inc.",10\r\n');
  });

  it("quotes and escapes fields containing double quotes", () => {
    expect(toCsv([['He said "hi"']])).toBe('"He said ""hi"""\r\n');
  });

  it("quotes fields containing newlines", () => {
    expect(toCsv([["line1\nline2"]])).toBe('"line1\nline2"\r\n');
  });

  it("leaves plain fields unquoted", () => {
    expect(toCsv([["Paper towels", "42"]])).toBe("Paper towels,42\r\n");
  });
});
