# Classes

`/classes` and `/classes/[id]` are read-only school-wide pages for every authenticated tenant user. The Students menu link is intentionally independent of role and feature flags. Every data query is restricted to the session tenant; there is no cross-school lookup or supplied tenant parameter.

Current rosters use named StudentSubjectTeacher links with effectiveFrom <= now and effectiveTo either null or > now, and ACTIVE pupils. Classes are grouped by subject ID and trimmed class label. Shared teachers and pupils are deduplicated, and mixed-year classes remain together. No roster is inferred from assessment results or from a pupil's year group.

Attendance comes from each pupil's latest non-future snapshot. Rates are weighted by possible register sessions only when every available snapshot has valid session totals; otherwise the page explicitly displays the mean of pupil rates. Individual snapshot dates and register coverage are visible.

Behaviour charts count recorded individual BehaviourIncident events in a rolling 7/14/21/28-day window (default 21). They describe current class pupils across all lessons, because incidents do not have a class foreign key. Cumulative snapshot totals retain their original scope in a separate expandable table; they are never subtracted or relabelled as rolling-window incidents.

Attainment matches the roster subject name (trimmed, case insensitive) and keeps every assessment separately, including assessments at the same point. The default is the most recent recorded assessment date. Cycle selection exposes historical results for the current roster. Invalid and non-present results are excluded from chart counts and displayed with their status. Draft assessments remain visible with their status explicitly labelled. Numeric charts group percentage/raw results into bands; grade scales are never averaged together.

Tests: `tests/classes-data.test.ts`, `tests/classes-metrics.test.ts`. Browser checks cover an admin and a teacher who does not teach the preview class, shared teaching, search/filter empty states and a 390px mobile viewport. Preview fixtures were created only in the local demo database.
