import { describe, expect, it } from "vitest";
import {
  computeObservationHistoryAnalytics,
  resolveObservationAnalysisRange,
} from "../observationHistoryAnalytics";

describe("resolveObservationAnalysisRange", () => {
  it("uses explicit from/to", () => {
    const r = resolveObservationAnalysisRange({
      from: "2026-01-01",
      to: "2026-01-31",
      useWindow: false,
      windowStart: null,
    });
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.end.getFullYear()).toBe(2026);
    expect(r.label).toContain("2026");
  });

  it("defaults to ~26 weeks when no bounds", () => {
    const end = new Date("2026-06-15T12:00:00Z");
    const realNow = Date.now;
    Date.now = () => end.getTime();
    try {
      const r = resolveObservationAnalysisRange({
        from: "",
        to: "",
        useWindow: false,
        windowStart: null,
      });
      const days = (r.end.getTime() - r.start.getTime()) / (24 * 60 * 60 * 1000);
      expect(days).toBeGreaterThan(150);
      expect(r.label.toLowerCase()).toContain("weeks");
    } finally {
      Date.now = realNow;
    }
  });
});

describe("computeObservationHistoryAnalytics", () => {
  it("aggregates observer roles and weekly timeline", () => {
    const range = {
      start: new Date("2026-01-05T00:00:00Z"),
      end: new Date("2026-01-25T23:59:59Z"),
    };
    const { roleCounts, timelineWeeks, pairWeekly } = computeObservationHistoryAnalytics({
      observations: [
        {
          observerId: "a",
          observedTeacherId: "t1",
          observedAt: new Date("2026-01-06T10:00:00Z"),
          observerRole: "ADMIN",
        },
        {
          observerId: "a",
          observedTeacherId: "t1",
          observedAt: new Date("2026-01-07T10:00:00Z"),
          observerRole: "ADMIN",
        },
        {
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
    expect(pairWeekly[0].weeksWithObservation).toBeGreaterThanOrEqual(1);
  });
});
