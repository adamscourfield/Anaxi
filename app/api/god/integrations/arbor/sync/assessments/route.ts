import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { arborAssessmentLabel, mapArborAssessment, type ArborAssessmentMapping } from "@/lib/integrations/arbor/assessmentPolicy";
import { ArborClient } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { normalizeGrade } from "@/modules/assessments/gradeNormalizer";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string };
type AssessmentSyncState = { definitions?: PreparedDefinition[]; cursor?: number; markPage?: number; inspected?: number; matchedMarks?: number; importedMarks?: number; policyVersion?: number };
const ASSESSMENT_POLICY_VERSION = 2;

async function ensureAssessment(db: any, tenantId: string, createdByUserId: string, definition: PreparedDefinition, mapping: ArborAssessmentMapping) {
  const startYear = Number(mapping.academicYear.slice(0, 4));
  const cycle = await db.assessmentCycle.upsert({
    where: { tenantId_dataSource_externalId: { tenantId, dataSource: "ARBOR", externalId: mapping.cycleExternalId } },
    create: { tenantId, label: mapping.cycleLabel, cohortLabel: mapping.cohortLabel, qualificationType: mapping.qualificationType, academicYear: mapping.academicYear, startDate: new Date(`${startYear}-09-01T00:00:00.000Z`), endDate: new Date(`${startYear + 1}-08-31T23:59:59.999Z`), isActive: true, externalId: mapping.cycleExternalId, dataSource: "ARBOR" },
    update: { label: mapping.cycleLabel, cohortLabel: mapping.cohortLabel, qualificationType: mapping.qualificationType, academicYear: mapping.academicYear },
  });
  const point = await db.assessmentPoint.upsert({
    where: { tenantId_dataSource_externalId: { tenantId, dataSource: "ARBOR", externalId: mapping.pointExternalId } },
    create: { tenantId, cycleId: cycle.id, label: mapping.pointLabel, ordinal: mapping.pointOrdinal, pointType: mapping.pointType, resultStatus: "VALIDATED", sourceType: "arbor", isFinalPoint: mapping.isFinalPoint, assessedAt: new Date(), externalId: mapping.pointExternalId, dataSource: "ARBOR" },
    update: { label: mapping.pointLabel, ordinal: mapping.pointOrdinal, pointType: mapping.pointType, isFinalPoint: mapping.isFinalPoint },
  });
  // One Arbor definition can carry marks from more than one term. The Anaxi
  // assessment identity therefore includes its mapped term point.
  const assessmentExternalId = `ARBOR:assessment:${definition.id}:${mapping.pointExternalId}`;
  return db.assessment.upsert({
    where: { tenantId_dataSource_externalId: { tenantId, dataSource: "ARBOR", externalId: assessmentExternalId } },
    create: { tenantId, pointId: point.id, subject: subjectFromLabel(definition.label), yearGroup: mapping.yearGroups.join(", "), title: definition.label, gradeFormat: mapping.gradeFormat, uploadStatus: "VALIDATED", createdByUserId, externalId: assessmentExternalId, dataSource: "ARBOR" },
    update: { pointId: point.id, subject: subjectFromLabel(definition.label), yearGroup: mapping.yearGroups.join(", "), title: definition.label, gradeFormat: mapping.gradeFormat, uploadStatus: "VALIDATED" },
  });
}

function subjectFromLabel(label: string): string {
  return label.replace(/^.*?\bP8\s*:\s*/i, "").replace(/^\s*A[- ]?Level\s*/i, "").replace(/^.*?%\s*(?:KS\s*3|Y\s*10|Year\s*10)\s*/i, "").replace(/\s+(Autumn|Spring)\s+Term\s*\d+.*$/i, "").trim() || label;
}

function markValue(mark: { displayName: string | null; grade: { displayName: string | null; shortName: string | null; code: string | null } | null }): string | null {
  return [mark.grade?.displayName, mark.grade?.shortName, mark.grade?.code, mark.displayName].map((value) => value?.trim()).find((value): value is string => Boolean(value)) ?? null;
}

