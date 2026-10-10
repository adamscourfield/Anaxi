import { describe, expect, it } from "vitest";
import { planKs2Backfill, type Ks2Student } from "@/lib/integrations/arbor/ks2PriorAttainment";
const student: Ks2Student = { id: "local", tenantId: "school", externalId: "arbor-1", ks2ReadingScaledScore: null, ks2MathsScaledScore: null };
describe("Arbor KS2 backfill", () => {
  it("joins by Arbor external ID and retains separate reading and maths scores", () => {
    const plan = planKs2Backfill([student], [
      { studentExternalId: "arbor-1", subject: "reading", score: 101 },
      { studentExternalId: "arbor-1", subject: "maths", score: 104 },
      { studentExternalId: "another", subject: "reading", score: 120 },
    ]);
    expect(plan.updates[0].data).toEqual({ ks2ReadingScaledScore: 101, ks2MathsScaledScore: 104 });
  });
  it("preserves existing scores and rejects conflicting marks", () => {
    const plan = planKs2Backfill([{ ...student, ks2ReadingScaledScore: 99 }], [
      { studentExternalId: "arbor-1", subject: "reading", score: 101 },
      { studentExternalId: "arbor-1", subject: "maths", score: 104 },
      { studentExternalId: "arbor-1", subject: "maths", score: 105 },
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.preserved).toBe(1);
    expect(plan.conflicts).toBe(1);
  });
  it("deduplicates identical marks and rejects raw marks outside the scaled range", () => {
    const plan = planKs2Backfill([student], [
      { studentExternalId: "arbor-1", subject: "reading", score: 101 },
      { studentExternalId: "arbor-1", subject: "reading", score: 101 },
      { studentExternalId: "arbor-1", subject: "maths", score: 65 },
    ]);
    expect(plan.updates[0].data).toEqual({ ks2ReadingScaledScore: 101 });
    expect(plan.invalid).toBe(1);
  });
});

import { ks2DefinitionSubject, ks2MarkScore, type Ks2Definition } from "@/lib/integrations/arbor/ks2Source";
const definition: Ks2Definition = { id: "ks2", assessmentName: "KS2: Reading test scaled score", assessmentShortName: null, displayName: null, code: null, markMinValue: 80, markMaxValue: 120 };
describe("Arbor KS2 source mapping", () => {
  it("accepts only KS2 reading and maths scaled definitions", () => {
    expect(ks2DefinitionSubject(definition)).toBe("reading");
    expect(ks2DefinitionSubject({ ...definition, assessmentName: "KS2: Mathematics scaled score" })).toBe("maths");
    expect(ks2DefinitionSubject({ ...definition, assessmentName: "KS1: Reading scaled score" })).toBeNull();
    expect(ks2DefinitionSubject({ ...definition, assessmentName: "KS2: Grammar scaled score" })).toBeNull();
    expect(ks2DefinitionSubject({ ...definition, assessmentName: "KS2: Reading raw mark", markMinValue: 0, markMaxValue: 120 })).toBeNull();
  });
  it("accepts DfE coded scaled definitions", () => {
    expect(ks2DefinitionSubject({ ...definition, assessmentName: null, code: "UK_DFE__KS2__MAT__SS", markMinValue: null, markMaxValue: null })).toBe("maths");
  });
  it("uses actual integer, decimal or numeric grade labels without interpreting attainment categories", () => {
    expect(ks2MarkScore({ markInteger: 101, markDecimal: null, markGrade: null })).toBe(101);
    expect(ks2MarkScore({ markInteger: null, markDecimal: 102, markGrade: null })).toBe(102);
    expect(ks2MarkScore({ markInteger: null, markDecimal: null, markGrade: { shortName: "104", displayName: "104" } })).toBe(104);
    expect(ks2MarkScore({ markInteger: null, markDecimal: null, markGrade: { shortName: "EXS", displayName: "Expected standard" } })).toBeNull();
    expect(ks2MarkScore({ markInteger: 65, markDecimal: null, markGrade: null })).toBeNull();
  });
});
