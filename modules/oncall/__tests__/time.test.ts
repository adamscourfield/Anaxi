import { describe, expect, it } from "vitest";
import { startOfDayInZone } from "@/modules/oncall/time";

describe("startOfDayInZone (UK school day)", () => {
  it("in winter (GMT), the school day starts at 00:00 UTC", () => {
    expect(startOfDayInZone(new Date("2026-11-25T09:30:00Z")).toISOString()).toBe("2026-11-25T00:00:00.000Z");
  });

  it("in summer (BST), the school day starts at 23:00 UTC the evening before", () => {
    expect(startOfDayInZone(new Date("2026-06-10T09:30:00Z")).toISOString()).toBe("2026-06-09T23:00:00.000Z");
  });

  it("just after midnight in summer is still the new UK day, not yesterday", () => {
    expect(startOfDayInZone(new Date("2026-06-09T23:30:00Z")).toISOString()).toBe("2026-06-09T23:00:00.000Z");
  });

  it("handles the day the clocks go forward", () => {
    expect(startOfDayInZone(new Date("2026-03-29T12:00:00Z")).toISOString()).toBe("2026-03-29T00:00:00.000Z");
  });
});
