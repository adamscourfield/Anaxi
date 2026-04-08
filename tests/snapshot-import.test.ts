import { describe, expect, it } from "vitest";
import {
  parseBoolean,
  parseAttendancePct,
  parseSnapshotCsv,
} from "@/modules/students/snapshot-import";
import { computeHeaderSignature, suggestMapping } from "@/modules/students/snapshot-fields";

describe("parseBoolean (snapshot-import)", () => {
  it("parses truthy values", () => {
    expect(parseBoolean("Yes")).toBe(true);
    expect(parseBoolean("yes")).toBe(true);
    expect(parseBoolean("y")).toBe(true);
    expect(parseBoolean("Y")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("TRUE")).toBe(true);
  });

  it("parses falsy values", () => {
    expect(parseBoolean("No")).toBe(false);
    expect(parseBoolean("no")).toBe(false);
    expect(parseBoolean("n")).toBe(false);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("false")).toBe(false);
    expect(parseBoolean("")).toBe(false);
  });
});

describe("parseAttendancePct (snapshot-import)", () => {
  it("parses plain percentage", () => {
    expect(parseAttendancePct("96.5")).toBe(96.5);
    expect(parseAttendancePct("100")).toBe(100);
    expect(parseAttendancePct("0")).toBe(0);
  });

  it("strips % sign", () => {
    expect(parseAttendancePct("96.5%")).toBe(96.5);
    expect(parseAttendancePct("100%")).toBe(100);
  });

  it("converts fractional 0–1 to percentage", () => {
    expect(parseAttendancePct("0.965")).toBe(96.5);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseAttendancePct("")).toBeNull();
    expect(parseAttendancePct("abc")).toBeNull();
    expect(parseAttendancePct("150")).toBeNull();
    expect(parseAttendancePct("-5")).toBeNull();
  });
});

describe("computeHeaderSignature", () => {
  it("produces a sorted lowercase pipe-joined signature", () => {
    const sig = computeHeaderSignature(["UPN", "Name", "YearGroup"]);
    expect(sig).toBe("name|upn|yeargroup");
  });

  it("is order-independent", () => {
    const sig1 = computeHeaderSignature(["A", "B", "C"]);
    const sig2 = computeHeaderSignature(["C", "A", "B"]);
    expect(sig1).toBe(sig2);
  });

  it("matches with same headers in different order", () => {
    const headers1 = ["UPN", "Attendance", "Name", "YearGroup"];
    const headers2 = ["Name", "YearGroup", "UPN", "Attendance"];
    expect(computeHeaderSignature(headers1)).toBe(computeHeaderSignature(headers2));
  });
});

describe("suggestMapping", () => {
  it("suggests UPN from common synonym", () => {
    const result = suggestMapping(["UPN", "Name", "YearGroup", "Attendance"]);
    expect(result.UPN).toBe("UPN");
  });

  it("suggests StudentName from 'Name'", () => {
    const result = suggestMapping(["UPN", "Name", "Year", "Attendance"]);
    expect(result.StudentName).toBe("Name");
  });

  it("suggests AttendancePercent from 'Attendance'", () => {
    const result = suggestMapping(["UPN", "Name", "YearGroup", "Attendance"]);
    expect(result.AttendancePercent).toBe("Attendance");
  });

  it("handles alternative synonyms", () => {
    const result = suggestMapping(["Unique Pupil Number", "Pupil Name", "Year Group", "Attendance%"]);
    expect(result.UPN).toBe("Unique Pupil Number");
    expect(result.StudentName).toBe("Pupil Name");
    expect(result.YearGroup).toBe("Year Group");
    expect(result.AttendancePercent).toBe("Attendance%");
  });
});

describe("parseSnapshotCsv", () => {
  const mapping = {
    fieldMap: {
      UPN: "UPN",
      StudentName: "Name",
      YearGroup: "YearGroup",
      AttendancePercent: "Attendance",
      Lates: "Lates",
      Detentions: "Detentions",
      InternalExclusions: "InternalExclusions",
      Suspensions: "Suspensions",
      OnCalls: "OnCalls",
      PositivePoints: "PositivePoints",
      SEND: "SEND",
      PP: "PP",
    },
    fixedCountScope: "TERM_TO_DATE" as const,
  };

  const validCsv = [
    "UPN,Name,YearGroup,Attendance,Lates,Detentions,InternalExclusions,Suspensions,OnCalls,PositivePoints,SEND,PP",
    "U001,Alice Jones,Y10,96.5,1,2,0,0,1,10,Yes,No",
  ].join("\n");

  it("parses a valid row", () => {
    const { rows, errors } = parseSnapshotCsv(validCsv, mapping);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].upn).toBe("U001");
    expect(rows[0].studentName).toBe("Alice Jones");
    expect(rows[0].attendancePercent).toBe(96.5);
    expect(rows[0].send).toBe(true);
    expect(rows[0].pp).toBe(false);
    expect(rows[0].countScope).toBe("TERM_TO_DATE");
  });

  it("errors on missing UPN", () => {
    const csv = [
      "UPN,Name,YearGroup,Attendance,Lates,Detentions,InternalExclusions,Suspensions,OnCalls,PositivePoints,SEND,PP",
      ",Alice Jones,Y10,96.5,1,2,0,0,1,10,Yes,No",
    ].join("\n");
    const { errors } = parseSnapshotCsv(csv, mapping);
    expect(errors.some((e) => e.errorCode === "MISSING_UPN")).toBe(true);
  });

  it("errors on duplicate UPN in file", () => {
    const csv = [
      "UPN,Name,YearGroup,Attendance,Lates,Detentions,InternalExclusions,Suspensions,OnCalls,PositivePoints,SEND,PP",
      "U001,Alice Jones,Y10,96.5,1,2,0,0,1,10,Yes,No",
      "U001,Alice Jones,Y10,96.5,1,2,0,0,1,10,Yes,No",
    ].join("\n");
    const { errors } = parseSnapshotCsv(csv, mapping);
    expect(errors.some((e) => e.errorCode === "DUPLICATE_UPN_IN_FILE")).toBe(true);
  });

  it("errors on invalid attendance", () => {
    const csv = [
      "UPN,Name,YearGroup,Attendance,Lates,Detentions,InternalExclusions,Suspensions,OnCalls,PositivePoints,SEND,PP",
      "U001,Alice,Y10,150%,1,2,0,0,1,10,No,No",
    ].join("\n");
    const { errors } = parseSnapshotCsv(csv, mapping);
    expect(errors.some((e) => e.errorCode === "INVALID_ATTENDANCE")).toBe(true);
  });

  it("errors when no countScope provided", () => {
    const noScopeMapping = { ...mapping, fixedCountScope: undefined };
    const { errors } = parseSnapshotCsv(validCsv, noScopeMapping);
    expect(errors.some((e) => e.errorCode === "MISSING_COUNTSCOPE")).toBe(true);
  });

  it("uses import date when no snapshotDate column", () => {
    const importDate = new Date("2026-01-15T10:00:00Z");
    const { rows } = parseSnapshotCsv(validCsv, mapping, importDate);
    expect(rows[0].snapshotDate.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
});
