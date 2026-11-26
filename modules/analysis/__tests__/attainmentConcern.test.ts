import { describe, expect, it } from "vitest";
import { compareByConcern, isDownInSeveralSubjects, subjectsDown, subjectsUp } from "@/modules/analysis/attainmentConcern";
import { hasPermission } from "@/lib/rbac";

const student = (...movements: Array<number | null>) => ({ subjects: movements.map((movement) => ({ movement })) });
const GRADE = 1 / 9; // one GCSE grade on the 0–1 scale

describe("down in 3 or more subjects", () => {
  it("counts a GCSE grade as a drop but not a few points of wobble", () => {
    expect(subjectsDown(student(-GRADE, -0.05, 0.02).subjects)).toHaveLength(1);
    expect(subjectsDown(student(-0.1).subjects)).toHaveLength(1);
    expect(subjectsUp(student(GRADE, 0.09).subjects)).toHaveLength(1);
  });

  it("needs drops in at least three subjects", () => {
    expect(isDownInSeveralSubjects(student(-GRADE, -GRADE, 0, 0, 0, 0, 0, 0, 0))).toBe(false);
    expect(isDownInSeveralSubjects(student(-GRADE, -GRADE, -2 * GRADE, 0, 0, 0, 0, 0, 0))).toBe(true);
  });

  it("asks for every subject when a student has fewer than three comparisons", () => {
    expect(isDownInSeveralSubjects(student(-0.17, -0.17, null))).toBe(true);
    expect(isDownInSeveralSubjects(student(-0.17, 0, null))).toBe(false);
    expect(isDownInSeveralSubjects(student(null, null))).toBe(false);
  });

  it("lists students with more subjects down first, then the larger drop", () => {
    const a = student(-0.12, -0.12, -0.12);
    const b = student(-0.12, -0.12, -0.12, -0.12);
    const c = student(-0.3, -0.12, -0.12);
    expect([a, b, c].sort(compareByConcern)).toEqual([b, c, a]);
  });
});

describe("leader permissions", () => {
  it("lets a leader see and manage their own meetings and actions, like a teacher", () => {
    for (const p of ["meetings:create", "meetings:view_own", "actions:create", "actions:manage", "actions:view_own"] as const) {
      expect(hasPermission("LEADER", p)).toBe(hasPermission("TEACHER", p));
      expect(hasPermission("LEADER", p)).toBe(true);
    }
    expect(hasPermission("LEADER", "meetings:view_all")).toBe(false);
  });
});
