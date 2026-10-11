# Insights redesign — implemented navigation and migration

Status: implemented. The approved student, landing, teaching and attainment journeys are connected throughout the app. Legacy links migrate with query state preserved; detailed analytical views and exports remain available under Insights.
Source audit: Explorer route tree, Analytics priorities, Analysis detail pages, tenant navigation, modules/authz and student profile implementation.

## Product boundaries

- Home: daily briefing, recent activity and immediate work.
- Insights: investigate changes, understand evidence and identify who needs attention.
- Students: find and manage student records; one canonical profile.
- Classes: working view of a class, its pupils and outcomes.
- Attainment workspace: configure cycles, upload results, enter grades and manage assessment records.
- My actions / meetings / strategy: existing follow-up workflows. Do not introduce a competing task system.

## Navigation

Insights (/insights)
- Teaching (/insights/teaching): summary and priorities; Teachers, Departments and CPD as local views.
- Students (/insights/students): needs attention by default; All students and My watchlist as local views; year group, attendance and behaviour breakdowns.
- Attainment (/insights/attainment): select assessment dataset/comparison; Subjects, Groups and Students as local views; teacher attribution under advanced analysis.

The three areas remain visible within Insights. Local views use compact, consistently placed section navigation.
Move Insights out of Instruction into Overview beside Home and My actions.
Students sidebar becomes a directory entry instead of silently opening analysis.
Keep a teacher/coachee shortcut for users with scoped teacher access but no Insights hub access.
Names such as Teachers and Groups describe views, not additional competing hubs.

## Route disposition

Implemented destinations. Detailed evidence views remain available where the summary does not replace every capability.

| Current route | Decision | Destination / retained purpose |
| --- | --- | --- |
| /explorer | Replace | /insights, meaningful changes across three areas |
| /explorer/teachers | Combine | /insights/teaching/evidence, detailed teacher pivots; primary Teachers view is /insights/teaching?view=teachers |
| /explorer/departments | Keep analysis, relocate | /insights/teaching/departments |
| /explorer/signals | Combine | /insights/teaching/signals, detailed signal patterns; CPD priorities in the primary teaching views |
| /explorer/observations | Combine evidence search | /insights/teaching/observations, existing school-wide evidence search and export |
| /explorer/students | Combine | /insights/students, priority list plus all/watchlist views |
| /explorer/cohorts | Integrate | /insights/students/groups, year-group breakdown |
| /explorer/analysis | Integrate | /insights/students/patterns, attendance/behaviour patterns and on-call breakdown |
| /explorer/assessment | Replace hub | /insights/attainment |
| /explorer/assessment/students | Keep analysis, relocate | /insights/attainment/student-evidence |
| /explorer/assessment/cohorts | Keep analysis, relocate | /insights/attainment/group-evidence |
| /explorer/assessment/teachers | Keep advanced analysis | /insights/attainment/teacher-evidence, subject attribution and evidence limitations |
| /analytics and teacher tab | Combine | /insights/teaching?view=teachers |
| /analytics?tab=cpd | Combine | /insights/teaching?view=cpd |
| /analytics?tab=students | Combine | /insights/students |
| /analysis/teachers/[id] | Canonicalise | /analysis/teachers/[id], existing scoped detail with validated return context |
| /analysis/cpd/[signalKey] | Relocate | /analysis/cpd/[signalKey], evidence with validated return context |
| /analysis/students/[id] | Redirect | /students/[id], currently already re-exports that page |
| /students/[id] | Keep | Canonical student profile; relevant section selected and investigation context retained |
| /students | Review directory routing | Restored directory for authorised users; teacher-specific restrictions retained |
| /assessments and nested management routes | Keep | Cycle, point, upload and grade administration |
| /assessments/[cycle]/points/[point] | Integrate analysis entry | Preserve dataset-specific analysis, link into Insights with selected dataset; avoid duplicate conflicting summaries |
| /assessments/[cycle]/compare | Keep capability | Link comparison from Insights with both result points preserved |
| /assessments/triangulation | Combine analytical capability | Attainment analysis of combined pastoral/attainment evidence |
| /classes and /classes/[id] | Keep | Class workspace; links into contextual profiles/Insights |
| /observe/history and /observe/[id] | Keep | Observation records and authorised evidence detail |

Retire old rendering only after replacement covers every filter, export, drilldown and access rule.
Redirects must retain recognised filters and translate renamed parameters, not merely send everyone to the landing page.

## Existing permissions to preserve

These describe current code, not a proposal to widen access.

