# Arbor MIS integration — groundwork

Anaxi has partner access to sync directly with Arbor's API (staff, students, class
lists/timetable, behaviour, assessment results) instead of relying on manual CSV
uploads. This document tracks what's in place and what's still needed before a real
sync can be built.

## What's in place

- **`dataSource` + `externalId` on `Student`, `User`, and `TimetableEntry`.**
  `dataSource` is `MANUAL` (created or edited by hand), `CSV_IMPORT`, or `ARBOR`.
  `externalId` holds the source system's own ID for that record — Arbor's student ID,
  staff ID, or timetable slot ID. `(tenantId, dataSource, externalId)` is unique per
  table, so a sync can always find "the record I created for this Arbor ID last time"
  instead of re-matching by name or email and risking duplicates.
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
4. **A decision on field ownership.** Once a field syncs from Arbor (e.g. a student's
   name), should a manual edit in Anaxi be blocked, allowed but overwritten on the next
   sync, or allowed and excluded from future syncs for that record? `dataSource` on
   each row gives us what we need to build whichever rule is chosen — the rule itself
   still needs deciding, per entity type.
5. **A modelling decision for behaviour.** Arbor stores individual incidents; Anaxi's
   `StudentSnapshot` stores totals per student per date. Either compute the totals from
   Arbor's incidents on sync, or move Anaxi to storing incidents directly (a bigger
   change, but keeps more detail).
6. **Per-school assessment mapping.** Every school sets up its assessments differently
   in Arbor, so pulling assessment results (beyond KS2 scaled scores, which map
   directly onto the existing `Student.ks2ReadingScaledScore` / `ks2MathsScaledScore`
   fields) needs a mapping step per school, similar to the CSV import's column mapping.

## Suggested build order

1. Staff sync (smallest surface, no cross-entity linking).
2. Student sync (adds leaver handling, which the CSV import doesn't do today).
3. Class lists / timetable (the biggest functional gain — Anaxi doesn't currently know
   which students are in which class).
4. Behaviour and assessment results (need the modelling/mapping decisions above first).
5. Put the whole thing on a schedule, the same way the existing cron endpoints work
   (`lib/cronAuth.ts` + `x-cron-secret`).
