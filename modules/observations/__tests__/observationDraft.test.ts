import { describe, expect, it } from "vitest";
import { guessYearGroup, todayInSchoolZone, yearGroupOptions } from "@/app/(tenant)/observe/components/observationDraft";

describe("guessYearGroup", () => {
  it("reads common secondary class codes", () => {
    expect(guessYearGroup("10A/Ma1", "SECONDARY")).toBe("Y10");
    expect(guessYearGroup("9B/Ma2", "SECONDARY")).toBe("Y9");
    expect(guessYearGroup("Year 11 set 3", "SECONDARY")).toBe("Y11");
    expect(guessYearGroup("Y8French", "SECONDARY")).toBe("Y8");
    expect(guessYearGroup("yr 7", "SECONDARY")).toBe("Y7");
  });

  it("returns nothing rather than guessing badly", () => {
    expect(guessYearGroup("", "SECONDARY")).toBe("");
    expect(guessYearGroup("Set A", "SECONDARY")).toBe("");
    expect(guessYearGroup("Biology 2", "SECONDARY")).toBe("");
    expect(guessYearGroup("Year 4", "SECONDARY")).toBe("");
    expect(guessYearGroup("123", "SECONDARY")).toBe("");
  });

  it("handles primary years and reception", () => {
    expect(guessYearGroup("Reception Oak", "PRIMARY")).toBe("Reception");
    expect(guessYearGroup("Year 4 Willow", "PRIMARY")).toBe("Y4");
    expect(guessYearGroup("Year 9", "PRIMARY")).toBe("");
  });
});

describe("yearGroupOptions", () => {
  it("offers the right range per phase", () => {
    expect(yearGroupOptions("SECONDARY").map((o) => o.value)).toEqual(["Y7", "Y8", "Y9", "Y10", "Y11", "Y12", "Y13"]);
    expect(yearGroupOptions("PRIMARY")[0].value).toBe("Reception");
  });
});

describe("todayInSchoolZone", () => {
  it("uses the UK date, not UTC", () => {
    // 23:30 UTC on 30 June is 00:30 on 1 July in London (BST).
    expect(todayInSchoolZone(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    // In winter London matches UTC.
    expect(todayInSchoolZone(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
  });
});
