import { describe, expect, it } from "vitest";
import { parseClipboard } from "../assessment-clipboard";
describe("spreadsheet clipboard", () => {
  it("preserves blank cells in Excel ranges", () => {
    expect(parseClipboard("5\t\t7\r\n6\t8\t\r\n")).toEqual([["5", "", "7"], ["6", "8", ""]]);
  });
  it("handles CSV quoting and embedded newlines", () => {
    expect(parseClipboard('"A*",6\r\n"a,b","line\nvalue"')).toEqual([["A*", "6"], ["a,b", "line\nvalue"]]);
  });
});
