import { expect, it } from "vitest";
import { arborAcademicUnitSubject, arborClassSubjectName } from "../lib/integrations/arbor/academicUnitSubject";
it("recovers Further Maths and GCSE PE leaf subjects with missing Arbor subject relations", () => {
  expect(arborAcademicUnitSubject(null, "Mathematics: Further Maths: Year 13: 13C/FM (2025/2026)")).toBe("Further Maths");
  expect(arborAcademicUnitSubject(null, "Physical Education: GCSE PE: Year 11: 11B/GP (2025/2026)")).toBe("PE");
});
it("preserves the direct Arbor subject while exposing explicit qualification labels", () => {
  expect(arborAcademicUnitSubject("Physical Education / Sports", "Physical Education: CN Sports St: Year 11: 11A/SS (2025/2026)")).toBe("Physical Education / Sports");
  expect(arborClassSubjectName("Physical Education: CN Sports St: Year 11: 11A/SS (2025/2026)")).toBe("Sport Studies");
  expect(arborClassSubjectName("Religious Education: GCSE RS: Year 11: 11B/GR (2025/2026)")).toBe("Religious Education");
});
it("does not invent a subject for a year-group parent", () => {
  expect(arborAcademicUnitSubject(null, "Year 13 (2025/2026)")).toBe("");
});
