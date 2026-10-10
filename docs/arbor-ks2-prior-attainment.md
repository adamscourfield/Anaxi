# KS2 prior attainment from Arbor

Student profiles and Progress 8 use `Student.ks2ReadingScaledScore` and
`Student.ks2MathsScaledScore`. Importing normal secondary assessment cycles does
not populate these fields: KS2 results belong to Arbor's standardised assessment
subsystem.

The KS2 backfill matches only students already linked to the selected Arbor
connection's enabled schools by external ID. It accepts whole-number scaled
scores from 80 to 120, keeps reading and mathematics separate, and preserves
existing Anaxi values. Duplicate identical results are harmless; conflicting
results for one pupil and subject are skipped for review. Missing results stay
missing rather than being replaced with zero or inferred scores.

Open **God Mode → Arbor → Assessment syncing → Import KS2 prior attainment**.
The protected preview at `/god/integrations/arbor/ks2?connectionId=...` shows
matched assessment definitions, available marks, and how many missing scores
can be filled. Select **Import missing KS2 scores** to run the audited backfill.

The importer reads `StandardizedAssessment` and
`StudentStandardizedAssessmentMark` through the existing read-only Arbor
connection. These fields were checked against the live schema. It does not
traverse restricted assessment-aspect or assessment-template models, and does
not require broader Arbor permissions. It checks for the definition-ID filter
in Arbor's query schema before using it; otherwise it pages the mark source to
completion before writing anything.

Only explicitly scaled KS2 reading/mathematics definitions are accepted (or
those with a declared 80–120 scale). Raw test scores, categorical attainment
outcomes, KS1, and other subjects are excluded. Numeric marks and numeric grade
labels can supply the score; category values are never converted to scores.

Each student update and its integration audit entry are committed together.
Null checks in the database write preserve scores entered concurrently. A
retry fills only remaining gaps, including after a partially completed run.
