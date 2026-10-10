-- Arbor assessment points were previously stamped with the import timestamp.
-- Restore their historic assessment date so no current teacher can be credited
-- with a prior academic year's result.
UPDATE "AssessmentPoint" AS point
SET "assessedAt" = COALESCE(
  point."dateTaken",
  CASE
    WHEN point."label" = 'Autumn' THEN make_date(split_part(cycle."academicYear", '/', 1)::integer, 12, 15)
    WHEN point."label" = 'Spring' THEN make_date(split_part(cycle."academicYear", '/', 1)::integer + 1, 3, 31)
    WHEN point."label" = 'Summer' THEN make_date(split_part(cycle."academicYear", '/', 1)::integer + 1, 7, 15)
    WHEN point."label" = 'Final' THEN make_date(split_part(cycle."academicYear", '/', 1)::integer + 1, 8, 31)
    ELSE point."assessedAt"
  END
)
FROM "AssessmentCycle" AS cycle
WHERE point."cycleId" = cycle."id"
  AND point."dataSource" = 'ARBOR';
