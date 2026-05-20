import { describe, expect, it } from "vitest";
import { buildPageNumbers } from "@/lib/pagination";

describe("buildPageNumbers", () => {
  it("returns all pages when total is small", () => {
    expect(buildPageNumbers(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("inserts ellipsis for large page counts", () => {
    expect(buildPageNumbers(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });
});
