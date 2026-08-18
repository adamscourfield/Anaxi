-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'TEACHER', 'LEADER', 'HOD', 'SLT', 'ADMIN', 'HR', 'ON_CALL');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImportJobType" AS ENUM ('STUDENT_SNAPSHOT', 'STUDENTS_SNAPSHOT', 'STUDENT_SUBJECT_TEACHERS', 'STAFF_IMPORT', 'TIMETABLE');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'RUNNING', 'SUCCESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CountScope" AS ENUM ('ROLLING_21_DAYS', 'ROLLING_28_DAYS', 'TERM_TO_DATE', 'YEAR_TO_DATE');

-- CreateEnum
CREATE TYPE "OnCallRequestType" AS ENUM ('BEHAVIOUR', 'FIRST_AID');

-- CreateEnum
CREATE TYPE "OnCallStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('DRIFT_DOWN', 'DRIFT_UP', 'HOTSPOT', 'COVERAGE_GAP', 'BEHAVIOUR_SPIKE', 'TRIANGULATED_RISK');

-- CreateEnum
CREATE TYPE "InsightScope" AS ENUM ('WHOLE_SCHOOL', 'YEAR', 'SUBJECT', 'TEACHER');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('LINE_MANAGEMENT', 'DEPARTMENT', 'PASTORAL', 'SEN', 'OTHER');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AnalysisRunType" AS ENUM ('STUDENT_RISK', 'TEACHER_RISK', 'CPD_PRIORITIES', 'BEHAVIOUR_COHORTS');

-- CreateEnum
CREATE TYPE "AnalysisRunStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "SignalKey" AS ENUM ('BEHAVIOUR_CLIMATE', 'PARTICIPATION_EQUITY', 'PACE_MOMENTUM', 'COLD_CALL_DENSITY', 'CFU_CYCLES', 'ERROR_CORRECTION_DEPTH', 'MODELLING_EXPLICITNESS', 'LANGUAGE_PRECISION', 'LIVE_ADJUSTMENT', 'RETRIEVAL_PRESENCE', 'STRETCH_DEPLOYMENT', 'INDEPENDENT_ACCOUNTABILITY');

