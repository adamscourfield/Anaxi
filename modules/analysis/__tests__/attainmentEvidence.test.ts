import { describe, expect, it } from "vitest";
import { pickAttainmentCycle } from "@/modules/analysis/attainmentCycle";
import { filterVisibleTeachers } from "@/modules/analysis/attainmentScope";
import {
  average,
  changeTone,
  formatIndex,
  formatIndexChange,
  formatIndexPoints,
  gapTone,
} from "@/modules/analysis/attainmentFormat";

describe("attainment formats", () => {
  it("shows scores as a 0–100 index, never a percentage", () => {
    expect(formatIndex(0.643)).toBe("64.3");
    expect(formatIndex(null)).toBe("—");
  });

  it("signs changes with a true minus and drops rounding noise", () => {
    expect(formatIndexChange(0.031)).toBe("+3.1");
    expect(formatIndexChange(-0.004)).toBe("−0.4");
    expect(formatIndexChange(0.0004)).toBe("0.0");
    expect(formatIndexPoints(-0.051)).toBe("−5.1 points");
    expect(formatIndexPoints(0.01)).toBe("+1.0 point");
  });

  it("flags only changes and gaps past the thresholds", () => {
    expect(changeTone(-0.05)).toBe("concern");
    expect(changeTone(-0.049)).toBe("neutral");
    expect(changeTone(0.06)).toBe("positive");
    expect(gapTone(0.09)).toBe("concern");
    expect(gapTone(-0.2)).toBe("neutral");
  });

  it("averages only the values that exist", () => {
    expect(average([0.2, null, 0.4])).toBeCloseTo(0.3);
    expect(average([null, undefined])).toBeNull();
  });
});

describe("choosing the cycle", () => {
  const cycles = [
    { id: "a", label: "Year 11 GCSE", hasResults: false },
    { id: "b", label: "Year 13 A-level", hasResults: true },
  ];

  it("uses the requested cycle when it exists", () => {
    expect(pickAttainmentCycle(cycles, "a")?.id).toBe("a");
  });

  it("otherwise picks the first cycle with results, never all cycles at once", () => {
    expect(pickAttainmentCycle(cycles, undefined)?.id).toBe("b");
    expect(pickAttainmentCycle(cycles, "missing")?.id).toBe("b");
    expect(pickAttainmentCycle([], undefined)).toBeNull();
  });
});

describe("teacher visibility", () => {
  const rows = [{ teacherId: "t1" }, { teacherId: "t2" }];
  it("keeps everyone for school-wide viewers and only visible teachers otherwise", () => {
    expect(filterVisibleTeachers(rows, null)).toHaveLength(2);
    expect(filterVisibleTeachers(rows, new Set(["t2"]))).toEqual([{ teacherId: "t2" }]);
  });
});