/** Imports one paced page from an explicitly approved Arbor assessment definition. */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({ where: { provider: "ARBOR" }, include: { schools: { where: { enabled: true }, include: { tenant: { include: { tenantSettings: true } } } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.json({ skipped: "not connected" });

  const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
  // Assessment outcomes are high-impact data. Discovery may continue, but no
  // results are written until a super admin has reviewed and approved the mapping.
  if (config.assessmentImportApproved !== true) return NextResponse.json({ skipped: "awaiting assessment mapping approval" });
  const state = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as AssessmentSyncState : {};
  const queuedDefinitions = Array.isArray(state.definitions) ? state.definitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string") : [];
  // Replace the earlier broad discovery queue with the agreed Secondary-only policy.
  const definitions = state.policyVersion === ASSESSMENT_POLICY_VERSION ? queuedDefinitions : queuedDefinitions.filter((definition) => mapArborAssessment(definition.label));
  if (!definitions.length) return NextResponse.json({ skipped: "assessment catalogue has not been prepared" });

  const cursor = state.policyVersion === ASSESSMENT_POLICY_VERSION && typeof state.cursor === "number" && state.cursor >= 0 ? state.cursor % definitions.length : 0;
  const markPage = state.policyVersion === ASSESSMENT_POLICY_VERSION && typeof state.markPage === "number" && state.markPage >= 0 ? state.markPage : 0;
  const definition = definitions[cursor];
  const provisionalMapping = mapArborAssessment(definition.label);
  if (!provisionalMapping) {
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, assessmentSync: { ...state, policyVersion: ASSESSMENT_POLICY_VERSION, definitions, cursor: (cursor + 1) % definitions.length, markPage: 0 } } } });
    return NextResponse.json({ skipped: definition.label });
  }

  try {
    const secondaryTenantIds = integration.schools.filter((school: { tenant: { tenantSettings: { schoolType: string } | null } }) => school.tenant.tenantSettings?.schoolType === "SECONDARY").map((school: { tenantId: string }) => school.tenantId);
    const [students, owners, marks] = await Promise.all([
      db.student.findMany({ where: { tenantId: { in: secondaryTenantIds }, status: "ACTIVE", externalId: { not: null } }, select: { id: true, tenantId: true, externalId: true, yearGroup: true } }),
      db.user.findMany({ where: { tenantId: { in: secondaryTenantIds }, isActive: true }, select: { id: true, tenantId: true }, orderBy: { createdAt: "asc" } }),
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAssessmentMarks(100, markPage, [definition.id]),
    ]);
    const studentByExternalId = new Map<string, { id: string; tenantId: string; externalId: string; yearGroup: string | null }>(students.map((student: { id: string; tenantId: string; externalId: string; yearGroup: string | null }) => [student.externalId, student]));
    const ownerByTenantId = new Map<string, string>(); for (const owner of owners) if (!ownerByTenantId.has(owner.tenantId)) ownerByTenantId.set(owner.tenantId, owner.id);
    let imported = 0;
    for (const mark of marks) {
      const student = studentByExternalId.get(mark.student.id); const value = markValue(mark);
      const mapping = mapArborAssessment(arborAssessmentLabel(mark.assessment ?? { displayName: definition.label, assessmentName: definition.label, assessmentShortName: null }), mark.assessmentDate) ?? provisionalMapping;
      if (!student || !value || !mapping.yearGroups.includes(student.yearGroup ?? "") || !ownerByTenantId.has(student.tenantId)) continue;
      const assessment = await ensureAssessment(db, student.tenantId, ownerByTenantId.get(student.tenantId)!, definition, mapping);
      const normalizedScore = normalizeGrade(value, mapping.gradeFormat);
      await db.assessmentResult.upsert({
        where: { tenantId_assessmentId_studentId: { tenantId: student.tenantId, assessmentId: assessment.id, studentId: student.id } },
        create: { tenantId: student.tenantId, assessmentId: assessment.id, studentId: student.id, rawValue: value, normalizedScore, normalisedGrade: value, status: "PRESENT", isValid: normalizedScore !== null, dataSource: "ARBOR" },
        update: { rawValue: value, normalizedScore, normalisedGrade: value, status: "PRESENT", isValid: normalizedScore !== null, dataSource: "ARBOR" },
      });
      imported++;
    }
    const nextPage = marks.length === 100 ? markPage + 1 : 0;
    const nextCursor = marks.length === 100 ? cursor : (cursor + 1) % definitions.length;
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, assessmentSync: { ...state, policyVersion: ASSESSMENT_POLICY_VERSION, definitions, cursor: nextCursor, markPage: nextPage, inspected: (typeof state.inspected === "number" ? state.inspected : 0) + (marks.length === 100 ? 0 : 1), matchedMarks: (typeof state.matchedMarks === "number" ? state.matchedMarks : 0) + marks.length, importedMarks: (typeof state.importedMarks === "number" ? state.importedMarks : 0) + imported, lastInspected: { label: definition.label, marks: marks.length, imported, at: new Date().toISOString() } } } } });
    return NextResponse.json({ inspected: definition.label, page: markPage, marks: marks.length, imported });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Assessment import failed.";
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { lastSyncStatus: "PARTIAL", lastSyncError: message } });
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