-- CreateEnum
CREATE TYPE "LeaveApprovalGroupAppliesTo" AS ENUM ('ALL_STAFF', 'SELECTED_MEMBERS');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canApproveAllLoa" BOOLEAN NOT NULL DEFAULT false,
    "receivesOnCallEmails" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TenantFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantVocab" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "labelSingular" TEXT NOT NULL,
    "labelPlural" TEXT NOT NULL,

    CONSTRAINT "TenantVocab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSignalLabel" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "signalKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "TenantSignalLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoaReason" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LoaReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LOAAuthoriser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LOAAuthoriser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LOAApprovalScope" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,

    CONSTRAINT "LOAApprovalScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LOARequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reasonId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LOARequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnCallReason" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "OnCallReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnCallLocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "OnCallLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnCallRecipient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "OnCallRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "upn" TEXT,
    "fullName" TEXT NOT NULL,
    "yearGroup" TEXT,
    "sendFlag" BOOLEAN NOT NULL DEFAULT false,
    "ppFlag" BOOLEAN NOT NULL DEFAULT false,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "countScope" "CountScope" NOT NULL DEFAULT 'TERM_TO_DATE',
    "positivePointsTotal" INTEGER NOT NULL DEFAULT 0,
    "detentionsCount" INTEGER NOT NULL DEFAULT 0,
    "internalExclusionsCount" INTEGER NOT NULL DEFAULT 0,
    "suspensionsCount" INTEGER NOT NULL DEFAULT 0,
    "onCallsCount" INTEGER NOT NULL DEFAULT 0,
    "attendancePct" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "latenessCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentChangeFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "flagKey" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "baselineFrom" TIMESTAMP(3) NOT NULL,
    "baselineTo" TIMESTAMP(3) NOT NULL,
    "currentFrom" TIMESTAMP(3) NOT NULL,
    "currentTo" TIMESTAMP(3) NOT NULL,
    "detailsJson" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentChangeFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentSubjectTeacher" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "StudentSubjectTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ImportJobType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedBy" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "rowsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "errorReportJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMappingConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "mappingJson" JSONB NOT NULL,

    CONSTRAINT "ImportMappingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantImportMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ImportJobType" NOT NULL,
    "name" TEXT NOT NULL,
    "mappingJson" JSONB NOT NULL,
    "fixedCountScope" "CountScope",
    "headerSignature" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnCallRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestType" "OnCallRequestType" NOT NULL,
    "location" TEXT NOT NULL,
    "behaviourReasonCategory" TEXT,
    "notes" TEXT,
    "status" "OnCallStatus" NOT NULL DEFAULT 'OPEN',
    "responderUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnCallRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "scope" "InsightScope" NOT NULL,
    "yearGroup" TEXT,
    "subject" TEXT,
    "teacherId" TEXT,
    "signalKey" "SignalKey",
    "windowDays" INTEGER NOT NULL DEFAULT 21,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "deltaValue" DOUBLE PRECISION NOT NULL,
    "observationCount" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "linkPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "observedTeacherId" TEXT NOT NULL,
    "observerId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "yearGroup" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "classCode" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "contextNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationSignal" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "signalKey" TEXT NOT NULL,
    "valueKey" TEXT,
    "notObserved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ObservationSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isHeadOfDepartment" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "coachUserId" TEXT NOT NULL,
    "coacheeUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApprovalGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appliesTo" "LeaveApprovalGroupAppliesTo" NOT NULL DEFAULT 'ALL_STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveApprovalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApprovalGroupMember" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,

    CONSTRAINT "LeaveApprovalGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApprovalGroupScope" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,

    CONSTRAINT "LeaveApprovalGroupScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "schoolName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "defaultInsightWindowDays" INTEGER NOT NULL DEFAULT 21,
    "positivePointsLabel" TEXT NOT NULL DEFAULT 'Positive Points',
    "detentionLabel" TEXT NOT NULL DEFAULT 'Detention',
    "internalExclusionLabel" TEXT NOT NULL DEFAULT 'Internal Exclusion',
    "suspensionLabel" TEXT NOT NULL DEFAULT 'Suspension',
    "onCallLabel" TEXT NOT NULL DEFAULT 'On Call',
    "driftDeltaThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "minObservationCount" INTEGER NOT NULL DEFAULT 3,
    "behaviourSpikePercent" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classCode" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "yearGroup" TEXT NOT NULL,
    "teacherUserId" TEXT,
    "teacherEmailRaw" TEXT,
    "room" TEXT,
    "dayOfWeek" INTEGER,
    "period" TEXT,
    "weekPattern" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "slotKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableImportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "uploadedByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "rowsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorReportJson" JSONB,
    "conflictsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "TimetableImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentWatchlist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "AnalysisRunType" NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "status" "AnalysisRunStatus" NOT NULL DEFAULT 'PENDING',
    "computedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolAdminInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolAdminInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyArea" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "owner" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "StrategyArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyNote" (
    "id" TEXT NOT NULL,
    "strategyAreaId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "StrategyNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_id_key" ON "User"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeature_tenantId_key_key" ON "TenantFeature"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "TenantVocab_tenantId_key_key" ON "TenantVocab"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSignalLabel_tenantId_signalKey_key" ON "TenantSignalLabel"("tenantId", "signalKey");

-- CreateIndex
CREATE UNIQUE INDEX "LoaReason_tenantId_label_key" ON "LoaReason"("tenantId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "LOAAuthoriser_tenantId_userId_key" ON "LOAAuthoriser"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LOAApprovalScope_tenantId_approverId_targetUserId_key" ON "LOAApprovalScope"("tenantId", "approverId", "targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OnCallReason_tenantId_label_key" ON "OnCallReason"("tenantId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "OnCallLocation_tenantId_label_key" ON "OnCallLocation"("tenantId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "OnCallRecipient_tenantId_email_key" ON "OnCallRecipient"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_tenantId_upn_key" ON "Student"("tenantId", "upn");

-- CreateIndex
CREATE UNIQUE INDEX "Student_tenantId_id_key" ON "Student"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSnapshot_tenantId_studentId_snapshotDate_key" ON "StudentSnapshot"("tenantId", "studentId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_tenantId_name_key" ON "Subject"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_tenantId_id_key" ON "Subject"("tenantId", "id");

-- CreateIndex
CREATE INDEX "StudentSubjectTeacher_tenantId_studentId_subjectId_effectiv_idx" ON "StudentSubjectTeacher"("tenantId", "studentId", "subjectId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "StudentSubjectTeacher_tenantId_studentId_subjectId_teacherI_key" ON "StudentSubjectTeacher"("tenantId", "studentId", "subjectId", "teacherId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ImportJob_tenantId_createdAt_idx" ON "ImportJob"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMappingConfig_tenantId_importType_key" ON "ImportMappingConfig"("tenantId", "importType");

-- CreateIndex
CREATE INDEX "TenantImportMapping_tenantId_type_idx" ON "TenantImportMapping"("tenantId", "type");

-- CreateIndex
CREATE INDEX "TenantImportMapping_headerSignature_idx" ON "TenantImportMapping"("headerSignature");

-- CreateIndex
CREATE INDEX "OnCallRequest_tenantId_idx" ON "OnCallRequest"("tenantId");

-- CreateIndex
CREATE INDEX "OnCallRequest_tenantId_status_idx" ON "OnCallRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "OnCallRequest_tenantId_createdAt_idx" ON "OnCallRequest"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "OnCallRequest_tenantId_status_createdAt_idx" ON "OnCallRequest"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OnCallRequest_requesterUserId_status_idx" ON "OnCallRequest"("requesterUserId", "status");

-- CreateIndex
CREATE INDEX "Insight_tenantId_createdAt_idx" ON "Insight"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Insight_tenantId_type_idx" ON "Insight"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Insight_tenantId_severity_createdAt_idx" ON "Insight"("tenantId", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "Observation_tenantId_observedAt_idx" ON "Observation"("tenantId", "observedAt");

-- CreateIndex
CREATE INDEX "Observation_tenantId_observedTeacherId_observedAt_idx" ON "Observation"("tenantId", "observedTeacherId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ObservationSignal_observationId_signalKey_key" ON "ObservationSignal"("observationId", "signalKey");

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "Department"("tenantId", "name");

-- CreateIndex
CREATE INDEX "DepartmentMembership_tenantId_departmentId_idx" ON "DepartmentMembership"("tenantId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMembership_departmentId_userId_key" ON "DepartmentMembership"("departmentId", "userId");

-- CreateIndex
CREATE INDEX "CoachAssignment_tenantId_coachUserId_idx" ON "CoachAssignment"("tenantId", "coachUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachAssignment_tenantId_coachUserId_coacheeUserId_key" ON "CoachAssignment"("tenantId", "coachUserId", "coacheeUserId");

-- CreateIndex
CREATE INDEX "LeaveApprovalGroup_tenantId_idx" ON "LeaveApprovalGroup"("tenantId");

-- CreateIndex
CREATE INDEX "LeaveApprovalGroupMember_tenantId_idx" ON "LeaveApprovalGroupMember"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApprovalGroupMember_groupId_approverUserId_key" ON "LeaveApprovalGroupMember"("groupId", "approverUserId");

-- CreateIndex
CREATE INDEX "LeaveApprovalGroupScope_tenantId_idx" ON "LeaveApprovalGroupScope"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApprovalGroupScope_groupId_subjectUserId_key" ON "LeaveApprovalGroupScope"("groupId", "subjectUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_tenantId_key" ON "TenantSettings"("tenantId");

-- CreateIndex
CREATE INDEX "TimetableEntry_tenantId_yearGroup_subject_classCode_idx" ON "TimetableEntry"("tenantId", "yearGroup", "subject", "classCode");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntry_tenantId_classCode_slotKey_key" ON "TimetableEntry"("tenantId", "classCode", "slotKey");

-- CreateIndex
CREATE INDEX "TimetableImportJob_tenantId_createdAt_idx" ON "TimetableImportJob"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Meeting_tenantId_startDateTime_idx" ON "Meeting"("tenantId", "startDateTime");

-- CreateIndex
CREATE INDEX "Meeting_createdByUserId_idx" ON "Meeting"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_tenantId_id_key" ON "Meeting"("tenantId", "id");

-- CreateIndex
CREATE INDEX "MeetingAttendee_userId_meetingId_idx" ON "MeetingAttendee"("userId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendee_meetingId_userId_key" ON "MeetingAttendee"("meetingId", "userId");

-- CreateIndex
CREATE INDEX "MeetingAction_ownerUserId_status_idx" ON "MeetingAction"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "MeetingAction_meetingId_status_idx" ON "MeetingAction"("meetingId", "status");

-- CreateIndex
CREATE INDEX "MeetingAction_tenantId_dueDate_idx" ON "MeetingAction"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "MeetingAction_ownerUserId_dueDate_idx" ON "MeetingAction"("ownerUserId", "dueDate");

-- CreateIndex
CREATE INDEX "StudentWatchlist_tenantId_studentId_idx" ON "StudentWatchlist"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentWatchlist_tenantId_studentId_createdByUserId_key" ON "StudentWatchlist"("tenantId", "studentId", "createdByUserId");

-- CreateIndex
CREATE INDEX "AnalysisRun_tenantId_type_computedAt_idx" ON "AnalysisRun"("tenantId", "type", "computedAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolAdminInvite_tokenHash_key" ON "SchoolAdminInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "SchoolAdminInvite_tenantId_email_idx" ON "SchoolAdminInvite"("tenantId", "email");

-- CreateIndex
CREATE INDEX "StrategyArea_tenantId_idx" ON "StrategyArea"("tenantId");

-- CreateIndex
CREATE INDEX "StrategyArea_tenantId_completed_idx" ON "StrategyArea"("tenantId", "completed");

-- CreateIndex
CREATE INDEX "StrategyNote_strategyAreaId_idx" ON "StrategyNote"("strategyAreaId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeature" ADD CONSTRAINT "TenantFeature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantVocab" ADD CONSTRAINT "TenantVocab_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSignalLabel" ADD CONSTRAINT "TenantSignalLabel_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoaReason" ADD CONSTRAINT "LoaReason_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LOAAuthoriser" ADD CONSTRAINT "LOAAuthoriser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LOAAuthoriser" ADD CONSTRAINT "LOAAuthoriser_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LOAApprovalScope" ADD CONSTRAINT "LOAApprovalScope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LOAApprovalScope" ADD CONSTRAINT "LOAApprovalScope_tenantId_approverId_fkey" FOREIGN KEY ("tenantId", "approverId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LOAApprovalScope" ADD CONSTRAINT "LOAApprovalScope_tenantId_targetUserId_fkey" FOREIGN KEY ("tenantId", "targetUserId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LOARequest" ADD CONSTRAINT "LOARequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LOARequest" ADD CONSTRAINT "LOARequest_tenantId_requesterId_fkey" FOREIGN KEY ("tenantId", "requesterId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LOARequest" ADD CONSTRAINT "LOARequest_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "LoaReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallReason" ADD CONSTRAINT "OnCallReason_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallLocation" ADD CONSTRAINT "OnCallLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallRecipient" ADD CONSTRAINT "OnCallRecipient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSnapshot" ADD CONSTRAINT "StudentSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentChangeFlag" ADD CONSTRAINT "StudentChangeFlag_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubjectTeacher" ADD CONSTRAINT "StudentSubjectTeacher_tenantId_studentId_fkey" FOREIGN KEY ("tenantId", "studentId") REFERENCES "Student"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubjectTeacher" ADD CONSTRAINT "StudentSubjectTeacher_tenantId_subjectId_fkey" FOREIGN KEY ("tenantId", "subjectId") REFERENCES "Subject"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSubjectTeacher" ADD CONSTRAINT "StudentSubjectTeacher_tenantId_teacherId_fkey" FOREIGN KEY ("tenantId", "teacherId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportMappingConfig" ADD CONSTRAINT "ImportMappingConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantImportMapping" ADD CONSTRAINT "TenantImportMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantImportMapping" ADD CONSTRAINT "TenantImportMapping_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallRequest" ADD CONSTRAINT "OnCallRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallRequest" ADD CONSTRAINT "OnCallRequest_tenantId_requesterUserId_fkey" FOREIGN KEY ("tenantId", "requesterUserId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallRequest" ADD CONSTRAINT "OnCallRequest_tenantId_studentId_fkey" FOREIGN KEY ("tenantId", "studentId") REFERENCES "Student"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnCallRequest" ADD CONSTRAINT "OnCallRequest_tenantId_responderUserId_fkey" FOREIGN KEY ("tenantId", "responderUserId") REFERENCES "User"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_observedTeacherId_fkey" FOREIGN KEY ("observedTeacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_observerId_fkey" FOREIGN KEY ("observerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationSignal" ADD CONSTRAINT "ObservationSignal_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAssignment" ADD CONSTRAINT "CoachAssignment_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAssignment" ADD CONSTRAINT "CoachAssignment_coacheeUserId_fkey" FOREIGN KEY ("coacheeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalGroupMember" ADD CONSTRAINT "LeaveApprovalGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LeaveApprovalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalGroupMember" ADD CONSTRAINT "LeaveApprovalGroupMember_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalGroupScope" ADD CONSTRAINT "LeaveApprovalGroupScope_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LeaveApprovalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalGroupScope" ADD CONSTRAINT "LeaveApprovalGroupScope_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableImportJob" ADD CONSTRAINT "TimetableImportJob_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_tenantId_createdByUserId_fkey" FOREIGN KEY ("tenantId", "createdByUserId") REFERENCES "User"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_tenantId_meetingId_fkey" FOREIGN KEY ("tenantId", "meetingId") REFERENCES "Meeting"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAction" ADD CONSTRAINT "MeetingAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAction" ADD CONSTRAINT "MeetingAction_tenantId_meetingId_fkey" FOREIGN KEY ("tenantId", "meetingId") REFERENCES "Meeting"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAction" ADD CONSTRAINT "MeetingAction_tenantId_ownerUserId_fkey" FOREIGN KEY ("tenantId", "ownerUserId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAction" ADD CONSTRAINT "MeetingAction_tenantId_createdByUserId_fkey" FOREIGN KEY ("tenantId", "createdByUserId") REFERENCES "User"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAction" ADD CONSTRAINT "MeetingAction_tenantId_completedByUserId_fkey" FOREIGN KEY ("tenantId", "completedByUserId") REFERENCES "User"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWatchlist" ADD CONSTRAINT "StudentWatchlist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWatchlist" ADD CONSTRAINT "StudentWatchlist_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWatchlist" ADD CONSTRAINT "StudentWatchlist_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAdminInvite" ADD CONSTRAINT "SchoolAdminInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAdminInvite" ADD CONSTRAINT "SchoolAdminInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyArea" ADD CONSTRAINT "StrategyArea_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyNote" ADD CONSTRAINT "StrategyNote_strategyAreaId_fkey" FOREIGN KEY ("strategyAreaId") REFERENCES "StrategyArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyNote" ADD CONSTRAINT "StrategyNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

