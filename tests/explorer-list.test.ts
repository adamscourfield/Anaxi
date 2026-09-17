import { describe, expect, it } from "vitest";
import type { StudentRiskRow } from "@/modules/analysis/studentRisk";
import {
  countBands,
  DEFAULT_VIEW_MODE,
  filterStudentRows,
  getPageSize,
  parseSortMode,
  parseStatusFilter,
  parseViewMode,
  effectiveBandFilter,
} from "@/modules/students/explorerList";

function row(overrides: Partial<StudentRiskRow>): StudentRiskRow {
  return {
    studentId: "s1",
    studentName: "Test Student",
    yearGroup: "Y10",
    status: "ACTIVE",
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
  it("defaults to the default view mode", () => {
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
      confidence: "",
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
      confidence: "",
      watchlistOnly: false,
      attendanceBelow80: false,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].studentName).toBe("Cara");
  });

  it("filters by confidence", () => {
    const mixed = [...rows, row({ studentId: "e", confidence: "LOW", studentName: "Eve" })];
    const filtered = filterStudentRows(mixed, {
      view: "all",
      band: "",
      yearGroup: "",
      studentSearch: "",
      send: "",
      pp: "",
      confidence: "LOW",
      watchlistOnly: false,
      attendanceBelow80: false,
    });
    expect(filtered.map((r) => r.studentId)).toEqual(["e"]);
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

describe("parseStatusFilter", () => {
  it("defaults to active for anything unrecognised", () => {
    expect(parseStatusFilter(undefined)).toBe("active");
    expect(parseStatusFilter("bogus")).toBe("active");
  });

  it("accepts archived and all", () => {
    expect(parseStatusFilter("archived")).toBe("archived");
    expect(parseStatusFilter("all")).toBe("all");
  });
});

describe("parseSortMode", () => {
  it("defaults to risk for anything unrecognised", () => {
    expect(parseSortMode(undefined)).toBe("risk");
    expect(parseSortMode("bogus")).toBe("risk");
  });

  it("accepts the attendance and name sort modes", () => {
    expect(parseSortMode("attendance_asc")).toBe("attendance_asc");
    expect(parseSortMode("attendance_desc")).toBe("attendance_desc");
    expect(parseSortMode("name")).toBe("name");
  });
});

describe("filterStudentRows sorting", () => {
  const rows = [
    row({ studentId: "a", studentName: "Amy", attendancePct: 95, band: "STABLE" }),
    row({ studentId: "b", studentName: "Bob", attendancePct: 70, band: "URGENT", riskScore: 9 }),
    row({ studentId: "c", studentName: "Cara", attendancePct: null, band: "STABLE" }),
  ];
  const baseFilters = {
    view: "all" as const,
    band: "",
    yearGroup: "",
    studentSearch: "",
    send: "",
    pp: "",
    confidence: "",
    watchlistOnly: false,
    attendanceBelow80: false,
  };

  it("sorts by attendance ascending, with no-data students at the bottom", () => {
    const sorted = filterStudentRows(rows, { ...baseFilters, sort: "attendance_asc" });
    expect(sorted.map((r) => r.studentId)).toEqual(["b", "a", "c"]);
  });

  it("sorts by attendance descending, with no-data students at the bottom", () => {
    const sorted = filterStudentRows(rows, { ...baseFilters, sort: "attendance_desc" });
    expect(sorted.map((r) => r.studentId)).toEqual(["a", "b", "c"]);
  });

  it("sorts by name", () => {
    const sorted = filterStudentRows(rows, { ...baseFilters, sort: "name" });
    expect(sorted.map((r) => r.studentId)).toEqual(["a", "b", "c"]);
  });

  it("falls back to the risk-based sort when no sort is given", () => {
    const sorted = filterStudentRows(rows, baseFilters);
    expect(sorted[0].studentId).toBe("b"); // URGENT band comes first
  });
});

describe("archived students are excluded from risk banding", () => {
  it("countBands ignores archived rows entirely", () => {
    const rows = [
      row({ studentId: "a", band: "URGENT" }),
      row({ studentId: "b", band: "STABLE", status: "ARCHIVED" }),
    ];
    expect(countBands(rows)).toEqual({ URGENT: 1, PRIORITY: 0, WATCH: 0, STABLE: 0 });
  });

  it("a band filter never matches an archived row, even if its placeholder band matches", () => {
    const rows = [
      row({ studentId: "a", band: "STABLE" }),
      row({ studentId: "b", band: "STABLE", status: "ARCHIVED" }),
    ];
    const filtered = filterStudentRows(rows, {
      view: "stable",
      band: "",
      yearGroup: "",
      studentSearch: "",
      send: "",
      pp: "",
      confidence: "",
      watchlistOnly: false,
      attendanceBelow80: false,
    });
    expect(filtered.map((r) => r.studentId)).toEqual(["a"]);
  });
});
