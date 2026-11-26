-- One stored form for year groups: "Y7" … "Y14", "R" (Reception), "N" (Nursery).
-- Older imports and the previous observation form wrote "8", "08", "Year 8", "Yr 8", "y8", "Rec".
-- Labels shown to people ("Year 8") come from lib/yearGroup.ts, not from the stored value.
-- Only values that are clearly a single year are changed; anything else is left as it was.

-- Single numeric years: "8", "08", "Year 8", "Yr 8", "y8", "Y 8" -> "Y8"
UPDATE "Student" SET "yearGroup" = 'Y' || ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int
WHERE "yearGroup" ~* '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$'
  AND ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int BETWEEN 1 AND 14
  AND "yearGroup" !~ '^Y([1-9]|1[0-4])$';

UPDATE "Observation" SET "yearGroup" = 'Y' || ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int
WHERE "yearGroup" ~* '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$'
  AND ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int BETWEEN 1 AND 14
  AND "yearGroup" !~ '^Y([1-9]|1[0-4])$';

UPDATE "Insight" SET "yearGroup" = 'Y' || ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int
WHERE "yearGroup" ~* '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$'
  AND ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int BETWEEN 1 AND 14
  AND "yearGroup" !~ '^Y([1-9]|1[0-4])$';

UPDATE "TimetableEntry" SET "yearGroup" = 'Y' || ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int
WHERE "yearGroup" ~* '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$'
  AND ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int BETWEEN 1 AND 14
  AND "yearGroup" !~ '^Y([1-9]|1[0-4])$';

UPDATE "Assessment" SET "yearGroup" = 'Y' || ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int
WHERE "yearGroup" ~* '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$'
  AND ((regexp_match("yearGroup", '^\s*(?:year|yr|y)?\s*0?(\d{1,2})\s*$', 'i'))[1])::int BETWEEN 1 AND 14
  AND "yearGroup" !~ '^Y([1-9]|1[0-4])$';

-- Reception and Nursery
UPDATE "Student" SET "yearGroup" = 'R' WHERE "yearGroup" ~* '^\s*(r|rec|reception|year r|yr r)\s*$' AND "yearGroup" <> 'R';
UPDATE "Observation" SET "yearGroup" = 'R' WHERE "yearGroup" ~* '^\s*(r|rec|reception|year r|yr r)\s*$' AND "yearGroup" <> 'R';
UPDATE "Insight" SET "yearGroup" = 'R' WHERE "yearGroup" ~* '^\s*(r|rec|reception|year r|yr r)\s*$' AND "yearGroup" <> 'R';
UPDATE "TimetableEntry" SET "yearGroup" = 'R' WHERE "yearGroup" ~* '^\s*(r|rec|reception|year r|yr r)\s*$' AND "yearGroup" <> 'R';
UPDATE "Assessment" SET "yearGroup" = 'R' WHERE "yearGroup" ~* '^\s*(r|rec|reception|year r|yr r)\s*$' AND "yearGroup" <> 'R';

UPDATE "Student" SET "yearGroup" = 'N' WHERE "yearGroup" ~* '^\s*(n|nur|nursery.*)\s*$' AND "yearGroup" <> 'N';
UPDATE "Observation" SET "yearGroup" = 'N' WHERE "yearGroup" ~* '^\s*(n|nur|nursery.*)\s*$' AND "yearGroup" <> 'N';
UPDATE "Insight" SET "yearGroup" = 'N' WHERE "yearGroup" ~* '^\s*(n|nur|nursery.*)\s*$' AND "yearGroup" <> 'N';
UPDATE "TimetableEntry" SET "yearGroup" = 'N' WHERE "yearGroup" ~* '^\s*(n|nur|nursery.*)\s*$' AND "yearGroup" <> 'N';
UPDATE "Assessment" SET "yearGroup" = 'N' WHERE "yearGroup" ~* '^\s*(n|nur|nursery.*)\s*$' AND "yearGroup" <> 'N';
