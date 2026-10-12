import { expect, it } from "vitest";
import { historicEnrolmentIncluded } from "../lib/integrations/arbor/historicEnrolment";
const membership = (year: number, endDate: string, startDate = "2025-09-01") => ({ startDate, endDate, academicUnit: { displayName: `Mathematics: Year ${year}: class (2025/2026)` } });
it("retains GCSE and A-level exam classes that closed before results day", () => {
  expect(historicEnrolmentIncluded(membership(11, "2026-05-22"), "2026-06-30")).toBe(true);
  expect(historicEnrolmentIncluded(membership(13, "2026-06-19"), "2026-06-30")).toBe(true);
});
it("excludes classes outside the assessment teaching year", () => {
  expect(historicEnrolmentIncluded(membership(13, "2025-06-19", "2024-09-01"), "2026-06-30")).toBe(false);
  expect(historicEnrolmentIncluded(membership(11, "2027-06-19", "2026-09-01"), "2026-06-30")).toBe(false);
});
it("keeps the assessment-date membership requirement for other cohorts", () => {
  expect(historicEnrolmentIncluded(membership(9, "2026-05-22"), "2026-06-30")).toBe(false);
  expect(historicEnrolmentIncluded(membership(9, "2026-08-31"), "2026-06-30")).toBe(true);
});
