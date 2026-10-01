import { describe, expect, it } from "vitest";
import { ks2ScoreUpdate, parseAttendancePct, parseStudentsCsv } from "@/modules/students/csv";

describe("students csv", () => {
  it("parses attendance variants", () => {
    expect(parseAttendancePct("96.5")).toBe(96.5);
    expect(parseAttendancePct("96.5%")).toBe(96.5);
    expect(parseAttendancePct("0.965")).toBe(96.5);
  });

  it("parses rows with mapping", () => {
    const csv = `UPN,Name,YearGroup,PositivePointsTotal,Detentions,InternalExclusions,Suspensions,Attendance,Lateness,OnCalls,SEND,PP,Status\nU1,Ada Lovelace,Y10,10,2,0,0,96.5,1,2,Yes,No,Active`;
    const mapping = {
      UPN: "UPN", Name: "Name", YearGroup: "YearGroup", PositivePointsTotal: "PositivePointsTotal", Detentions: "Detentions", InternalExclusions: "InternalExclusions", Suspensions: "Suspensions", Attendance: "Attendance", Lateness: "Lateness", OnCalls: "OnCalls", SEND: "SEND", PP: "PP", Status: "Status"
    };
    const result = parseStudentsCsv(csv, mapping);
    expect(result.errors).toHaveLength(0);
    expect(result.parsed[0].upn).toBe("U1");
    expect(result.parsed[0].sendFlag).toBe(true);
  });
});

describe("ks2ScoreUpdate", () => {
  it("omits scores the file didn't supply so stored values survive an update", () => {
    expect(ks2ScoreUpdate({ ks2ReadingScaledScore: null, ks2MathsScaledScore: null })).toEqual({});
  });

  it("writes only the scores that are present", () => {
    expect(ks2ScoreUpdate({ ks2ReadingScaledScore: 104, ks2MathsScaledScore: null })).toEqual({
      ks2ReadingScaledScore: 104,
    });
    expect(ks2ScoreUpdate({ ks2ReadingScaledScore: 99, ks2MathsScaledScore: 101 })).toEqual({
      ks2ReadingScaledScore: 99,
      ks2MathsScaledScore: 101,
    });
  });
});
