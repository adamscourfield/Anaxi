import { describe, expect, it } from "vitest";
import { computeFlags, pickWindows } from "@/modules/students/flags";

describe("computeFlags", () => {
  it("creates deterministic spikes", () => {
    const now = new Date("2026-01-30");
    const snapshots = [
      { snapshotDate: new Date("2026-01-01"), attendancePct: 97, detentionsCount: 1, internalExclusionsCount: 0, suspensionsCount: 0, onCallsCount: 1, latenessCount: 1 },
      { snapshotDate: new Date("2026-01-10"), attendancePct: 96, detentionsCount: 1, internalExclusionsCount: 0, suspensionsCount: 0, onCallsCount: 1, latenessCount: 1 },
      { snapshotDate: new Date("2026-01-26"), attendancePct: 89, detentionsCount: 5, internalExclusionsCount: 2, suspensionsCount: 1, onCallsCount: 4, latenessCount: 5 },
      { snapshotDate: now, attendancePct: 88, detentionsCount: 6, internalExclusionsCount: 2, suspensionsCount: 1, onCallsCount: 4, latenessCount: 5 }
    ];

    const flags = computeFlags(snapshots);
    expect(flags.some((f) => f.flagKey === "ATTENDANCE_DROP")).toBe(true);
    expect(flags.some((f) => f.flagKey === "SUSPENSIONS_NEW")).toBe(true);
  });

  it("supports a configurable rolling window", () => {
    const snapshots = [
      { snapshotDate: new Date("2026-01-01"), attendancePct: 97, detentionsCount: 1, internalExclusionsCount: 0, suspensionsCount: 0, onCallsCount: 1, latenessCount: 1 },
      { snapshotDate: new Date("2026-02-10"), attendancePct: 96, detentionsCount: 1, internalExclusionsCount: 0, suspensionsCount: 0, onCallsCount: 1, latenessCount: 1 },
      { snapshotDate: new Date("2026-03-02"), attendancePct: 88, detentionsCount: 6, internalExclusionsCount: 2, suspensionsCount: 1, onCallsCount: 4, latenessCount: 5 },
    ];

    const windows7 = pickWindows(snapshots, 7);
    const windows28 = pickWindows(snapshots, 28);
    expect(windows7?.baseline).not.toEqual(windows28?.baseline);

    const flags28 = computeFlags(snapshots, 28);
    expect(flags28.some((f) => f.flagKey === "ATTENDANCE_DROP")).toBe(true);
  });
});
