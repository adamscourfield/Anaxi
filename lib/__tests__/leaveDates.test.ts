import { describe, expect, it } from "vitest";
import { businessDaysBetween, dateRangesOverlap, formatLeaveBoundary, formatLeaveRange, parseLocalDateTimeInput } from "@/lib/leaveDates";

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

describe("leave date formatting", () => {
  it("shows all-day ranges without times", () => {
    expect(formatLeaveRange(parseLocalDateTimeInput("2026-12-02"), parseLocalDateTimeInput("2026-12-04"), 2026)).toBe("2 – 4 Dec");
    expect(formatLeaveRange(parseLocalDateTimeInput("2026-11-29"), parseLocalDateTimeInput("2026-12-04"), 2026)).toBe("29 Nov – 4 Dec");
    expect(formatLeaveRange(parseLocalDateTimeInput("2026-12-02"), parseLocalDateTimeInput("2026-12-02"), 2026)).toBe("2 Dec");
  });

  it("shows the times the person typed, in summer too", () => {
    expect(formatLeaveRange(parseLocalDateTimeInput("2026-06-02T09:00"), parseLocalDateTimeInput("2026-06-02T13:30"), 2026)).toBe("2 Jun, 9am – 1:30pm");
    expect(formatLeaveBoundary(parseLocalDateTimeInput("2026-06-02"))).toBe("2 June 2026");
  });

  it("adds the year when it isn't this year", () => {
    expect(formatLeaveRange(parseLocalDateTimeInput("2026-12-30"), parseLocalDateTimeInput("2027-01-02"), 2026)).toBe("30 Dec 2026 – 2 Jan 2027");
  });

  it("counts working days by calendar date", () => {
    expect(businessDaysBetween(parseLocalDateTimeInput("2026-12-12"), parseLocalDateTimeInput("2026-12-13"))).toBe(0);
    expect(businessDaysBetween(parseLocalDateTimeInput("2026-12-11T13:00"), parseLocalDateTimeInput("2026-12-14T09:00"))).toBe(2);
  });
});
