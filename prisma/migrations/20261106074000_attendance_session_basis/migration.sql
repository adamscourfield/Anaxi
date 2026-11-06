ALTER TABLE "DailyAttendanceCheck"
  ADD COLUMN "fullDayBasis" TEXT NOT NULL DEFAULT 'LESSON',
  ADD COLUMN "fullDayUnknownSessionCount" INTEGER;
