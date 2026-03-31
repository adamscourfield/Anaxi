import { describe, it, expect } from "vitest";
import {
  parseScore,
  competitionRank,
  parseAndRankAssessmentCsv,
} from "../ranking";

// ─── parseScore ───────────────────────────────────────────────────────────────

describe("parseScore", () => {
  it("parses a percentage string", () => {
    expect(parseScore("67%")).toBe(67);
  });

  it("parses 0%", () => {
    expect(parseScore("0%")).toBe(0);
  });

  it("parses 100%", () => {
    expect(parseScore("100%")).toBe(100);
  });

  it("returns null for Absent", () => {
    expect(parseScore("Absent")).toBeNull();
  });

  it("returns null for blank string", () => {
    expect(parseScore("")).toBeNull();
  });

  it("returns null for #VALUE! (Excel error)", () => {
    expect(parseScore("#VALUE!")).toBeNull();
  });

  it("returns null for N/A", () => {
    expect(parseScore("N/A")).toBeNull();
  });

  it("clamps values above 100 to 100", () => {
    expect(parseScore("150%")).toBe(100);
  });

  it("clamps negative values to 0", () => {
    expect(parseScore("-5%")).toBe(0);
  });

  it("handles numeric string without % suffix", () => {
    expect(parseScore("45")).toBe(45);
  });
});

// ─── competitionRank ──────────────────────────────────────────────────────────

describe("competitionRank", () => {
  it("ranks a simple list with no ties (highest score = rank 1)", () => {
    expect(competitionRank([90, 70, 50])).toEqual([1, 2, 3]);
  });

  it("handles ties with gap (1224 style)", () => {
    // Two students tied for 1st → both rank 1, next is rank 3
    expect(competitionRank([80, 80, 60])).toEqual([1, 1, 3]);
  });

  it("handles tie in the middle", () => {
    // 90→1, 70→2, 70→2, 50→4
    expect(competitionRank([90, 70, 70, 50])).toEqual([1, 2, 2, 4]);
  });

  it("handles all tied", () => {
    expect(competitionRank([60, 60, 60])).toEqual([1, 1, 1]);
  });

  it("assigns null rank to null scores", () => {
    expect(competitionRank([80, null, 60])).toEqual([1, null, 2]);
  });

  it("assigns null rank to all nulls", () => {
    expect(competitionRank([null, null])).toEqual([null, null]);
  });

  it("excludes nulls from rank numbering", () => {
    // null skipped; 80→1, 60→2
    expect(competitionRank([null, 80, null, 60])).toEqual([null, 1, null, 2]);
  });

  it("returns empty array for empty input", () => {
    expect(competitionRank([])).toEqual([]);
  });
});

// ─── parseAndRankAssessmentCsv ────────────────────────────────────────────────

const SIMPLE_CSV = `Name,Year Group,Teaching Group,SEN,PP,Maths Score,Maths Rank,English Score,English Rank,Overall Average,Overall Rank
Alice,Year 7,7A,No,No,80%,2,60%,1,70%,1
Bob,Year 7,7A,No,No,60%,1,40%,2,50%,2
Charlie,Year 7,7A,No,No,80%,2,60%,1,70%,1
`;

describe("parseAndRankAssessmentCsv — basic", () => {
  it("detects subjects from headers", () => {
    const { subjects } = parseAndRankAssessmentCsv(SIMPLE_CSV);
    expect(subjects).toEqual(["Maths", "English"]);
  });

  it("parses all students", () => {
    const { students } = parseAndRankAssessmentCsv(SIMPLE_CSV);
    expect(students).toHaveLength(3);
  });

  it("correctly identifies highest scorer per subject", () => {
    const { students } = parseAndRankAssessmentCsv(SIMPLE_CSV);
    const alice = students.find((s) => s.name === "Alice")!;
    // Alice has 80% Maths — tied for 1st
    expect(alice.subjectRanks["Maths"]).toBe(1);
    // Alice has 60% English — tied for 1st
    expect(alice.subjectRanks["English"]).toBe(1);
  });

  it("assigns tied ranks correctly", () => {
    const { students } = parseAndRankAssessmentCsv(SIMPLE_CSV);
    const alice = students.find((s) => s.name === "Alice")!;
    const charlie = students.find((s) => s.name === "Charlie")!;
    // Alice and Charlie both 80% Maths → both rank 1; Bob gets rank 3
    expect(alice.subjectRanks["Maths"]).toBe(1);
    expect(charlie.subjectRanks["Maths"]).toBe(1);
    const bob = students.find((s) => s.name === "Bob")!;
    expect(bob.subjectRanks["Maths"]).toBe(3);
  });

  it("computes overall average correctly", () => {
    const { students } = parseAndRankAssessmentCsv(SIMPLE_CSV);
    const alice = students.find((s) => s.name === "Alice")!;
    expect(alice.overallAverage).toBeCloseTo(70);
    const bob = students.find((s) => s.name === "Bob")!;
    expect(bob.overallAverage).toBeCloseTo(50);
  });

  it("computes overall rank (ignoring pre-existing values)", () => {
    const { students } = parseAndRankAssessmentCsv(SIMPLE_CSV);
    const bob = students.find((s) => s.name === "Bob")!;
    // Bob has lowest overall average → worst rank
    expect(bob.overallRank).toBe(3);
    const alice = students.find((s) => s.name === "Alice")!;
    const charlie = students.find((s) => s.name === "Charlie")!;
    // Alice and Charlie tied → both rank 1
    expect(alice.overallRank).toBe(1);
    expect(charlie.overallRank).toBe(1);
  });
});

