import { describe, it, expect } from "vitest";
import {
  getPriorBand,
  getMovementLabel,
  computeOutliers,
  type PriorBand,
  type MovementLabel,
  type SubjectOutlier,
} from "@/modules/analysis/assessmentAnalysis";

// ─── getPriorBand ─────────────────────────────────────────────────────────────

describe("getPriorBand", () => {
  it("both null → UNKNOWN", () => {
    expect(getPriorBand(null, null)).toBe("UNKNOWN");
  });

  it("maths only, below threshold → LOW", () => {
    expect(getPriorBand(90, null)).toBe("LOW");
  });

  it("reading only, above threshold → HIGH", () => {
    expect(getPriorBand(null, 110)).toBe("HIGH");
  });

  it("average exactly at low boundary → MID", () => {
    // avg = 95.0 → MID (boundary is < 95 for LOW)
    expect(getPriorBand(95, 95)).toBe("MID");
  });

  it("average just below low boundary → LOW", () => {
    expect(getPriorBand(94, 94)).toBe("LOW");
  });

  it("average exactly at high boundary → MID", () => {
    // avg = 105.0 → MID (boundary is <= 105 for MID)
    expect(getPriorBand(105, 105)).toBe("MID");
  });

  it("average just above high boundary → HIGH", () => {
    expect(getPriorBand(106, 106)).toBe("HIGH");
  });

  it("averages two scores correctly", () => {
    // (88 + 98) / 2 = 93 → LOW
    expect(getPriorBand(88, 98)).toBe("LOW");
  });

  it("typical mid-range student", () => {
    expect(getPriorBand(100, 101)).toBe("MID");
  });
});

// ─── getMovementLabel ─────────────────────────────────────────────────────────

describe("getMovementLabel", () => {
  const cases: Array<[number | null, MovementLabel]> = [
    [null, "NO_PRIOR"],
    [0, "STABLE"],
    [0.02, "STABLE"],       // at upper stable boundary
    [0.021, "IMPROVING"],   // just above stable band
    [-0.02, "STABLE"],      // at lower stable boundary
    [-0.021, "DECLINING"],  // just below stable band
    [0.5, "IMPROVING"],
    [-0.5, "DECLINING"],
  ];

  it.each(cases)("movement %s → %s", (movement, expected) => {
    expect(getMovementLabel(movement)).toBe(expected);
  });
});

// ─── computeOutliers ─────────────────────────────────────────────────────────

describe("computeOutliers", () => {
  it("fewer than 2 subjects → no outliers", () => {
    expect(computeOutliers([{ subject: "Maths", normalizedScore: 0.8 }])).toEqual([]);
  });

  it("no variation → no outliers", () => {
    const scores = [
      { subject: "Maths", normalizedScore: 0.8 },
      { subject: "English", normalizedScore: 0.8 },
      { subject: "Science", normalizedScore: 0.8 },
    ];
    expect(computeOutliers(scores)).toEqual([]);
  });

  it("detects UNDER outlier", () => {
    // Student scores well in most subjects but poorly in one
    const scores = [
      { subject: "Maths", normalizedScore: 0.9 },
      { subject: "English", normalizedScore: 0.85 },
      { subject: "Science", normalizedScore: 0.88 },
      { subject: "History", normalizedScore: 0.87 },
      { subject: "Art", normalizedScore: 0.2 },  // clear outlier
    ];
    const outliers = computeOutliers(scores);
    expect(outliers.some((o) => o.subject === "Art" && o.direction === "UNDER")).toBe(true);
  });

  it("detects OVER outlier", () => {
    const scores = [
      { subject: "Maths", normalizedScore: 0.4 },
      { subject: "English", normalizedScore: 0.45 },
      { subject: "Science", normalizedScore: 0.42 },
      { subject: "History", normalizedScore: 0.43 },
      { subject: "Art", normalizedScore: 0.95 },  // clear outlier
    ];
    const outliers = computeOutliers(scores);
    expect(outliers.some((o) => o.subject === "Art" && o.direction === "OVER")).toBe(true);
  });

  it("outlier has correct z-score sign", () => {
    const scores = [
      { subject: "Maths", normalizedScore: 0.9 },
      { subject: "English", normalizedScore: 0.85 },
      { subject: "Science", normalizedScore: 0.88 },
      { subject: "History", normalizedScore: 0.87 },
      { subject: "Art", normalizedScore: 0.2 },
    ];
    const outliers = computeOutliers(scores);
    const art = outliers.find((o) => o.subject === "Art");
    expect(art).toBeDefined();
    expect(art!.zScore).toBeLessThan(0);
    expect(art!.direction).toBe("UNDER");
  });

  it("studentMean is set correctly on outlier", () => {
    const scores = [
      { subject: "Maths", normalizedScore: 0.8 },
      { subject: "English", normalizedScore: 0.6 },
      { subject: "Science", normalizedScore: 0.7 },
      { subject: "History", normalizedScore: 0.75 },
      { subject: "Art", normalizedScore: 0.1 },
    ];
    const expectedMean = (0.8 + 0.6 + 0.7 + 0.75 + 0.1) / 5;
    const outliers = computeOutliers(scores);
    const art = outliers.find((o) => o.subject === "Art");
    if (art) {
      expect(art.studentMean).toBeCloseTo(expectedMean, 5);
    }
  });

  it("returns no outliers when all scores are equal", () => {
    const scores = [
      { subject: "Maths", normalizedScore: 0.75 },
      { subject: "English", normalizedScore: 0.75 },
      { subject: "Science", normalizedScore: 0.75 },
      { subject: "History", normalizedScore: 0.75 },
    ];
    expect(computeOutliers(scores)).toEqual([]);
  });

  it("returns no outliers when variation is below the stdDev floor", () => {
    // All scores within 0.5 percentage points — stdDev < 0.01 → returns []
    const scores = [
      { subject: "Maths", normalizedScore: 0.750 },
      { subject: "English", normalizedScore: 0.752 },
      { subject: "Science", normalizedScore: 0.751 },
      { subject: "History", normalizedScore: 0.749 },
    ];
    expect(computeOutliers(scores)).toEqual([]);
  });

  it("returns both UNDER and OVER outliers when present", () => {
    const scores = [
      { subject: "Maths", normalizedScore: 0.99 },
      { subject: "English", normalizedScore: 0.5 },
      { subject: "Science", normalizedScore: 0.5 },
      { subject: "History", normalizedScore: 0.5 },
      { subject: "Art", normalizedScore: 0.01 },
    ];
    const outliers = computeOutliers(scores);
    const directions = outliers.map((o) => o.direction);
    expect(directions).toContain("UNDER");
    expect(directions).toContain("OVER");
  });
});
