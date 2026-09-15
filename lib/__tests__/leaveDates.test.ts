import { describe, expect, it } from "vitest";
import { dateRangesOverlap, parseLocalDateTimeInput } from "@/lib/leaveDates";

describe("dateRangesOverlap", () => {
  it("does not flag two genuinely separate dates as overlapping", () => {
    const a = parseLocalDateTimeInput("2026-12-14");
    const b = parseLocalDateTimeInput("2026-09-16");
    expect(dateRangesOverlap(a, a, b, b)).toBe(false);
  });

  it("treats adjacent inclusive all-day ranges as overlapping at the shared boundary day", () => {
    const aStart = parseLocalDateTimeInput("2026-10-01");
    const aEnd = parseLocalDateTimeInput("2026-10-02");
    const bStart = parseLocalDateTimeInput("2026-10-02");
    const bEnd = parseLocalDateTimeInput("2026-10-03");
    expect(dateRangesOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);
  });

  it("flags a same-day all-day request as overlapping a timed request that day", () => {
    const allDayStart = parseLocalDateTimeInput("2026-09-16");
    const allDayEnd = parseLocalDateTimeInput("2026-09-16");
    const timedStart = parseLocalDateTimeInput("2026-09-16T09:00");
    const timedEnd = parseLocalDateTimeInput("2026-09-16T17:00");
    expect(dateRangesOverlap(allDayStart, allDayEnd, timedStart, timedEnd)).toBe(true);
  });

  it("does not flag two non-overlapping timed requests on the same day", () => {
    const morningStart = parseLocalDateTimeInput("2026-09-20T09:00");
    const morningEnd = parseLocalDateTimeInput("2026-09-20T11:00");
    const afternoonStart = parseLocalDateTimeInput("2026-09-20T14:00");
    const afternoonEnd = parseLocalDateTimeInput("2026-09-20T17:00");
    expect(dateRangesOverlap(morningStart, morningEnd, afternoonStart, afternoonEnd)).toBe(false);
  });

  it("flags two overlapping timed requests on the same day", () => {
    const firstStart = parseLocalDateTimeInput("2026-09-20T09:00");
    const firstEnd = parseLocalDateTimeInput("2026-09-20T12:00");
    const secondStart = parseLocalDateTimeInput("2026-09-20T11:00");
    const secondEnd = parseLocalDateTimeInput("2026-09-20T14:00");
    expect(dateRangesOverlap(firstStart, firstEnd, secondStart, secondEnd)).toBe(true);
  });
});
