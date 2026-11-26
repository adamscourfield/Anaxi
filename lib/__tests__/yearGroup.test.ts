import { describe, expect, it } from "vitest";
import { canonicalYearGroup, compareYearGroups, formatYearGroup, normalizeYearGroup } from "@/lib/yearGroup";

describe("year groups", () => {
  it("stores every common spelling as one code", () => {
    for (const v of ["8", "08", "Y8", "y8", "Y 8", "Year 8", "year 08", "Yr 8"]) expect(canonicalYearGroup(v)).toBe("Y8");
    expect(canonicalYearGroup("Rec")).toBe("R");
    expect(canonicalYearGroup("Reception")).toBe("R");
    expect(canonicalYearGroup("Nursery")).toBe("N");
    expect(canonicalYearGroup("23")).toBeNull();
    expect(canonicalYearGroup("Set A")).toBeNull();
  });

  it("keeps what it can't recognise and normalises lists", () => {
    expect(normalizeYearGroup("  Set A ")).toBe("Set A");
    expect(normalizeYearGroup("Y7, Year 8")).toBe("Y7, Y8");
    expect(normalizeYearGroup("")).toBeNull();
  });

  it("shows one label", () => {
    expect(formatYearGroup("8")).toBe("Year 8");
    expect(formatYearGroup("Y11")).toBe("Year 11");
    expect(formatYearGroup("R")).toBe("Reception");
    expect(formatYearGroup("Y7, Y8, Y9")).toBe("Years 7, 8 and 9");
    expect(formatYearGroup("Y10 / Y11")).toBe("Years 10 and 11");
    expect(formatYearGroup(null)).toBe("—");
  });

  it("sorts Nursery, Reception, then years in number order", () => {
    expect(["Y10", "Y7", "R", "N", "Y9"].sort(compareYearGroups)).toEqual(["N", "R", "Y7", "Y9", "Y10"]);
  });
});
