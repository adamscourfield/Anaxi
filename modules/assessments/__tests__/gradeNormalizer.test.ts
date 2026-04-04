import { describe, it, expect } from "vitest";
import {
  normalizeGrade,
  normalizeThreshold,
  validateGrade,
  detectNonGradeStatus,
  displayGrade,
  hasRecordedGrade,
} from "../gradeNormalizer";

// ─── GCSE ─────────────────────────────────────────────────────────────────────

describe("normalizeGrade — GCSE", () => {
  it("normalizes grade 9 to 1.0", () => {
    expect(normalizeGrade("9", "GCSE")).toBeCloseTo(1.0);
  });

  it("normalizes grade 4 to ~0.444", () => {
    expect(normalizeGrade("4", "GCSE")).toBeCloseTo(4 / 9);
  });

  it("normalizes grade 1 to ~0.111", () => {
    expect(normalizeGrade("1", "GCSE")).toBeCloseTo(1 / 9);
  });

  it("normalizes grade 0 to 0.0", () => {
    expect(normalizeGrade("0", "GCSE")).toBeCloseTo(0.0);
  });

  it("returns null for non-numeric input", () => {
    expect(normalizeGrade("X", "GCSE")).toBeNull();
  });

  it("clamps values above 9", () => {
    expect(normalizeGrade("10", "GCSE")).toBeCloseTo(1.0);
  });
});

// ─── A Level ──────────────────────────────────────────────────────────────────

describe("normalizeGrade — A_LEVEL", () => {
  it("normalizes A* to 1.0", () => {
    expect(normalizeGrade("A*", "A_LEVEL")).toBeCloseTo(1.0);
  });

  it("normalizes A to 6/7", () => {
    expect(normalizeGrade("A", "A_LEVEL")).toBeCloseTo(6 / 7);
  });

  it("normalizes C to 4/7", () => {
    expect(normalizeGrade("C", "A_LEVEL")).toBeCloseTo(4 / 7);
  });

  it("normalizes U to 0.0", () => {
    expect(normalizeGrade("U", "A_LEVEL")).toBeCloseTo(0.0);
  });

  it("is case-insensitive", () => {
    expect(normalizeGrade("a*", "A_LEVEL")).toBeCloseTo(1.0);
    expect(normalizeGrade("c", "A_LEVEL")).toBeCloseTo(4 / 7);
  });

  it("returns null for invalid grade", () => {
    expect(normalizeGrade("Z", "A_LEVEL")).toBeNull();
  });
});

// ─── Percentage ───────────────────────────────────────────────────────────────

describe("normalizeGrade — PERCENTAGE", () => {
  it("normalizes 100 to 1.0", () => {
    expect(normalizeGrade("100", "PERCENTAGE")).toBeCloseTo(1.0);
  });

  it("normalizes 70 to 0.70", () => {
    expect(normalizeGrade("70", "PERCENTAGE")).toBeCloseTo(0.70);
  });

  it("normalizes 0 to 0.0", () => {
    expect(normalizeGrade("0", "PERCENTAGE")).toBeCloseTo(0.0);
  });

  it("strips trailing % symbol", () => {
    expect(normalizeGrade("73%", "PERCENTAGE")).toBeCloseTo(0.73);
  });

  it("returns null for non-numeric input", () => {
    expect(normalizeGrade("abc", "PERCENTAGE")).toBeNull();
  });
});

// ─── Raw ──────────────────────────────────────────────────────────────────────

describe("normalizeGrade — RAW", () => {
  it("normalizes full score to 1.0", () => {
    expect(normalizeGrade("80", "RAW", 80)).toBeCloseTo(1.0);
  });

  it("normalizes 60/80 to 0.75", () => {
    expect(normalizeGrade("60", "RAW", 80)).toBeCloseTo(0.75);
  });

  it("normalizes 0 to 0.0", () => {
    expect(normalizeGrade("0", "RAW", 80)).toBeCloseTo(0.0);
  });

  it("returns null when maxScore is missing", () => {
    expect(normalizeGrade("60", "RAW", null)).toBeNull();
    expect(normalizeGrade("60", "RAW", 0)).toBeNull();
  });

  it("clamps values above maxScore", () => {
    expect(normalizeGrade("90", "RAW", 80)).toBeCloseTo(1.0);
  });
});

// ─── Threshold normalisation ──────────────────────────────────────────────────

describe("normalizeThreshold", () => {
  it("normalizes GCSE threshold '4' correctly", () => {
    expect(normalizeThreshold("4", "GCSE")).toBeCloseTo(4 / 9);
  });

  it("normalizes A_LEVEL threshold 'C' correctly", () => {
    expect(normalizeThreshold("C", "A_LEVEL")).toBeCloseTo(4 / 7);
  });

  it("normalizes PERCENTAGE threshold '70' correctly", () => {
    expect(normalizeThreshold("70", "PERCENTAGE")).toBeCloseTo(0.70);
  });
});

