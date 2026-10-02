import { describe, expect, it } from "vitest";
import { mondayOnOrBefore } from "@/modules/home/hydration";

describe("mondayOnOrBefore", () => {
  it("returns the same date when given a Monday", () => {
    const monday = new Date("2026-10-05T00:00:00.000Z"); // a Monday
    expect(mondayOnOrBefore(monday).toISOString()).toBe(monday.toISOString());
  });

  it("walks back to Monday from mid-week", () => {
    const wednesday = new Date("2026-10-07T00:00:00.000Z");
    expect(mondayOnOrBefore(wednesday).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("walks back to Monday from Sunday", () => {
    const sunday = new Date("2026-10-11T00:00:00.000Z");
    expect(mondayOnOrBefore(sunday).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});
