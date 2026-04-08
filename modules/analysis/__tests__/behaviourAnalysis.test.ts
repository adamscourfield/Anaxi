import { describe, it, expect } from "vitest";
import {
  bucketOnCallsByHour,
  groupByTeacher,
  groupByReason,
} from "@/modules/analysis/behaviourAnalysis";

// ─── bucketOnCallsByHour ─────────────────────────────────────────────────────

describe("bucketOnCallsByHour", () => {
  it("returns hours 8–15 with zero counts when empty", () => {
    const result = bucketOnCallsByHour([]);
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ hour: 8, count: 0 });
    expect(result[7]).toEqual({ hour: 15, count: 0 });
    expect(result.every((r) => r.count === 0)).toBe(true);
  });

  it("counts requests in the correct hour bucket", () => {
    const requests = [
      { createdAt: new Date("2026-03-01T09:15:00") },
      { createdAt: new Date("2026-03-01T09:45:00") },
      { createdAt: new Date("2026-03-01T14:00:00") },
    ];
    const result = bucketOnCallsByHour(requests);
    const hour9 = result.find((r) => r.hour === 9);
    const hour14 = result.find((r) => r.hour === 14);
    expect(hour9?.count).toBe(2);
    expect(hour14?.count).toBe(1);
  });

  it("ignores requests outside 8am–3pm window", () => {
    const requests = [
      { createdAt: new Date("2026-03-01T06:00:00") },
      { createdAt: new Date("2026-03-01T20:00:00") },
    ];
    const result = bucketOnCallsByHour(requests);
    expect(result.every((r) => r.count === 0)).toBe(true);
  });

  it("returns results sorted by hour 8 through 15", () => {
    const requests = [
      { createdAt: new Date("2026-03-01T15:00:00") },
      { createdAt: new Date("2026-03-01T08:00:00") },
    ];
    const result = bucketOnCallsByHour(requests);
    const hours = result.map((r) => r.hour);
    expect(hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(result.find((r) => r.hour === 8)?.count).toBe(1);
    expect(result.find((r) => r.hour === 15)?.count).toBe(1);
  });
});

// ─── groupByTeacher ──────────────────────────────────────────────────────────

describe("groupByTeacher", () => {
  it("returns empty array for no requests", () => {
    expect(groupByTeacher([])).toEqual([]);
  });

  it("groups and counts by teacher", () => {
    const requests = [
      { requesterUserId: "u1", requester: { id: "u1", fullName: "Alice Smith" } },
      { requesterUserId: "u1", requester: { id: "u1", fullName: "Alice Smith" } },
      { requesterUserId: "u2", requester: { id: "u2", fullName: "Bob Jones" } },
    ];
    const result = groupByTeacher(requests);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ teacherId: "u1", teacherName: "Alice Smith", count: 2 });
    expect(result[1]).toEqual({ teacherId: "u2", teacherName: "Bob Jones", count: 1 });
  });

  it("sorts by count descending", () => {
    const requests = [
      { requesterUserId: "u1", requester: { id: "u1", fullName: "A" } },
      { requesterUserId: "u2", requester: { id: "u2", fullName: "B" } },
      { requesterUserId: "u2", requester: { id: "u2", fullName: "B" } },
      { requesterUserId: "u2", requester: { id: "u2", fullName: "B" } },
    ];
    const result = groupByTeacher(requests);
    expect(result[0].teacherName).toBe("B");
    expect(result[0].count).toBe(3);
    expect(result[1].count).toBe(1);
  });
});

// ─── groupByReason ───────────────────────────────────────────────────────────

describe("groupByReason", () => {
  it("returns empty array for no requests", () => {
    expect(groupByReason([])).toEqual([]);
  });

  it("groups by reason category", () => {
    const requests = [
      { behaviourReasonCategory: "Disruption" },
      { behaviourReasonCategory: "Disruption" },
      { behaviourReasonCategory: "Physical aggression" },
    ];
    const result = groupByReason(requests);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ reason: "Disruption", count: 2 });
    expect(result[1]).toEqual({ reason: "Physical aggression", count: 1 });
  });

  it("treats null reason as Uncategorised", () => {
    const requests = [
      { behaviourReasonCategory: null },
      { behaviourReasonCategory: null },
      { behaviourReasonCategory: "Refusal" },
    ];
    const result = groupByReason(requests);
    expect(result).toHaveLength(2);
    const uncategorised = result.find((r) => r.reason === "Uncategorised");
    expect(uncategorised?.count).toBe(2);
  });

  it("sorts by count descending", () => {
    const requests = [
      { behaviourReasonCategory: "A" },
      { behaviourReasonCategory: "B" },
      { behaviourReasonCategory: "B" },
      { behaviourReasonCategory: "B" },
    ];
    const result = groupByReason(requests);
    expect(result[0].reason).toBe("B");
    expect(result[0].count).toBe(3);
  });
});
