import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
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
    // csv-parse consumes the header row as column definitions, leaving no data
    // rows to inspect, so subjects cannot be inferred
    expect(subjects).toEqual([]);
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

// ─── computeRanks option ──────────────────────────────────────────────────────

describe("parseAndRankAssessmentCsv — computeRanks option", () => {
  it("computes ranks by default (no option passed)", () => {
    const { students, ranksComputed } = parseAndRankAssessmentCsv(SIMPLE_CSV);
    expect(ranksComputed).toBe(true);
    const alice = students.find((s) => s.name === "Alice")!;
    expect(alice.subjectRanks["Maths"]).not.toBeNull();
    expect(alice.overallRank).not.toBeNull();
  });

  it("skips rank computation when computeRanks is false", () => {
    const { students, ranksComputed } = parseAndRankAssessmentCsv(SIMPLE_CSV, {
      computeRanks: false,
    });
    expect(ranksComputed).toBe(false);
    students.forEach((student) => {
      expect(student.overallRank).toBeNull();
      for (const rank of Object.values(student.subjectRanks)) {
        expect(rank).toBeNull();
      }
    });
  });

  it("still parses scores and overall average when computeRanks is false", () => {
    const { students } = parseAndRankAssessmentCsv(SIMPLE_CSV, {
      computeRanks: false,
    });
    const alice = students.find((s) => s.name === "Alice")!;
    expect(alice.scores["Maths"]).toBe(80);
    expect(alice.scores["English"]).toBe(60);
    expect(alice.overallAverage).toBeCloseTo(70);
  });

  it("still includes subject rank keys (all null) when computeRanks is false", () => {
    const { students, subjects } = parseAndRankAssessmentCsv(SIMPLE_CSV, {
      computeRanks: false,
    });
    const alice = students.find((s) => s.name === "Alice")!;
    // Keys exist for all detected subjects
    for (const subject of subjects) {
      expect(Object.keys(alice.subjectRanks)).toContain(subject);
      expect(alice.subjectRanks[subject]).toBeNull();
    }
  });

  it("computeRanks: true explicitly is equivalent to the default", () => {
    const withDefault = parseAndRankAssessmentCsv(SIMPLE_CSV);
    const withTrue = parseAndRankAssessmentCsv(SIMPLE_CSV, { computeRanks: true });
    expect(withTrue.ranksComputed).toBe(true);
    withTrue.students.forEach((student, i) => {
      expect(student.overallRank).toBe(withDefault.students[i].overallRank);
    });
  });
});

// ─── Year 7 Analysis CSV (real file) ─────────────────────────────────────────

const YEAR7_CSV = readFileSync(
  join(__dirname, "../../../design/Year 7 Analysis - Year 7.csv"),
  "utf-8"
);

describe("parseAndRankAssessmentCsv — Year 7 Analysis (% format, real file)", () => {
  it("detects all 10 subject columns", () => {
    const { subjects } = parseAndRankAssessmentCsv(YEAR7_CSV);
    expect(subjects).toEqual([
      "English", "Maths", "Science", "Geography", "History",
      "French", "RE", "Music", "Graphics", "Art",
    ]);
  });

  it("parses all 123 student rows", () => {
    const { students } = parseAndRankAssessmentCsv(YEAR7_CSV);
    expect(students).toHaveLength(123);
  });

  it("produces no warnings for 'Not enrolled' cells", () => {
    const { warnings } = parseAndRankAssessmentCsv(YEAR7_CSV);
    const notEnrolledWarnings = warnings.filter((w) =>
      w.message.toLowerCase().includes("not enrolled")
    );
    expect(notEnrolledWarnings).toHaveLength(0);
  });

  it("treats 'Not enrolled' as null score (excluded from ranking)", () => {
    const { students } = parseAndRankAssessmentCsv(YEAR7_CSV);
    const rimsha = students.find((s) => s.name === "Rimsha Hussain")!;
    // Rimsha has "Not enrolled" for Geography, History, RE
    expect(rimsha.scores["Geography"]).toBeNull();
    expect(rimsha.scores["History"]).toBeNull();
    expect(rimsha.scores["RE"]).toBeNull();
    expect(rimsha.subjectRanks["Geography"]).toBeNull();
  });

  it("parses percentage scores correctly", () => {
    const { students } = parseAndRankAssessmentCsv(YEAR7_CSV);
    const isaac = students.find((s) => s.name === "Isaac Machado")!;
    expect(isaac.scores["English"]).toBe(25);
    expect(isaac.scores["Maths"]).toBe(56);
    expect(isaac.scores["Graphics"]).toBe(80);
  });

  it("assigns rank 1 to highest Maths scorers (tied at 100%)", () => {
    const { students } = parseAndRankAssessmentCsv(YEAR7_CSV);
    // Ethan Ralphs, Radhika Kulkarni, Gabriele Stravinskaite all scored 100% in Maths
    const topMaths = ["Ethan Ralphs", "Radhika Kulkarni", "Gabriele Stravinskaite"];
    for (const name of topMaths) {
      const student = students.find((s) => s.name === name)!;
      expect(student.scores["Maths"]).toBe(100);
      expect(student.subjectRanks["Maths"]).toBe(1);
    }
  });

  it("gaps ranks correctly after ties (4th Maths scorer gets rank 4)", () => {
    const { students } = parseAndRankAssessmentCsv(YEAR7_CSV);
    // Three students tied at rank 1 (100%), so next rank is 4
    const rank4Students = students.filter((s) => s.subjectRanks["Maths"] === 4);
    expect(rank4Students.length).toBeGreaterThan(0);
    for (const s of rank4Students) {
      expect(s.scores["Maths"]).toBeLessThan(100);
    }
  });

  it("computes overall average from present subjects only", () => {
    const { students } = parseAndRankAssessmentCsv(YEAR7_CSV);
    // Adam Shah: 82,88,50,70,89,97,60,98,70,8 → mean = 71.2
    const adam = students.find((s) => s.name === "Adam Shah")!;
    expect(adam.overallAverage).toBeCloseTo(71.2, 1);
  });

  it("ignores the pre-existing Overall Average column", () => {
    // The CSV has an 'Overall Average' column; it must not appear as a subject
    const { subjects } = parseAndRankAssessmentCsv(YEAR7_CSV);
    expect(subjects).not.toContain("Overall");
    expect(subjects).not.toContain("Overall Average");
  });

  it("excludes meta columns (Attendance, DTAs, etc.) from subjects", () => {
    const { subjects } = parseAndRankAssessmentCsv(YEAR7_CSV);
    for (const meta of ["Attendance", "Lateness", "DTAs", "Reroutings", "Navigation"]) {
      expect(subjects).not.toContain(meta);
    }
  });
});
