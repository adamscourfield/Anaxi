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
- **`TenantIntegration`** — one row per school per provider (`IntegrationProvider`,
  currently just `ARBOR`). Holds connection status, non-secret config (e.g. the Arbor
  site ID), and the encrypted credentials blob. `credentialsCiphertext` is never
  plaintext — see `lib/integrationSecrets.ts` (AES-256-GCM, keyed by
  `INTEGRATION_ENCRYPTION_KEY`).
- **`IntegrationSyncRun`** — a log row per sync attempt per entity type (staff,
  students, classes, behaviour, assessments), with counts of records processed,
  created, updated and failed, and an error summary. Lets an admin or support see what
  a sync actually did, the same way `ImportJob` already does for CSV imports.
- **`lib/integrations/arbor/`** — `types.ts` and `client.ts` are placeholders. The
  field names in `types.ts` are guesses, not verified against Arbor's real API, and
  every `ArborClient` method throws rather than pretending to work. Do not wire this
  into a real sync yet.
- **`IntegrationSyncChange`** — one row per record a sync run creates, updates, or
  deletes, storing a before/after snapshot (mirrors `AuditLog`'s `beforeJson`/
  `afterJson` shape). This is what a future "undo this run" or "undo everything from
  today" admin action would read from and write `revertedAt` to. **Nothing writes to
  this yet** — no sync exists to populate it, and no rollback action exists to read it.
- **`BehaviourIncident`** — one row per individual behaviour event (a detention, a
  suspension, an award of positive points), alongside `StudentSnapshot`'s existing
  daily totals rather than replacing them (decision: keep both — see below).
  **Nothing writes to or reads from this yet.** Category names and what `reasonCode`
  should hold are guesses pending Arbor's real incident shape.

## Decisions made (2026-09-26)

- **Field ownership: block the edit.** Once a field is synced from Arbor, Arbor is the
  source of truth — a manual edit to that field in Anaxi should be rejected outright,
  not silently overwritten later or excluded from future syncs. `dataSource` on each
  row is what a future edit action checks before allowing a write.
  **Not yet enforced anywhere.** `updateUser` (the admin staff-edit action, in the
  separate name-editing PR) doesn't check `dataSource` yet — it can't, since that
  branch was written before `dataSource` existed on `User`. Once both PRs are on
  `main`, add the check there: reject a `fullName`/role edit when
  `user.dataSource === "ARBOR"`. There's no student edit screen yet at all, so nothing
  to guard there yet either.
- **Behaviour: store both totals and incidents.** `StudentSnapshot`'s daily totals stay
  exactly as every existing screen (Progress 8, assessment analysis, the behaviour
  import) already reads them. `BehaviourIncident` is additive, for the detail totals
  throw away. **Not yet wired up**: nothing recomputes `StudentSnapshot` totals from
  `BehaviourIncident` rows, since that logic depends on Arbor's real incident shape.
- **New staff/students created by a sync get the same onboarding email** an admin
  creating them by hand triggers today (`sendOnboardingEmail`, see
  `app/(tenant)/admin/users/actions.ts`). Not yet wired to anything, since there's no
  sync to trigger it.
- **Arbor connection is opt-in per school**, gated the same way every other feature
  already is (`TenantFeature` / `requireFeature`, not a new mechanism). **Not yet
  built** — there's no "connect Arbor" screen to gate yet.
- **Sync activity gets an audit trail**, same principle as `AuditLog` already gives
  every admin action. Decided *not* to force sync writes through `AuditLog` itself:
  its `actorUserId` is a required field pointing at a real `User`, and a
  scheduled/cron-triggered sync has no human actor to attach to one. `IntegrationSyncRun`
  (`triggeredBy`: a user id or `"CRON"`) plus the new `IntegrationSyncChange` serve as
  the sync-specific equivalent instead.

## What's still needed before building the real sync

