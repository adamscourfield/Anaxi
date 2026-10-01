# Arbor MIS integration — groundwork

Anaxi has partner access to sync directly with Arbor's API (staff, students, class
lists/timetable, behaviour, assessment results) instead of relying on manual CSV
uploads. This document tracks what's in place and what's still needed before a real
sync can be built.

## What's in place

- **`dataSource` + `externalId` on every entity Arbor will supply**: `Student`, `User`,
  `TimetableEntry`, `StudentSnapshot` (behaviour/attendance/positive points totals),
  `AssessmentCycle`, `AssessmentPoint`, `Assessment`, and `AssessmentResult`.
  `dataSource` is `MANUAL` (created or edited by hand), `CSV_IMPORT`, or `ARBOR`.
  `externalId` holds the source system's own ID for that record — Arbor's student ID,
  staff ID, timetable slot ID, or assessment/marksheet ID. Where a table's existing
  unique key is already enough to find the right row on a re-sync
  (`StudentSnapshot`'s `(tenantId, studentId, snapshotDate)`, `AssessmentResult`'s
  `(tenantId, assessmentId, studentId)`), it only got `dataSource`, not `externalId` —
  the point there is to stop one source silently overwriting another's data for the
  same date/student, not to locate the row. Everywhere else,
  `(tenantId, dataSource, externalId)` is unique per table, so a sync can always find
  "the record I created for this Arbor ID last time" instead of re-matching by name or
  email and risking duplicates.
- **Avatar storage on `Student`** (`avatarImage`, `avatarMimeType`, `avatarUpdatedAt`),
  mirroring the columns `User` already has for staff photos. **Not yet wired to
  anything** — no upload UI, no sync writes to it. Pupil photos are more sensitive than
  staff ones: confirm image rights and retention are covered in the school's data
  sharing agreement before a sync actually populates these, and delete them when a
  student's `status` moves to `ARCHIVED` rather than keeping them indefinitely.
- **`TenantIntegration`** — the original per-school integration storage. It remains
  available for integrations that genuinely belong to one Anaxi school, but is not
  the right owner for Goresbrook's shared Arbor system.
- **`SharedIntegration` + `SharedIntegrationSchool`** — a platform-managed source
  connection with an explicit list of receiving Anaxi schools. This is the Arbor
  design for Goresbrook: enter Arbor credentials once in God Mode, select both
  Goresbrook Primary and Goresbrook Secondary, and retain separate data boundaries
  once syncing starts. Credentials are AES-256-GCM encrypted by
  `lib/integrationSecrets.ts`, keyed by `INTEGRATION_ENCRYPTION_KEY`; the God Mode
  audit entry intentionally contains no username or password.
- **God Mode Arbor connection screen** — `/god/integrations/arbor` now lets a super
  admin save the encrypted connection details and select all recipient schools. It
  validates that the Arbor hostname is only a subdomain (not a URL), so credentials
  cannot later be sent to an arbitrary host. Saving a connection does **not** start a
  sync or claim that Arbor has accepted the credentials: live verification remains a
  separate, auditable action to build with the first sync.
- **Read-only connection and student-routing previews** — God Mode can verify the
  saved application credentials with a one-record `Staff { id }` read, then preview
  every student without writing to Anaxi. Goresbrook's agreed rule is explicit in
  `studentRouting.ts`: Nursery (including Arbor's Nursery Pre-school, Nursery Y1 and
  Nursery Y2 levels)–Year 6 routes to the Primary tenant, Years 7–13 to
  the Secondary tenant, and missing academic levels are treated as off-roll records
  and skipped. Unexpected non-empty labels are held for review.
- **`IntegrationSyncRun`** — a log row per sync attempt per entity type (staff,
  students, classes, behaviour, assessments), with counts of records processed,
  created, updated and failed, and an error summary. Lets an admin or support see what
  a sync actually did, the same way `ImportJob` already does for CSV imports.