// ─── validateGrade ────────────────────────────────────────────────────────────

describe("validateGrade", () => {
  it("passes valid GCSE grades", () => {
    expect(validateGrade("7", "GCSE")).toBeNull();
    expect(validateGrade("1", "GCSE")).toBeNull();
    expect(validateGrade("9", "GCSE")).toBeNull();
  });

  it("fails GCSE grade > 9", () => {
    expect(validateGrade("10", "GCSE")).not.toBeNull();
  });

  it("fails GCSE non-numeric", () => {
    expect(validateGrade("A", "GCSE")).not.toBeNull();
  });

  it("passes valid A-Level grades", () => {
    expect(validateGrade("A*", "A_LEVEL")).toBeNull();
    expect(validateGrade("E", "A_LEVEL")).toBeNull();
    expect(validateGrade("U", "A_LEVEL")).toBeNull();
  });

  it("fails invalid A-Level grade", () => {
    expect(validateGrade("F", "A_LEVEL")).not.toBeNull();
    expect(validateGrade("9", "A_LEVEL")).not.toBeNull();
  });

  it("passes valid percentages", () => {
    expect(validateGrade("0", "PERCENTAGE")).toBeNull();
    expect(validateGrade("100", "PERCENTAGE")).toBeNull();
    expect(validateGrade("73.5", "PERCENTAGE")).toBeNull();
  });

  it("fails invalid percentages", () => {
    expect(validateGrade("101", "PERCENTAGE")).not.toBeNull();
    expect(validateGrade("-1", "PERCENTAGE")).not.toBeNull();
  });

  it("fails RAW without maxScore", () => {
    expect(validateGrade("50", "RAW", null)).not.toBeNull();
  });

  it("passes valid RAW score within maxScore", () => {
    expect(validateGrade("50", "RAW", 80)).toBeNull();
  });

  it("fails RAW score above maxScore", () => {
    expect(validateGrade("90", "RAW", 80)).not.toBeNull();
  });
});

// ─── detectNonGradeStatus ─────────────────────────────────────────────────────

describe("detectNonGradeStatus", () => {
  it("detects absent markers", () => {
    expect(detectNonGradeStatus("ABS")).toBe("ABSENT");
    expect(detectNonGradeStatus("abs")).toBe("ABSENT");
    expect(detectNonGradeStatus("N/A")).toBe("ABSENT");
    expect(detectNonGradeStatus("-")).toBe("ABSENT");
  });

  it("detects withdrawn markers", () => {
    expect(detectNonGradeStatus("W")).toBe("WITHDRAWN");
    expect(detectNonGradeStatus("WD")).toBe("WITHDRAWN");
    expect(detectNonGradeStatus("Withdrawn")).toBe("WITHDRAWN");
  });

  it("returns null for real grade values", () => {
    expect(detectNonGradeStatus("7")).toBeNull();
    expect(detectNonGradeStatus("A*")).toBeNull();
    expect(detectNonGradeStatus("73")).toBeNull();
  });
});

// ─── hasRecordedGrade ─────────────────────────────────────────────────────────

describe("hasRecordedGrade", () => {
  it("is false for absent-style placeholders", () => {
    expect(hasRecordedGrade("-", "GCSE")).toBe(false);
    expect(hasRecordedGrade("N/A", "A_LEVEL")).toBe(false);
  });

  it("is false when normalisation fails", () => {
    expect(hasRecordedGrade("", "GCSE")).toBe(false);
    expect(hasRecordedGrade("Z", "A_LEVEL")).toBe(false);
  });

  it("is true for valid grades", () => {
    expect(hasRecordedGrade("7", "GCSE")).toBe(true);
    expect(hasRecordedGrade("B", "A_LEVEL")).toBe(true);
    expect(hasRecordedGrade("U", "A_LEVEL")).toBe(true);
  });
});

// ─── displayGrade ─────────────────────────────────────────────────────────────

describe("displayGrade", () => {
  it("displays GCSE grades", () => {
    expect(displayGrade(1.0, "GCSE")).toBe("9");
    expect(displayGrade(4 / 9, "GCSE")).toBe("4");
  });

  it("displays A-Level grades", () => {
    expect(displayGrade(1.0, "A_LEVEL")).toBe("A*");
    expect(displayGrade(0, "A_LEVEL")).toBe("U");
  });

  it("displays percentages", () => {
    expect(displayGrade(0.73, "PERCENTAGE")).toBe("73%");
  });

  it("displays raw scores", () => {
    expect(displayGrade(0.75, "RAW", 80)).toBe("60");
  });
});
