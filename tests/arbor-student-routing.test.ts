import { describe, expect, it } from "vitest";
import { routeArborStudentByAcademicLevel } from "@/lib/integrations/arbor/studentRouting";

describe("Arbor student routing", () => {
  it.each(["Nursery", "Nursery Pre-school", "Nursery Y1", "Nursery Y2", "Reception", "Year 1", "Y6", "year 06"])("routes %s to Primary", (yearGroup) => {
    expect(routeArborStudentByAcademicLevel(yearGroup)).toBe("PRIMARY");
  });

  it.each(["Year 7", "Y10", "year 13"])("routes %s to Secondary", (yearGroup) => {
    expect(routeArborStudentByAcademicLevel(yearGroup)).toBe("SECONDARY");
  });

  it.each([null, "", "   "])("skips %s as off-roll", (yearGroup) => {
    expect(routeArborStudentByAcademicLevel(yearGroup)).toBe("SKIP_OFF_ROLL");
  });

  it.each(["Year 14", "Sixth form"])("leaves %s for review", (yearGroup) => {
    expect(routeArborStudentByAcademicLevel(yearGroup)).toBe("REVIEW");
  });
});
