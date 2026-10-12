-- Preserve distinct Arbor lesson groups for the same pupil, subject and teacher.
-- Existing rows are retained; the former unique index already guarantees these
-- new indexes can be created without duplicate data.
CREATE UNIQUE INDEX "StudentSubjectTeacher_class_identity_key"
ON "StudentSubjectTeacher" ("tenantId", "studentId", "subjectId", "teacherId", "effectiveFrom", "className");
CREATE UNIQUE INDEX "StudentSubjectTeacher_unnamed_identity_key"
ON "StudentSubjectTeacher" ("tenantId", "studentId", "subjectId", "teacherId", "effectiveFrom")
WHERE "className" IS NULL;
DROP INDEX "StudentSubjectTeacher_tenantId_studentId_subjectId_teacherI_key";
