/**
 * Entity names Anaxi's Arbor app has been granted READ access to.
 *
 * Source: Anaxi's permission set in Arbor's Developer Portal
 * (developers-portal.arbor.sc/application/3240/permission-set), captured 2026-10-01.
 * This is confirmed, not a guess — it's the actual grant screen. Anaxi has read-only
 * access to every one of these (no write, no delete anywhere), which matches the
 * "block the edit, Arbor wins" decision in docs/arbor-integration.md: there was never
 * going to be a write path back to Arbor to reconcile with anyway.
 *
 * What this list does NOT give us: the fields inside each entity, REST/GraphQL
 * endpoint shapes, pagination, or auth. Those still need the portal's REST API /
 * GraphQL / Sandbox pages. Do not invent field names for these entities — see
 * client.ts and types.ts for the placeholder discipline.
 */
export const ARBOR_READABLE_ENTITIES = [
  // Academic structure (likely: year group definitions/membership, form/tutor-group-ish
  // units, and roll status per academic year) — exact shape unconfirmed.
  "academicLevel",
  "academicLevelMembership",
  "academicUnit",
  "academicUnitAssessment",
  "academicUnitEnrolment",
  "academicYear",
  "academicYearEnrolment",

  // People
  "person",
  "staff",
  "student",
  "emailAddress",

  // Classes / timetable — confirms the class-roster and "structure of the day" shapes
  // docs/arbor-integration.md previously flagged as unconfirmed guesses.
  "teachingGroup",
  "teachingGroupMembership",
  "teachingGroupTutor",
  "timetablePeriod",
  "timetableSlot",
  "timetableSlotLocation",
  "timetableSlotStaff",
  "room",
  "subject",

  // Behaviour — one entity per incident type, not a single unified "incident" endpoint.
  "detention",
  "internalExclusion",
  "fixedPeriodExclusion", // = suspension
  "pointAward",
  "pointAwardCategory",
  "pointAwardScale",

  // Attendance
  "attendanceMark",
  "attendanceRecord",
  "attendanceRegister",
  "attendanceRegisterType",
  "attendancePattern",
  "studentAttendancePattern",

  // Assessment — five largely separate subsystems, not one. See
  // docs/arbor-integration.md's assessment-mapping section before assuming any of
  // these map directly onto Anaxi's AssessmentCycle/Point/Assessment/Result chain.
  "assessment",
  "assessmentGradeSet",
  "adHocAssessment",
  "adHocAssessmentBatch",
  "adHocAssessmentBatchTarget",
  "studentAdHocAssessmentMark",
  "standardizedAssessment", // likely where KS2 scaled scores live
  "standardizedAssessmentAspect",
  "standardizedAssessmentComponent",
  "studentStandardizedAssessment",
  "studentStandardizedAssessmentMark",
  "progressAssessmentBatch",
  "progressAssessmentBatchTarget",
  "progressMeasurementPeriod",
  "progressMeasurementPeriodSet",
  "studentProgressAssessmentMark",
  "studentProgressGoal",
  "predictedAssessmentMark",
  "qualificationAward", // GCSE/A-level-type results
  "qualificationForecastResult",
  "qualificationResult",
  "qualificationSubject",
  "grade",
  "gradePointScale",
  "gradeSet",

  // SEND / DfE-specific — note these are their own entities, not booleans on `student`.
  "senStatus",
  "senStatusAssignment",
  "ukDfe_PupilPremiumRecipient",
  "ukDfe_UpnAssignment",
] as const;

export type ArborReadableEntity = (typeof ARBOR_READABLE_ENTITIES)[number];
