import { describe, it, expect } from "vitest";
import {
  pearsonR,
  correlationStrength,
} from "@/modules/analysis/attainmentBehaviourCorrelation";

describe("pearsonR", () => {
  it("returns null for fewer than 2 elements", () => {
    expect(pearsonR([], [])).toBeNull();
    expect(pearsonR([1], [1])).toBeNull();
  });

  it("returns null for mismatched lengths", () => {
    expect(pearsonR([1, 2, 3], [1, 2])).toBeNull();
  });

  it("returns null when denominator is zero (no variance)", () => {
    expect(pearsonR([5, 5, 5], [1, 2, 3])).toBeNull();
    expect(pearsonR([1, 2, 3], [5, 5, 5])).toBeNull();
  });

  it("returns 1 for perfect positive correlation", () => {
    const r = pearsonR([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(r).toBeCloseTo(1.0, 5);
  });

  it("returns -1 for perfect negative correlation", () => {
    const r = pearsonR([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
    expect(r).toBeCloseTo(-1.0, 5);
  });

  it("returns moderate correlation for weakly related data", () => {
    // [1,2,3,4] vs [2,1,4,3] → r = 0.6 (verified)
    const r = pearsonR([1, 2, 3, 4], [2, 1, 4, 3]);
    expect(r).toBeCloseTo(0.6, 5);
  });

  it("returns correct correlation for known values", () => {
    // xs=[1,2,3], ys=[1,3,2] → r ≈ 0.5
    const r = pearsonR([1, 2, 3], [1, 3, 2]);
    expect(r).toBeCloseTo(0.5, 5);
  });

  it("handles floating point inputs", () => {
    const r = pearsonR([0.1, 0.5, 0.9], [0.2, 0.6, 0.8]);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0.9);
  });
});

describe("correlationStrength", () => {
  it("classifies strong positive (r >= 0.5)", () => {
    expect(correlationStrength(0.5)).toBe("STRONG_POSITIVE");
    expect(correlationStrength(0.9)).toBe("STRONG_POSITIVE");
    expect(correlationStrength(1.0)).toBe("STRONG_POSITIVE");
  });

  it("classifies moderate positive (0.1 <= r < 0.5)", () => {
    expect(correlationStrength(0.1)).toBe("MODERATE_POSITIVE");
    expect(correlationStrength(0.3)).toBe("MODERATE_POSITIVE");
    expect(correlationStrength(0.49)).toBe("MODERATE_POSITIVE");
  });

  it("classifies weak (|r| < 0.1)", () => {
    expect(correlationStrength(0.0)).toBe("WEAK");
    expect(correlationStrength(0.05)).toBe("WEAK");
    expect(correlationStrength(-0.09)).toBe("WEAK");
  });

  it("classifies strong negative (r <= -0.5)", () => {
    expect(correlationStrength(-0.5)).toBe("STRONG_NEGATIVE");
    expect(correlationStrength(-0.8)).toBe("STRONG_NEGATIVE");
    expect(correlationStrength(-1.0)).toBe("STRONG_NEGATIVE");
  });

  it("classifies moderate negative (-0.5 < r <= -0.1)", () => {
    expect(correlationStrength(-0.1)).toBe("MODERATE_NEGATIVE");
    expect(correlationStrength(-0.3)).toBe("MODERATE_NEGATIVE");
    expect(correlationStrength(-0.49)).toBe("MODERATE_NEGATIVE");
  });

  it("boundary: exactly 0.5 is STRONG_POSITIVE not MODERATE_POSITIVE", () => {
    expect(correlationStrength(0.5)).toBe("STRONG_POSITIVE");
  });

  it("boundary: exactly -0.5 is STRONG_NEGATIVE not MODERATE_NEGATIVE", () => {
    expect(correlationStrength(-0.5)).toBe("STRONG_NEGATIVE");
  });
});
