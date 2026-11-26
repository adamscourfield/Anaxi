import { describe, expect, it } from "vitest";
import {
  gcseGrade,
  indexFromUpn,
  keyedGauss,
  ks2Score,
  studentAbility,
  subjectStanding,
  takesSubject,
  teacherEffect,
} from "@/prisma/demoAttainment";

function corr(pairs: Array<[number, number]>): number {
  const mx = pairs.reduce((a, p) => a + p[0], 0) / pairs.length;
  const my = pairs.reduce((a, p) => a + p[1], 0) / pairs.length;
  const cov = pairs.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
  const vx = pairs.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  const vy = pairs.reduce((a, p) => a + (p[1] - my) ** 2, 0);
  return cov / Math.sqrt(vx * vy);
}

const upns = Array.from({ length: 600 }, (_, i) => `D11${String(i + 1).padStart(3, "0")}`);
const students = upns.map((upn) => ({ upn, ability: studentAbility(upn, { pp: false, send: false }) }));

describe("demo attainment model", () => {
  it("gives the same numbers every time for the same student", () => {
    expect(keyedGauss("ability:D11001")).toBe(keyedGauss("ability:D11001"));
    expect(subjectStanding("D11001", 0.3, "Maths", 1)).toBe(subjectStanding("D11001", 0.3, "Maths", 1));
  });

  it("makes subjects move together the way they do in real schools", () => {
    const r = corr(students.map((s) => [subjectStanding(s.upn, s.ability, "Maths", 0), subjectStanding(s.upn, s.ability, "History", 0)]));
    expect(r).toBeGreaterThan(0.55);
    expect(r).toBeLessThan(0.85);
  });

  it("makes KS2 predict later results", () => {
    const r = corr(students.map((s) => [ks2Score(s.upn, s.ability, "maths"), subjectStanding(s.upn, s.ability, "Maths", 0)]));
    expect(r).toBeGreaterThan(0.45);
  });

  it("keeps the same subject consistent between two result points", () => {
    const r = corr(students.map((s) => [subjectStanding(s.upn, s.ability, "Physics", 0), subjectStanding(s.upn, s.ability, "Physics", 1)]));
    expect(r).toBeGreaterThan(0.8);
  });

  it("puts disadvantaged and SEND students lower on average", () => {
    const base = upns.reduce((a, u) => a + studentAbility(u, { pp: false, send: false }), 0) / upns.length;
    const pp = upns.reduce((a, u) => a + studentAbility(u, { pp: true, send: false }), 0) / upns.length;
    expect(base - pp).toBeCloseTo(0.35, 5);
  });

  it("produces grades across the GCSE range", () => {
    const grades = new Set(students.map((s) => gcseGrade(subjectStanding(s.upn, s.ability, "Maths", 0), "Maths")));
    expect(Math.min(...grades)).toBeLessThanOrEqual(2);
    expect(Math.max(...grades)).toBeGreaterThanOrEqual(8);
  });

  it("enrols the same students in a subject at every point", () => {
    expect(takesSubject("D11007", "French", 0.65)).toBe(takesSubject("D11007", "French", 0.65));
  });

  it("maps demo UPNs to class positions for the teacher effects", () => {
    expect(indexFromUpn("D7001", 7)).toBe(0);
    expect(indexFromUpn("D11046", 11)).toBe(45);
    expect(teacherEffect("Y7", "English", 45)).toBeLessThan(0);
    expect(teacherEffect("Y7", "English", 0)).toBe(0);
  });
});
