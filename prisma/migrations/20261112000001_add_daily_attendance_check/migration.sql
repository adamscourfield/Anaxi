-- CreateTable
CREATE TABLE "DailyAttendanceCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL,
    "possibleCount" INTEGER NOT NULL,
    "presentCount" INTEGER NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAttendanceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyAttendanceCheck_tenantId_checkDate_key" ON "DailyAttendanceCheck"("tenantId", "checkDate");

-- AddForeignKey
ALTER TABLE "DailyAttendanceCheck" ADD CONSTRAINT "DailyAttendanceCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
