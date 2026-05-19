import { describe, expect, it } from "vitest";
import type { StudentRiskRow } from "@/modules/analysis/studentRisk";
import {
  DEFAULT_VIEW_MODE,
  filterStudentRows,
  getPageSize,
  parseViewMode,
  effectiveBandFilter,
} from "@/modules/students/explorerList";

function row(overrides: Partial<StudentRiskRow>): StudentRiskRow {
  return {
    studentId: "s1",
    studentName: "Test Student",
    yearGroup: "Y10",
    sendFlag: false,
    ppFlag: false,
    band: "STABLE",
    riskScore: 1,
    confidence: "HIGH",
    lastSnapshotDate: null,
    drivers: [],
    attendancePct: 90,
    detentionsDelta: null,
    onCallsDelta: null,
    latenessDelta: null,
    suspensionsDelta: null,
    internalExclusionsDelta: null,
    attendanceDelta: null,
    positivePointsTotal: 0,
    onWatchlist: false,
    ...overrides,
  };
}

describe("parseViewMode", () => {
  it("defaults to attention", () => {
    expect(parseViewMode(undefined, "")).toBe(DEFAULT_VIEW_MODE);
  });

  it("maps explicit band to view", () => {
    expect(parseViewMode(undefined, "WATCH")).toBe("watch");
  });
});

describe("filterStudentRows", () => {
  const rows = [
    row({ studentId: "a", band: "URGENT", studentName: "Amy" }),
    row({ studentId: "b", band: "PRIORITY", studentName: "Bob" }),
    row({ studentId: "c", band: "WATCH", studentName: "Cara" }),
    row({ studentId: "d", band: "STABLE", sendFlag: true, ppFlag: true }),
  ];

  it("filters needs attention view", () => {
    const filtered = filterStudentRows(rows, {
      view: "attention",
      band: "",
      yearGroup: "",
      studentSearch: "",
      send: "",
      pp: "",
      watchlistOnly: false,
      attendanceBelow80: false,
    });
    expect(filtered.map((r) => r.studentId)).toEqual(["a", "b"]);
  });

  it("filters SEN and search", () => {
    const filtered = filterStudentRows(rows, {
      view: "all",
      band: "",
      yearGroup: "",
      studentSearch: "car",
      send: "",
      pp: "",
      watchlistOnly: false,
      attendanceBelow80: false,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].studentName).toBe("Cara");
  });
});

describe("getPageSize", () => {
  it("returns up to 50 for attention queue", () => {
    expect(getPageSize("attention", "", 12)).toBe(12);
    expect(getPageSize("attention", "", 100)).toBe(50);
  });

  it("returns 25 for all students", () => {
    expect(getPageSize("all", "", 100)).toBe(25);
  });
});

describe("effectiveBandFilter", () => {
  it("returns NEEDS_ATTENTION for attention view", () => {
    expect(effectiveBandFilter("attention", "")).toBe("NEEDS_ATTENTION");
  });
});