- **`lib/integrations/arbor/`** — now has a real (if unverified) transport layer, not
  just placeholders, built from Arbor's own Developer Portal docs (REST and GraphQL
  reference pages, captured 2026-10-01):
  - `entities.ts`: the 54 entities Anaxi's Arbor app actually has read access to,
    confirmed from the permission grant screen — not a guess. **Read-only everywhere**
    (no write, no delete on anything), which matches the field-ownership decision
    below for a reason stronger than "we chose to be read-only": there was never a
    write path to build.
  - `graphqlClient.ts`: `runArborGraphqlQuery()` — POSTs to
    `https://{schoolHostname}.uk.arbor.sc/graphql/query` with HTTP Basic auth (Arbor's
    confirmed auth method for both REST and GraphQL — not an API key or OAuth token),
    parses the standard GraphQL `{data, errors}` envelope, and retries once on a 5xx.
    This part is genuinely implemented, with unit tests (mocked `fetch`) — not a
    placeholder — but **unverified against a live Arbor instance**: no sandbox
    credentials or network access yet to confirm it actually works end to end.
  - `client.ts`: `ArborClient.listStaff()` / `listStudents()` / `listTeachingGroups()`
    build real GraphQL queries using field names Arbor's own docs showed for these
    three entities. Also genuinely implemented, also unverified live. Chose GraphQL
    over REST: it nests related data in one request (REST needs a follow-up call per
    related object's `href`), gives explicit per-field permission errors instead of
    REST's silent empty object on no access, and its `page_size`/`page_num` filters
    are simpler than REST's `filters.x.y.operator=value` for what a sync needs.
  - `types.ts`: field shapes for `ArborStaffRecord`/`ArborStudentRecord`/
    `ArborTeachingGroupRecord` are copied from Arbor's docs examples for those three
    entities specifically — real field names, not guesses — but every other granted
    entity (the other ~50) still has no confirmed field list at all.
- **`IntegrationSyncChange`** — one row per record a sync run creates, updates, or
  deletes, storing a before/after snapshot (mirrors `AuditLog`'s `beforeJson`/
  `afterJson` shape). This is what a future "undo this run" or "undo everything from
  today" admin action would read from and write `revertedAt` to. **Nothing writes to
  this yet** — no sync exists to populate it, and no rollback action exists to read it.
- **Field ownership guard for staff edits** — `updateUser` and the quick role-change
  action now reject changes to `fullName` or `role` when the `User` row is sourced
  from Arbor (`dataSource === "ARBOR"`). No-op saves are allowed, and non-Arbor staff
  records remain manually editable. This is deliberately narrow: it protects the
  confirmed Arbor-owned fields without blocking unrelated Anaxi-only settings like
  email preferences.
- **`BehaviourIncident`** — one row per individual behaviour event (a detention, a
  suspension, an award of positive points), alongside `StudentSnapshot`'s existing
  daily totals rather than replacing them (decision: keep both — see below).
  **Nothing writes to or reads from this yet.** Category names and what `reasonCode`
  should hold are guesses pending Arbor's real incident shape.

## Decisions made (2026-09-26)

- **Field ownership: block the edit.** Once a field is synced from Arbor, Arbor is the
  source of truth — a manual edit to that field in Anaxi should be rejected outright,
  not silently overwritten later or excluded from future syncs. `dataSource` on each
  row is what edit actions check before allowing a write. This is now enforced for
  staff `fullName` and `role` edits in the admin user directory. There's no student
  edit screen yet at all, so nothing to guard there yet.
- **Behaviour: store both totals and incidents.** `StudentSnapshot`'s daily totals stay
  exactly as every existing screen (Progress 8, assessment analysis, the behaviour
  import) already reads them. `BehaviourIncident` is additive, for the detail totals
  throw away. **Not yet wired up**: nothing recomputes `StudentSnapshot` totals from
  `BehaviourIncident` rows, since that logic depends on Arbor's real incident shape.
- **New staff/students created by a sync get the same onboarding email** an admin
  creating them by hand triggers today (`sendOnboardingEmail`, see
  `app/(tenant)/admin/users/actions.ts`). Not yet wired to anything, since there's no
  sync to trigger it.
- **Arbor connection is platform-managed but has explicit school destinations.** A
  super admin configures one encrypted Arbor source in God Mode and selects which
  Anaxi schools receive it. This supports Goresbrook Primary and Secondary sharing
  one Arbor instance without merging the two schools' records. A future sync must
  still confirm the source-school routing rule before it writes any data.
- **Goresbrook student routing uses academic level, not name matching.** Nursery
  (including Arbor's Nursery Pre-school, Nursery Y1 and Nursery Y2 levels) through
  Year 6 belong to Primary; Years 7 through 13 belong to Secondary. Students
  with no academic level are treated as off-roll and skipped; Nursery and unexpected
  non-empty labels are not imported until reviewed. Staff cannot
  use this rule because they have no year group, so staff routing needs its own
  explicit decision before import is enabled.
- **Sync activity gets an audit trail**, same principle as `AuditLog` already gives
  every admin action. Decided *not* to force sync writes through `AuditLog` itself:
  its `actorUserId` is a required field pointing at a real `User`, and a
  scheduled/cron-triggered sync has no human actor to attach to one. `IntegrationSyncRun`
  (`triggeredBy`: a user id or `"CRON"`) plus the new `IntegrationSyncChange` serve as
  the sync-specific equivalent instead.

## What's still needed before building the real sync

1. **Field lists for the other ~50 granted entities.** Arbor's docs confirmed auth,
   transport, and fields for `Staff`/`Student`/`TeachingGroup` specifically (now
   built — see above), but nothing for `detention`, `internalExclusion`,
   `fixedPeriodExclusion`, `pointAward`, any of the five assessment subsystems,
   `senStatus`/`ukDfe_PupilPremiumRecipient`/`ukDfe_UpnAssignment`,
   `timetableSlot`/`timetablePeriod`, or the rest. The GraphQL editor's "DOCS" sidebar
   (in-browser, needs a login) or an introspection query against a reachable Arbor
   instance would give the real field list per entity — better than guessing from the
   generic docs examples, several of which reference entities Anaxi doesn't have
   (`Guardian`, `Demographic`, `medicalConditions`, `profilePicture` — see below).
2. **Sandbox credentials and network access**, to actually run
   `ArborClient.listStaff()` etc. and confirm the transport layer built above works
   end to end — right now it's built correctly against the documented contract, but
   literally never been run. Production credentials can now be stored through the
   encrypted God Mode connection screen; sandbox credentials should use the same
   path in a non-production environment, never chat or source control. The portal
   has a "Sandboxes (testing)" page under
   APPS/DOCS — same place the permission grant and REST/GraphQL docs came from.
   Sandbox hostname is `api-sandbox` per the REST docs' own examples.
3. **Student and staff avatar photos need a permission added in the Developer
   Portal, not more code.** Arbor's GraphQL docs example for `Staff` shows a
   `profilePicture { thumbnailFile { base64 } }` field — exactly what the photo
   requirement needs — but `profilePicture` is not among Anaxi's 54 granted entities.
   Add it in the Developer Portal's permission-set screen before building this; the
   `avatarImage`/`avatarMimeType`/`avatarUpdatedAt` columns already exist on `Student`
   and `User` to receive it once that's done.
4. **Which access level we've been granted** — Developer Portal/partner access that
   covers many schools, or one school's own approval under their
   *System > Partner Apps (API Users)*? This decides how credentials get stored and
   whether onboarding a new school needs its own approval step.
5. **Whether Arbor's API supports incremental sync** ("what changed since X") or only
   a full pull each time. Decides how often a sync can realistically run, and how the
   sync orchestrator (below) diffs what it gets back against what Anaxi already has.
6. **Per-school assessment mapping — now known to be bigger than one mapping step.**
   Arbor's permission grant shows five largely separate assessment subsystems, not
   one: `adHocAssessment*` (one-off marks), `standardizedAssessment*` (likely where
   KS2 scaled scores and other standardised tests live), `progressAssessment*` /
   `progressMeasurementPeriod*` (ongoing tracking against a defined period, closest
   analogue to Anaxi's `AssessmentCycle`/`AssessmentPoint`), `qualification*`
   (GCSE/A-level-shaped results and forecasts), and `grade*`/`assessmentGradeSet`
   (the grading scales the others reference). Anaxi's single
   `AssessmentCycle → Point → Assessment → Result` chain does not map onto this 1:1.
   Before building this, decide per subsystem: sync it at all, and if so onto which
   existing Anaxi model (or a new one) — this needs the field-level docs (item 1) to
   do properly, since the subsystems' exact relationships to each other are still
   unconfirmed from entity names alone.
7. **A class-roster model — shape now confirmed, fields still not.** Arbor has its own
   `teachingGroup`, `teachingGroupMembership`, and `teachingGroupTutor` entities
   (confirmed in `entities.ts`), which is exactly the shape guessed at in an earlier
   version of this doc: a `TeachingGroup` (id, classCode, subject, yearGroup,
   `dataSource`/`externalId`) with a `TeachingGroupMembership` join table (student,
   group, effective dates, `dataSource`/`externalId`). **Not yet built as Prisma
   models** — waiting on the field-level docs (item 1) so the columns aren't another
   guess, and on confirming how a teaching group relates to `timetableSlot` (one group
   → many weekly slots is the likely shape, per `timetableSlot` referencing
   `timetablePeriod`, but unconfirmed).
8. **A "what lesson is on now" resolver, for observations.** `TimetableEntry` already
   carries `dayOfWeek`, `period`, `weekPattern`, `startTime` and `endTime` per slot, so
   the raw data to answer "what is this teacher teaching right now" is there once
   synced — and Arbor's own `timetablePeriod` entity (confirmed) is almost certainly
   the bell-times definition each `timetableSlot` references, which is better than
   Anaxi repeating start/end times on every row as it does today. What's still missing
   is the resolution logic: matching the current date/time against a slot, and — for
   any school running a fortnightly (Week A/B) timetable — knowing which week the
   school is currently on, which isn't derivable from the timetable data alone and
   needs either an admin-set "today is Week A" toggle or Arbor's own notion of the
   current week (unconfirmed whether one exists). Worth a short follow-up ticket once
   timetable sync exists and we can see real `timetablePeriod`/`weekPattern` values;
   not schema groundwork, since the fields it needs already exist.
9. **The sync orchestrator itself.** Nothing today actually calls Arbor and writes
   the results in. `IntegrationSyncRun`/`IntegrationSyncChange` are just the places a
   sync would log to. Needs: how a large school's worth of records gets batched
   without one giant transaction, what happens when it dies partway through (resume,
   or restart clean?), and retry/backoff on a failed request (try again, waiting a bit
   longer each time, rather than either giving up on the first blip or hammering
   Arbor's API). Blocked on item 4 above — incremental vs full-pull changes this
   design significantly.
10. **Sync history and review screens.** God Mode can now configure the shared Arbor
    connection and its school destinations, but there is not yet a record of real
    runs, a pre-sync change preview, or an undo screen. Those will read from
    `IntegrationSyncRun` and `IntegrationSyncChange` once a sync exists.
11. **The actual rollback action** ("undo this run" / "undo everything from today"),
    reading `IntegrationSyncChange` and writing each row's `beforeJson` back,
    recording `revertedAt` as it goes. The storage for this exists now; the action
    doesn't.
12. **SEND and Pupil Premium are their own entities in Arbor, not flags** —
    `senStatus`/`senStatusAssignment` and `ukDfe_PupilPremiumRecipient` — and UPN is
    assigned via `ukDfe_UpnAssignment` rather than being a plain field either. Syncing
    `Student.sendFlag`/`ppFlag`/`upn` needs its own small sync step per entity (read
    the assignment, derive the boolean/value), not just reading them off the student
    record. Low effort once the field docs exist, but worth planning for rather than
    assuming these come free with the student sync.
13. **Behaviour syncs per entity type, not from one unified feed.** `detention`,
    `internalExclusion`, `fixedPeriodExclusion`, and `pointAward` are four separate
    Arbor entities (confirmed), each presumably with its own fields — not one
    "incident" endpoint with a category field. `BehaviourIncident.category` can still
    hold the mapped value, but the sync step needs to call (or query) each entity type
    separately and map it to the right category, rather than one generic incident
    reader.

## Suggested build order

1. Staff sync (smallest surface, no cross-entity linking).
2. Student sync (adds leaver handling, which the CSV import doesn't do today).
3. Class lists / timetable (the biggest functional gain — Anaxi doesn't currently know
   which students are in which class).
4. Behaviour and assessment results (need the modelling/mapping decisions above first).
5. Put the whole thing on a schedule, the same way the existing cron endpoints work
   (`lib/cronAuth.ts` + `x-cron-secret`).