- ANALYSIS feature gates Explorer, Analytics and teacher/CPD analysis.
- Explorer hub, behaviour and assessment access: ADMIN, SUPER_ADMIN, SLT, HOD.
- Student analysis: ADMIN, SUPER_ADMIN, SLT, HOD. The student profile requires STUDENTS; analytical sections additionally check analysis enablement and authorisation.
- Teacher detail: school leaders/admins; HOD for shared departments; assigned coaches; teachers for themselves.
- CPD teacher-list visibility: admin/leaders/HOD and LEADER with coachees; others may receive a summary. Preserve row-level teacher visibility separately.
- Exports: admin/leaders and HOD, with HOD departmental scope enforced server-side.
- Observation records retain canViewObservation checks.
- Sidebar permissions use lib/rbac as well as modules/authz: reconcile actual route behaviour with navigation visibility in tests.
- Never infer permission from a visible tab, supplied return URL or query filter.

Permission acceptance matrix must include ADMIN, SUPER_ADMIN, SLT, HOD, assigned/unassigned LEADER, TEACHER and SUPPORT, with enabled/disabled features.
Hidden navigation is not an access control.

## First implementation journey (stage 2)

1. Open Insights → Students.
2. See a concise list of students needing attention, each with specific evidence and date.
3. Narrow by name/year group/reason; optional SEND, PP, watchlist and advanced filters.
4. Open a student → canonical profile, relevant evidence section.
5. Return → same filters, sort, pagination and scroll position.
6. Add/remove personal watchlist using existing functionality.
7. Open an existing follow-up flow with context where supported. A watchlist is not an assigned action.

Default list should disclose that it is prioritised, and offer All students.
Show evidence-based reasons; avoid asserting causation or substituting an unexplained composite score.
Keep existing calculations during this navigation migration. Changing ranking methodology is a separate explicit decision.

## Context and evidence contract

- URL is source of truth for shareable filters, view, sort, pagination and selected assessment.
- Normalise windowDays/window to a documented parameter; redirects preserve the old meaning.
- Keep observation windows, snapshot dates and assessment points distinct. Do not label latest snapshots as events occurring during the selected window.
- Detail links carry a validated same-origin return path and relevant section; browser Back restores scroll.
- Changing filters resets pagination; opening a detail does not.
- Display source dates, coverage and missing data near the result. Missing values are not zero.
- Use school vocabulary consistently in headings, filters, explanations and exports.
- Search and filters must not expand tenant or role scope.
- CSV uses the same authorised filters and clearly states dates/dataset.

## Plain-language rules

- Lead with the observed change, relevant person/group and comparison.
- “Insufficient observations” instead of an unexplained “low coverage”.
- “Change since the previous period” before technical drift definitions.
- Use CPD / professional development where appropriate to the audience, with school-specific signal names.
- Keep formulas and diagnostic attribution details available through progressive disclosure.
- RELAY appearance: white surfaces, coral accents, black actions, compact section controls, restrained motion.

## Stage gates

1. Approve this navigation map.
2. Build and review student journey; test permission boundaries and context retention.
3. Build cross-area Insights landing page using actual evidence.
4. Migrate Teaching and review.
5. Migrate Attainment and review.
6. Update all incoming links, translate legacy URLs, then remove duplicate rendering.
7. Validate data parity, accessibility, responsive layouts, performance, tests and production build; commit and push approved milestones.

## Known migration risks / decisions

- Observation history must gain parity before removing Explorer observations.
- Existing Students sidebar redirects can confuse directory/analysis boundaries; inspect role-specific routing before changing it.
- Analytics is available to some scoped users who cannot open Explorer. Preserve direct access during migration.
- CPD page-level list permission is not sufficient evidence of departmental row scoping; audit underlying filtering before reuse.
- Attainment point analysis and Insights may overlap. Use shared analytical components and dataset context rather than independent calculations.
- Existing watchlist actions are reusable; contextual assigned follow-up needs integration review before promising prefilled task creation.
- Final labels and information density should be reviewed on the student journey before extending the design.

## Final integration validation

- Legacy route migration has dedicated query-preservation and safe-return tests. Archived/all-status and 90-day student directory links retain their directory behaviour; advanced priority sorting remains available at /insights/priorities.
- Sidebar now separates Insights investigations from the Students directory. Home and detail links use the new destinations.
- Student directory CSV exports use the supported behaviour export and apply the same authorised filters.
- Full unit suite: 654 tests passing. Production build passed. Authenticated browser checks verified redirects, the restored directory, archived records, advanced priorities, filtered CSV output and mobile width.