1. **Arbor's actual API docs**, from the Developer Portal
   (https://developers-portal.arbor.sc) or pasted sections covering staff, students,
   class lists/timetable, behaviour and assessment endpoints — field names, pagination,
   auth method (API key vs OAuth), and rate limits.
2. **A sandbox school or test credentials**, stored in this environment's secrets
   settings (never in chat or committed to the repo), to run real requests against.
3. **Which access level we've been granted** — Developer Portal/partner access that
   covers many schools, or one school's own approval under their
   *System > Partner Apps (API Users)*? This decides how credentials get stored and
   whether onboarding a new school needs its own approval step.
4. **Whether Arbor's API supports incremental sync** ("what changed since X") or only
   a full pull each time. Decides how often a sync can realistically run, and how the
   sync orchestrator (below) diffs what it gets back against what Anaxi already has.
5. (resolved — see Decisions above)
6. **Per-school assessment mapping.** Every school sets up its assessments differently
   in Arbor, so pulling assessment points for every subject (beyond KS2 scaled scores,
   which map directly onto the existing `Student.ks2ReadingScaledScore` /
   `ks2MathsScaledScore` fields) needs a mapping step per school, similar to the CSV
   import's column mapping.
7. **A class-roster model.** Nothing in Anaxi currently records which students sit in
   which class. `TimetableEntry` has a `classCode` string and `StudentSubjectTeacher`
   links a student to a subject and teacher over a date range, but neither is "this
   list of students is Ms Patel's Year 10 English class." Arbor's own class/group
   concept should decide the shape here — likely a `TeachingGroup` (id, classCode,
   subject, yearGroup, `dataSource`/`externalId`) with a `TeachingGroupMembership` join
   table (student, group, effective dates, `dataSource`/`externalId`) — but building
   that blind risks guessing wrong about how Arbor's classes relate to timetable slots
   (one class → many weekly slots is the likely shape, but unconfirmed). Design this
   once we've seen a real "class" response from Arbor.
8. **A "what lesson is on now" resolver, for observations.** `TimetableEntry` already
   carries `dayOfWeek`, `period`, `weekPattern`, `startTime` and `endTime` per slot, so
   the raw data to answer "what is this teacher teaching right now" is there once
   synced. What's missing is the resolution logic: matching the current date/time
   against a slot, and — for any school running a fortnightly (Week A/B) timetable —
   knowing which week the school is currently on, which isn't derivable from the
   timetable data alone and needs either an admin-set "today is Week A" toggle or
   Arbor's own notion of the current week. Worth a short follow-up ticket once
   timetable sync exists and we can see real `weekPattern` values; not schema
   groundwork, since the fields it needs already exist.
9. **The sync orchestrator itself.** Nothing today actually calls Arbor and writes
   the results in. `IntegrationSyncRun`/`IntegrationSyncChange` are just the places a
   sync would log to. Needs: how a large school's worth of records gets batched
   without one giant transaction, what happens when it dies partway through (resume,
   or restart clean?), and retry/backoff on a failed request (try again, waiting a bit
   longer each time, rather than either giving up on the first blip or hammering
   Arbor's API). Blocked on item 4 above — incremental vs full-pull changes this
   design significantly.
10. **An admin-facing screen for connecting Arbor and viewing sync history.** Doesn't
    exist yet. The data for it (`TenantIntegration`, `IntegrationSyncRun`) does.
11. **The actual rollback action** ("undo this run" / "undo everything from today"),
    reading `IntegrationSyncChange` and writing each row's `beforeJson` back,
    recording `revertedAt` as it goes. The storage for this exists now; the action
    doesn't.

## Suggested build order

1. Staff sync (smallest surface, no cross-entity linking).
2. Student sync (adds leaver handling, which the CSV import doesn't do today).
3. Class lists / timetable (the biggest functional gain — Anaxi doesn't currently know
   which students are in which class).
4. Behaviour and assessment results (need the modelling/mapping decisions above first).
5. Put the whole thing on a schedule, the same way the existing cron endpoints work
   (`lib/cronAuth.ts` + `x-cron-secret`).
