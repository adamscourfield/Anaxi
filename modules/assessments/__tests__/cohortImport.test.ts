import { describe, expect, it } from "vitest";
import { parseAssessmentCsv } from "../csv";

describe("assessment cohort CSV data", () => {
  it("preserves term-specific Yes and No without treating metadata as subjects", () => {
    const result = parseAssessmentCsv("UPN,Name,PP,SEN,Maths\nA,Alice,Yes,No,5\nB,Bob,No,Yes,3", { gradeFormat: "GCSE" });
    expect(result.errors).toEqual([]);
    expect(result.detectedSubjects).toEqual(["Maths"]);
    expect(result.records).toEqual([
      expect.objectContaining({ upn: "A", ppFlag: true, sendFlag: false }),
      expect.objectContaining({ upn: "B", ppFlag: false, sendFlag: true }),
    ]);
  });
  it("leaves absent flags unspecified for profile fallback and grade-only reimports", () => {
    const result = parseAssessmentCsv("UPN,Name,PP,SEND,Maths\nA,Alice,,,5", { gradeFormat: "GCSE" });
    expect(result.records[0]).not.toHaveProperty("ppFlag");
    expect(result.records[0]).not.toHaveProperty("sendFlag");
  });
  it("accepts cohort columns in long format", () => {
    const result = parseAssessmentCsv("UPN,Name,Subject,Grade,PP,SEND\nA,Alice,Maths,5,No,Yes", { gradeFormat: "GCSE" });
    expect(result.records[0]).toMatchObject({ ppFlag: false, sendFlag: true });
  });
});
