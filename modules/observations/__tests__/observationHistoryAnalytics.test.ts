import { describe, expect, it } from "vitest";
import { computeObservationHistoryAnalytics } from "../observationHistoryAnalytics";
import {
  academicYearBounds,
  intersectDateRanges,
  observationWeekKey,
  presetRange,
  resolveObservationAnalysisRangeUnified,
} from "../observationHistoryAnalysisRange";

describe("resolveObservationAnalysisRangeUnified", () => {
  it("uses preset alone when no filter dates", () => {
    const r = resolveObservationAnalysisRangeUnified({
      analysisPreset: "month",
      from: "",
      to: "",
      useWindow: false,
      windowStart: null,
      now: new Date("2026-06-15T12:00:00Z"),
    });
    expect(r.emptyIntersection).toBe(false);
    expect(r.label.toLowerCase()).toContain("30");
    const days = (r.end.getTime() - r.start.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(28);
  });

  it("intersects preset with explicit from/to", () => {
    const r = resolveObservationAnalysisRangeUnified({
      analysisPreset: "academic_year",
      from: "2026-01-01",
      to: "2026-01-31",
      useWindow: false,
      windowStart: null,
      now: new Date("2026-06-15T12:00:00Z"),
    });
    expect(r.emptyIntersection).toBe(false);
    expect(r.start.getMonth()).toBe(0);
    expect(r.end.getMonth()).toBe(0);
  });

  it("flags empty intersection when filter and preset do not overlap", () => {
    const r = resolveObservationAnalysisRangeUnified({
      analysisPreset: "week",
      from: "2020-01-01",
      to: "2020-01-05",
      useWindow: false,
      windowStart: null,
      now: new Date("2026-06-15T12:00:00Z"),
    });
    expect(r.emptyIntersection).toBe(true);
  });
});

describe("academicYearBounds", () => {
  it("returns Sep–Aug span for dates before September", () => {
    const { start, end } = academicYearBounds(new Date("2026-03-01"));
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(1);
    expect(start.getFullYear()).toBe(2025);
    expect(end.getMonth()).toBe(7);
    expect(end.getFullYear()).toBe(2026);
  });

  it("returns current cycle for dates on or after September", () => {
    const { start, end } = academicYearBounds(new Date("2026-09-10"));
    expect(start.getFullYear()).toBe(2026);
    expect(end.getFullYear()).toBe(2027);
  });
});

describe("intersectDateRanges", () => {
  it("returns null when disjoint", () => {
    expect(
      intersectDateRanges(
        { start: new Date("2026-01-01"), end: new Date("2026-01-10") },
        { start: new Date("2026-02-01"), end: new Date("2026-02-10") },
      ),
    ).toBeNull();
  });
});

describe("observationWeekKey", () => {
  it("is stable for same ISO week (Monday bucket)", () => {
    const a = new Date("2026-01-07T12:00:00Z");
    const b = new Date("2026-01-08T12:00:00Z");
    expect(observationWeekKey(a)).toBe(observationWeekKey(b));
  });
});

describe("presetRange", () => {
  it("26w aligns start to Monday", () => {
    const anchor = new Date("2026-06-18T15:00:00Z");
    const pr = presetRange("26w", anchor);
    expect(pr.start.getDay()).toBe(1);
  });
});

describe("computeObservationHistoryAnalytics", () => {
  it("aggregates observer roles, timeline, and pair week links", () => {
    const range = {
      start: new Date("2026-01-05T00:00:00Z"),
      end: new Date("2026-01-25T23:59:59Z"),
    };
    const { roleCounts, timelineWeeks, pairWeekly } = computeObservationHistoryAnalytics({
      observations: [
        {
          id: "o1",
          observerId: "a",
          observedTeacherId: "t1",
          observedAt: new Date("2026-01-06T10:00:00Z"),
          observerRole: "ADMIN",
        },
        {
          id: "o2",
          observerId: "a",
          observedTeacherId: "t1",
          observedAt: new Date("2026-01-07T10:00:00Z"),
          observerRole: "ADMIN",
        },
        {
          id: "o3",
          observerId: "b",
          observedTeacherId: "t2",
          observedAt: new Date("2026-01-20T10:00:00Z"),
          observerRole: "LEADER",
        },
      ],
      range,
      coachAssignments: [
        {
          coachUserId: "a",
          coacheeUserId: "t1",
          coachName: "Coach",
          coacheeName: "Teach",
        },
      ],
      showCoachingSection: true,
    });

    expect(roleCounts.find((r) => r.role === "ADMIN")?.count).toBe(2);
    expect(roleCounts.find((r) => r.role === "LEADER")?.count).toBe(1);
    expect(timelineWeeks.length).toBeGreaterThan(0);
    const sumTimeline = timelineWeeks.reduce((s, w) => s + w.count, 0);
    expect(sumTimeline).toBe(3);
    expect(pairWeekly).toHaveLength(1);
    expect(pairWeekly[0].observationCount).toBe(2);
    const idx = pairWeekly[0].weekHit.findIndex(Boolean);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(pairWeekly[0].weekObservationIds[idx]).toBe("o2");
  });
});
