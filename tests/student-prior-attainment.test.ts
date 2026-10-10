import { describe, expect, it } from "vitest";
import { priorAttainmentSchema } from "@/modules/students/priorAttainment";

describe("student prior attainment validation", () => {
  it("accepts both boundaries and converts scores to numbers", () => {
    expect(priorAttainmentSchema.parse({ ks2ReadingScaledScore: "80", ks2MathsScaledScore: "120" }))
      .toEqual({ ks2ReadingScaledScore: 80, ks2MathsScaledScore: 120 });
  });
  it("allows missing scores to be cleared without treating them as zero", () => {
    expect(priorAttainmentSchema.parse({ ks2ReadingScaledScore: "", ks2MathsScaledScore: "101" }))
      .toEqual({ ks2ReadingScaledScore: null, ks2MathsScaledScore: 101 });
  });
  it.each(["79", "121", "100.5", "abc", "1e2", " "])("rejects invalid score %s", (score) => {
    expect(priorAttainmentSchema.safeParse({ ks2ReadingScaledScore: score, ks2MathsScaledScore: "100" }).success).toBe(false);
  });
});
