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

/** Year-group stats where every subject has mean 0.6 and SD 0.1, unless overridden. */
function cohort(subject: string, score: number, mean = 0.6, sd = 0.1, size = 30) {
  return { subject, normalizedScore: score, cohortMean: mean, cohortStdDev: sd, cohortSize: size };
}

describe("computeOutliers", () => {
  it("needs at least four comparable subjects", () => {
    expect(computeOutliers([cohort("Maths", 0.9), cohort("English", 0.6), cohort("Art", 0.1)])).toEqual([]);
  });

  it("ignores subjects with too few students or no spread to compare against", () => {
    const scores = [cohort("Maths", 0.7), cohort("English", 0.7), cohort("Science", 0.7), cohort("History", 0.7, 0.6, 0.1, 5), cohort("Art", 0.1, 0.6, 0.001)];
    expect(computeOutliers(scores)).toEqual([]);
  });

  it("flags a subject far behind the student's usual standing", () => {
    // One SD above the year group everywhere except Art, where they are 1.5 SD below.
    const scores = [cohort("Maths", 0.7), cohort("English", 0.7), cohort("Science", 0.7), cohort("History", 0.7), cohort("Art", 0.45)];
    const art = computeOutliers(scores).find((o) => o.subject === "Art");
    expect(art?.direction).toBe("UNDER");
    expect(art!.zScore).toBeLessThan(-1.5);
  });

  it("flags a subject far ahead of the student's usual standing", () => {
    const scores = [cohort("Maths", 0.5), cohort("English", 0.5), cohort("Science", 0.5), cohort("History", 0.5), cohort("Art", 0.8)];
    expect(computeOutliers(scores).map((o) => [o.subject, o.direction])).toEqual([["Art", "OVER"]]);
  });

  it("allows for a subject that was marked harder for everyone", () => {
    // Raw Physics score is far below the student's other subjects, but the whole year group
    // scored low in Physics, so the student sits in the same place as everywhere else.
    const scores = [cohort("Maths", 0.7), cohort("English", 0.7), cohort("Science", 0.7), cohort("History", 0.7), cohort("Physics", 0.4, 0.3)];
    expect(computeOutliers(scores)).toEqual([]);
  });

  it("doesn't flag ordinary variation", () => {
    const scores = [cohort("Maths", 0.72), cohort("English", 0.64), cohort("Science", 0.69), cohort("History", 0.6), cohort("Art", 0.66)];
    expect(computeOutliers(scores)).toEqual([]);
  });

  it("reports the student's own mean alongside each outlier", () => {
    const scores = [cohort("Maths", 0.7), cohort("English", 0.7), cohort("Science", 0.7), cohort("History", 0.7), cohort("Art", 0.45)];
    const art = computeOutliers(scores).find((o) => o.subject === "Art");
    expect(art!.studentMean).toBeCloseTo((0.7 * 4 + 0.45) / 5, 5);
  });
});