// ─── Absent handling ──────────────────────────────────────────────────────────

const ABSENT_CSV = `Name,Year Group,Teaching Group,SEN,PP,Maths Score,Maths Rank,English Score,English Rank,Overall Average,Overall Rank
Alice,Year 7,7A,No,No,80%,,60%,,70%,
Bob,Year 7,7A,No,No,Absent,,40%,,40%,
Charlie,Year 7,7A,No,No,,,Absent,,,
`;

describe("parseAndRankAssessmentCsv — absent handling", () => {
  it("assigns null rank for absent subject", () => {
    const { students } = parseAndRankAssessmentCsv(ABSENT_CSV);
    const bob = students.find((s) => s.name === "Bob")!;
    expect(bob.subjectRanks["Maths"]).toBeNull();
  });

  it("only ranks students who have a score", () => {
    const { students } = parseAndRankAssessmentCsv(ABSENT_CSV);
    const alice = students.find((s) => s.name === "Alice")!;
    const bob = students.find((s) => s.name === "Bob")!;
    // Only Alice has Maths score → rank 1
    expect(alice.subjectRanks["Maths"]).toBe(1);
    // Bob absent for Maths → null; Alice also present → rank 1 for Maths, not 2
    expect(bob.subjectRanks["Maths"]).toBeNull();
  });

  it("computes overall average only from present subjects", () => {
    const { students } = parseAndRankAssessmentCsv(ABSENT_CSV);
    const bob = students.find((s) => s.name === "Bob")!;
    // Bob only has English (40%)
    expect(bob.overallAverage).toBeCloseTo(40);
  });

  it("assigns null overall average when all subjects absent", () => {
    const { students } = parseAndRankAssessmentCsv(ABSENT_CSV);
    const charlie = students.find((s) => s.name === "Charlie")!;
    expect(charlie.overallAverage).toBeNull();
    expect(charlie.overallRank).toBeNull();
  });
});

// ─── SEN / PP flags ───────────────────────────────────────────────────────────

const FLAG_CSV = `Name,Year Group,Teaching Group,SEN,PP,Maths Score,Maths Rank,Overall Average,Overall Rank
Alice,Year 7,7A,Yes,No,80%,,80%,
Bob,Year 7,7A,No,Yes,60%,,60%,
Charlie,Year 7,7A,No,No,40%,,40%,
`;

describe("parseAndRankAssessmentCsv — SEN and PP flags", () => {
  it("parses SEN=Yes as true", () => {
    const { students } = parseAndRankAssessmentCsv(FLAG_CSV);
    const alice = students.find((s) => s.name === "Alice")!;
    expect(alice.sen).toBe(true);
    expect(alice.pp).toBe(false);
  });

  it("parses PP=Yes as true", () => {
    const { students } = parseAndRankAssessmentCsv(FLAG_CSV);
    const bob = students.find((s) => s.name === "Bob")!;
    expect(bob.sen).toBe(false);
    expect(bob.pp).toBe(true);
  });

  it("parses No flags as false", () => {
    const { students } = parseAndRankAssessmentCsv(FLAG_CSV);
    const charlie = students.find((s) => s.name === "Charlie")!;
    expect(charlie.sen).toBe(false);
    expect(charlie.pp).toBe(false);
  });
});

// ─── Empty file ───────────────────────────────────────────────────────────────

describe("parseAndRankAssessmentCsv — edge cases", () => {
  it("returns empty result for header-only CSV", () => {
    const csv = `Name,Year Group,Teaching Group,SEN,PP,Maths Score,Maths Rank,Overall Average,Overall Rank\n`;
    const { students, subjects } = parseAndRankAssessmentCsv(csv);
    expect(students).toHaveLength(0);
    expect(subjects).toEqual(["Maths"]);
  });

  it("strips trailing blank rows from spreadsheet exports", () => {
    const csv = `Name,Year Group,Teaching Group,SEN,PP,Maths Score,Maths Rank,Overall Average,Overall Rank
Alice,Year 7,7A,No,No,80%,,80%,
,,,,,,,,
,,,,,,,,
`;
    const { students } = parseAndRankAssessmentCsv(csv);
    expect(students).toHaveLength(1);
  });

  it("produces no warnings for clean data", () => {
    const { warnings } = parseAndRankAssessmentCsv(SIMPLE_CSV);
    expect(warnings).toHaveLength(0);
  });

  it("warns on unrecognised score values like #VALUE!", () => {
    const csv = `Name,Year Group,Teaching Group,SEN,PP,Maths Score,Maths Rank,Overall Average,Overall Rank
Alice,Year 7,7A,No,No,#VALUE!,,80%,
`;
    const { warnings } = parseAndRankAssessmentCsv(csv);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].message).toMatch(/unrecognised/i);
  });
});
