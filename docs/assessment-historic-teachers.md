# Historical assessment teacher attribution

The 2025/2026 roster rebuild is version 10. On the next run of the existing
`arbor-timetable-historic` scheduled worker, version 6 completion is ignored and
the roster is read again in resumable batches. God Mode shows the replacement
as queued until it starts. It can also be advanced with the existing historic
roster import action; no teacher data needs to be entered manually.

Historical pupil links come from AcademicUnitEnrolment at 30 June 2026 and must
identify a 2025/2026 (or 2025/26) class. Staff come exclusively from
AcademicUnit.timetableSlots → timetableSlotStaff → staff. Each allocation
may inherit its dates from a lesson slot explicitly bounded within the historical academic year; open-ended undated slots are rejected. The importer retains only dated allocations
overlapping 1 September 2025 through 30 June 2026. Live Goresbrook schema
inspection confirmed these relationships. Its computed timetabledStaffByDateRange
field exposes no date arguments, so it cannot be used for historical attribution. An undated subject staff list is not
acceptable evidence and is never substituted for an empty historic timetable.

Teacher Impact keeps all verified teachers of a single class. This supports
shared Maths classes. Different competing classes remain unassigned rather
than choosing one arbitrarily. Maths, Math, and Mathematics labels match;
Further Mathematics remains separate. Each teacher's summary counts a pupil
once, even when several class rows reference that pupil. Shared teaching is an
attainment association, not a causal estimate of individual teacher impact.

## Live verification after deployment

1. Use the existing historic roster preview to confirm that the school's Arbor
   returns dated lesson allocations and former Maths staff.
2. Allow the scheduled version 10 pass to complete (or advance it through the
   existing God Mode action). Check sync errors and the saved link count.
3. Check a known pupil in the 2025/2026 Year 9 End of Year point against their
   former Arbor Maths class and teachers, including shared teaching if present.
4. Confirm the pupil's 2026/2027 teachers do not appear for that historic point.

The existing historic worker targets 2025/2026. Importing other academic years
still needs a year-specific worker configuration; this change does not add a
multi-year import scheduler. A live Arbor response is required to establish
whether every missing Maths teacher is accounted for by shared-class handling
or whether the school has additional source-data/identity gaps.

The school confirmed these assessments took place in June 2026. The end-of-June
cutoff is an attribution fallback, not a claim that every exam occurred on 30 June.

Former staff absent from Anaxi are stored automatically from their historical Arbor staff ID and name as disabled reporting references. They have no password, notification delivery, or login access. Existing accounts are reused unchanged. Ambiguous pupil school identities remain skipped.

For a shared Primary/Secondary Arbor connection, an explicit historical class year is matched to the uniquely configured school phase before pupil identity resolution. Missing or ambiguous school-phase configuration does not choose a tenant.

Existing pupils without a saved Arbor ID may use the existing unique full-name fallback within the configured school phase; multiple candidates remain unassigned.

Version 8 falls back to legal names when Arbor preferred names are empty or whitespace, restoring historical staff allocations previously discarded as unnamed.

Version 9 retains Year 11 and Year 13 class memberships that ended during the assessment teaching year before the June fallback date. Staff allocations must precede the membership end date; other cohorts still require membership on the assessment fallback date.

Final-results uploads may contain separate pupil records without Arbor IDs. Teacher
Impact resolves these to a single uniquely named Arbor pupil in the same tenant,
without moving results, merging profiles, or overriding an existing external ID.
Duplicate Arbor names remain unresolved. Historical class matching prefers the
assessed year group within the verified academic year, prefers the main class over CCE/intervention groups, and reads
specific subjects from departmental labels (for example Science: Biology).

Version 10 stores separate class identities for each pupil, subject and teacher, including main lessons, intervention lessons and Further Maths. The replacement index retains all existing links and preserves duplicate protection for unnamed manual links. Rebuild historical rosters after applying this migration.

Historical pupils who changed core classes retain their verified same-year teaching teams. Teacher totals deduplicate the pupil across their lesson groups. This does not use current-year classes or select an arbitrary teacher.
