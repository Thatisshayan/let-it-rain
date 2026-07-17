import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("prefixes formula-like cells with an apostrophe", () => {
    expect(toCsv([["=1+1", "+sum", "-42", "@cmd"]])).toBe("'=1+1,'+sum,'-42,'@cmd\r\n");
  });

  it("neutralizes tab and carriage-return prefixes", () => {
    expect(toCsv([["\tcmd"]])).toBe("'\tcmd\r\n");
    expect(toCsv([["\rcmd"]])).toBe("\"'\rcmd\"\r\n");
  });

  it("still escapes quotes and commas after sanitizing", () => {
    expect(toCsv([['=cmd|"calc"!A0', 'plain,text']])).toBe("\"'=cmd|\"\"calc\"\"!A0\",\"plain,text\"\r\n");
  });
});
