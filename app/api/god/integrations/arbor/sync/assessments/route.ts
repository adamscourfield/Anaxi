import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { arborAssessmentFamily, arborAssessmentLabel, arborHistoricYearGroup, arborYearGroupAtAssessment, mapArborAssessment, mapArborAssessmentForYearGroup, type ArborAssessmentMapping } from "@/lib/integrations/arbor/assessmentPolicy";
import { ArborClient, arborAssessmentMarkValue } from "@/lib/integrations/arbor/client";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { normalizeGrade } from "@/modules/assessments/gradeNormalizer";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null; periodHint?: string | null; yearGroups?: string[] };
type HistoricFamilyProgress = { chunk?: number; markPage?: number; complete?: boolean };
type AssessmentSyncState = { definitions?: PreparedDefinition[]; historicalDefinitions?: PreparedDefinition[]; historicYearCursor?: number; historicFamilyCursor?: number; historicFamilyProgress?: Record<string, HistoricFamilyProgress>; historicComplete?: boolean; historicDiscoveryVersion?: number; cursor?: number; markPage?: number; inspected?: number; matchedMarks?: number; importedMarks?: number; policyVersion?: number };
const ASSESSMENT_POLICY_VERSION = 3;
const HISTORIC_DISCOVERY_VERSION = 14;
const MARK_PAGES_PER_RUN = 24;
// A small combined group is paged to completion before moving on, so every
// subject in the group is retained without serially scanning the full P8 list.
const DEFINITIONS_PER_QUERY = 10;
const HISTORIC_FAMILY_ORDER = ["GCSE", "A_LEVEL", "Y10_PERCENTAGE", "KS3_PERCENTAGE"] as const;
const HISTORIC_ACADEMIC_YEARS = [
  { label: "2025/2026", from: "2025-09-01", before: "2026-09-01" },
  { label: "2024/2025", from: "2024-09-01", before: "2025-09-01" },
  { label: "2026/2027", from: "2026-09-01", before: "2027-09-01" },
] as const;

function pauseForArbor(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 500));
}

function definitionsForFamily(definitions: PreparedDefinition[], family: (typeof HISTORIC_FAMILY_ORDER)[number]): PreparedDefinition[] {
  return definitions
    .filter((definition) => arborAssessmentFamily(definition.label) === family)
    .sort((a, b) => a.label.localeCompare(b.label));
}

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

function markValue(mark: Parameters<typeof arborAssessmentMarkValue>[0]): string | null { return arborAssessmentMarkValue(mark); }

function addHistoricDefinition(target: Map<string, PreparedDefinition>, definition: PreparedDefinition, mapping: ArborAssessmentMapping, student: { id: string; displayAcademicLevel: { displayName: string } | null; leavingDate: string | null }, archivedYearGroup?: string | null) {
  const inferredYearGroup = arborHistoricYearGroup(student.displayAcademicLevel?.displayName, archivedYearGroup, student.leavingDate, mapping.academicYear, mapping.family);
  const cycle = inferredYearGroup ? mapArborAssessmentForYearGroup(mapping, inferredYearGroup) : null;
  if (!cycle || !inferredYearGroup) return;
  const key = `${definition.id}:${cycle.cycleExternalId}`;
  const existing = target.get(key);
  target.set(key, {
    ...definition,
    yearGroups: [...new Set([...(existing?.yearGroups ?? []), inferredYearGroup])],
  });
}

/** Imports one paced page from an explicitly approved Arbor assessment definition. */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req), include: { schools: { where: { enabled: true }, include: { tenant: { include: { tenantSettings: true } } } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.json({ skipped: "not connected" });

  const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
  const savedState = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as AssessmentSyncState : {};
  // A completed zero-result legacy scan should not permanently block the
  // deterministic definition-by-definition discovery introduced afterwards.
  const hasHistoricDefinitions = Array.isArray(savedState.historicalDefinitions) && savedState.historicalDefinitions.length > 0;
  const state: AssessmentSyncState = (savedState.historicComplete && !hasHistoricDefinitions) || savedState.historicDiscoveryVersion !== HISTORIC_DISCOVERY_VERSION
    ? { ...savedState, historicYearCursor: 0, historicFamilyCursor: 0, historicFamilyProgress: {}, historicComplete: false }
    : savedState;
  // Assessment outcomes are high-impact data. Discovery may continue, but no
  // results are written until a super admin has reviewed and approved each
  // proposed Anaxi cycle individually.
  const approvedCycleKeys = new Set(
    Array.isArray(config.assessmentApprovedCycleKeys)
      ? config.assessmentApprovedCycleKeys.filter((value): value is string => typeof value === "string")
      : [],
  );
  if (!approvedCycleKeys.size) {
    // While imports are paused, use the scheduled calls to discover dated
    // historic cycles in small pages. This makes prior years reviewable before
    // anyone approves the first live import.
    if (state.historicComplete) return NextResponse.json({ skipped: "awaiting assessment cycle approval" });
    try {
      const definitions = Array.isArray(state.definitions)
        ? state.definitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string" && Boolean(arborAssessmentFamily(item.label)))
        : [];
      let historicYearCursor = typeof state.historicYearCursor === "number" && state.historicYearCursor >= 0 ? state.historicYearCursor : 0;
      let historicFamilyCursor = typeof state.historicFamilyCursor === "number" && state.historicFamilyCursor >= 0 ? state.historicFamilyCursor : 0;
      let historicFamilyProgress: Record<string, HistoricFamilyProgress> = state.historicFamilyProgress && typeof state.historicFamilyProgress === "object"
        ? { ...state.historicFamilyProgress }
        : {};
      const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
      const archivedStudents = await db.student.findMany({
        where: { tenantId: { in: integration.schools.map((school: { tenantId: string }) => school.tenantId) }, externalId: { not: null }, status: "ARCHIVED" },
        select: { externalId: true, yearGroup: true },
      });
      const archivedYearGroupByExternalId = new Map<string, string | null>(archivedStudents.map((student: { externalId: string | null; yearGroup: string | null }) => [student.externalId!, student.yearGroup]));
      const known = Array.isArray(state.historicalDefinitions) ? state.historicalDefinitions : [];
      const historicalDefinitions = new Map<string, PreparedDefinition>();
      for (const item of known) {
        const mapping = mapArborAssessment(item.label, item.assessmentDate, item.periodHint);
        if (!mapping) continue;
        for (const yearGroup of item.yearGroups ?? []) {
          const cycle = mapArborAssessmentForYearGroup(mapping, yearGroup);
          if (cycle) historicalDefinitions.set(`${item.id}:${cycle.cycleExternalId}`, item);
        }
      }
      for (let inspected = 0; inspected < MARK_PAGES_PER_RUN && historicYearCursor < HISTORIC_ACADEMIC_YEARS.length; inspected++) {
        if (HISTORIC_FAMILY_ORDER.every((family) => historicFamilyProgress[family]?.complete)) {
          historicYearCursor++;
          historicFamilyCursor = 0;
          historicFamilyProgress = {};
          continue;
        }
        const academicYear = HISTORIC_ACADEMIC_YEARS[historicYearCursor];
        const family = HISTORIC_FAMILY_ORDER[historicFamilyCursor % HISTORIC_FAMILY_ORDER.length];
        historicFamilyCursor = (historicFamilyCursor + 1) % HISTORIC_FAMILY_ORDER.length;
        const progress = historicFamilyProgress[family] ?? {};
        if (progress.complete) continue;
        const familyDefinitions = definitionsForFamily(definitions, family);
        const chunks = Array.from({ length: Math.ceil(familyDefinitions.length / DEFINITIONS_PER_QUERY) }, (_, index) => familyDefinitions.slice(index * DEFINITIONS_PER_QUERY, (index + 1) * DEFINITIONS_PER_QUERY));
        const chunk = progress.chunk ?? 0;
        const markPage = progress.markPage ?? 0;
        if (!chunks[chunk]?.length) {
          historicFamilyProgress[family] = { ...progress, complete: true };
          continue;
        }
        if (inspected > 0) await pauseForArbor();
        const marks = await client.listAssessmentMarks(500, markPage, chunks[chunk].map((definition) => definition.id), academicYear);
        for (const mark of marks) {
          if (!mark.assessment) continue;
          const label = arborAssessmentLabel(mark.assessment);
          const mapping = mapArborAssessment(label, mark.assessmentDate, mark.displayName);
          if (mapping) addHistoricDefinition(historicalDefinitions, { id: mark.assessment.id, label, assessmentDate: mark.assessmentDate, periodHint: mark.displayName }, mapping, mark.student, archivedYearGroupByExternalId.get(mark.student.id));
        }
        if (marks.length < 500) {
          const nextChunk = chunk + 1;
          historicFamilyProgress[family] = nextChunk >= chunks.length
            ? { chunk: nextChunk, markPage: 0, complete: true }
            : { chunk: nextChunk, markPage: 0 };
        } else {
          historicFamilyProgress[family] = { chunk, markPage: markPage + 1 };
        }
      }
      if (historicYearCursor < HISTORIC_ACADEMIC_YEARS.length && HISTORIC_FAMILY_ORDER.every((family) => historicFamilyProgress[family]?.complete)) {
        historicYearCursor++;
        historicFamilyCursor = 0;
        historicFamilyProgress = {};
      }
      const historicComplete = historicYearCursor >= HISTORIC_ACADEMIC_YEARS.length;
      await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, assessmentSync: { ...state, historicalDefinitions: [...historicalDefinitions.values()], historicYearCursor, historicFamilyCursor, historicFamilyProgress, historicComplete, historicDiscoveryVersion: HISTORIC_DISCOVERY_VERSION } } } });
      return NextResponse.json({ discovered: historicalDefinitions.size, year: historicYearCursor, family: historicFamilyCursor, complete: historicComplete });
    } catch (error) {
      return NextResponse.json({ skipped: "historic assessment discovery paused", error: error instanceof Error ? error.message.slice(0, 180) : "Arbor did not complete historic discovery." }, { status: 503 });
    }
  }
  const queuedDefinitions = Array.isArray(state.definitions) ? state.definitions.filter((item): item is PreparedDefinition => typeof item?.id === "string" && typeof item?.label === "string") : [];
  // Replace the earlier broad discovery queue with the agreed Secondary-only policy.
  const definitions = state.policyVersion === ASSESSMENT_POLICY_VERSION ? queuedDefinitions : queuedDefinitions.filter((definition) => arborAssessmentFamily(definition.label));
  if (!definitions.length) return NextResponse.json({ skipped: "assessment catalogue has not been prepared" });

  const cursor = state.policyVersion === ASSESSMENT_POLICY_VERSION && typeof state.cursor === "number" && state.cursor >= 0 ? state.cursor % definitions.length : 0;
  const markPage = state.policyVersion === ASSESSMENT_POLICY_VERSION && typeof state.markPage === "number" && state.markPage >= 0 ? state.markPage : 0;
  const definition = definitions[cursor];
  if (!arborAssessmentFamily(definition.label)) {
    await db.sharedIntegration.update({ where: { id: integration.id }, data: { config: { ...config, assessmentSync: { ...state, policyVersion: ASSESSMENT_POLICY_VERSION, definitions, cursor: (cursor + 1) % definitions.length, markPage: 0 } } } });
    return NextResponse.json({ skipped: definition.label });
  }

  try {
    const secondaryTenantIds = integration.schools.filter((school: { tenant: { tenantSettings: { schoolType: string } | null } }) => school.tenant.tenantSettings?.schoolType === "SECONDARY").map((school: { tenantId: string }) => school.tenantId);
    const [students, owners, marks] = await Promise.all([
      // Archived pupils remain eligible for historic attainment imports, but are
      // excluded from day-to-day school views by their Student status.
      db.student.findMany({ where: { tenantId: { in: secondaryTenantIds }, externalId: { not: null } }, select: { id: true, tenantId: true, externalId: true, yearGroup: true } }),
      db.user.findMany({ where: { tenantId: { in: secondaryTenantIds }, isActive: true }, select: { id: true, tenantId: true }, orderBy: { createdAt: "asc" } }),
      new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAssessmentMarks(100, markPage, [definition.id]),
    ]);
    const studentByExternalId = new Map<string, { id: string; tenantId: string; externalId: string; yearGroup: string | null }>(students.map((student: { id: string; tenantId: string; externalId: string; yearGroup: string | null }) => [student.externalId, student]));
    const ownerByTenantId = new Map<string, string>(); for (const owner of owners) if (!ownerByTenantId.has(owner.tenantId)) ownerByTenantId.set(owner.tenantId, owner.id);
    let imported = 0;
    for (const mark of marks) {
      const baseMapping = mapArborAssessment(arborAssessmentLabel(mark.assessment ?? { displayName: definition.label, assessmentName: definition.label, assessmentShortName: null }), mark.assessmentDate, mark.displayName);
      if (!baseMapping) continue;
      let student = studentByExternalId.get(mark.student.id);
      // A former pupil can have a legitimate historic result but no current Arbor
      // academic level. Keep a minimal archived record so their results remain
      // attributable without returning them to operational student lists.
      if (!student && !mark.student.displayAcademicLevel && secondaryTenantIds.length === 1) {
        const ownerId = ownerByTenantId.get(secondaryTenantIds[0]);
        const firstName = mark.student.preferredFirstName?.trim() || mark.student.legalFirstName?.trim();
        const lastName = mark.student.preferredLastName?.trim() || mark.student.legalLastName?.trim();
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        if (ownerId && fullName) {
          const historicYearGroup = baseMapping.family === "GCSE" ? "Y11" : arborYearGroupAtAssessment(null, baseMapping.academicYear);
          const archivedStudent = await db.student.upsert({
            where: { tenantId_dataSource_externalId: { tenantId: secondaryTenantIds[0], dataSource: "ARBOR", externalId: mark.student.id } },
            create: { tenantId: secondaryTenantIds[0], fullName, yearGroup: historicYearGroup, status: "ARCHIVED", externalId: mark.student.id, dataSource: "ARBOR" },
            update: {},
            select: { id: true, tenantId: true, externalId: true, yearGroup: true },
          });
          student = archivedStudent;
          studentByExternalId.set(mark.student.id, archivedStudent);
        }
      }
      const value = markValue(mark);
      const historicYearGroup = arborYearGroupAtAssessment(mark.student.displayAcademicLevel?.displayName, baseMapping.academicYear)
        ?? (baseMapping.family === "GCSE" ? "Y11" : student?.yearGroup ?? null);
      const mapping = mapArborAssessmentForYearGroup(baseMapping, historicYearGroup);
      if (!student || !value || !mapping || !approvedCycleKeys.has(mapping.cycleExternalId) || !ownerByTenantId.has(student.tenantId)) continue;
      const assessment = await ensureAssessment(db, student.tenantId, ownerByTenantId.get(student.tenantId)!, definition, mapping);
      const normalizedScore = normalizeGrade(value, mapping.gradeFormat);
      const key = { tenantId_assessmentId_studentId: { tenantId: student.tenantId, assessmentId: assessment.id, studentId: student.id } };
      const existingResult = await db.assessmentResult.findUnique({ where: key, select: { id: true, isManuallyOverridden: true } });
      const arborValues = { arborRawValue: value, arborNormalizedScore: normalizedScore, arborNormalisedGrade: value, arborSyncedAt: new Date() };
      if (existingResult?.isManuallyOverridden) {
        // Keep the latest MIS value for comparison, but never overwrite an
        // explicitly recorded Anaxi correction without a human decision.
        await db.assessmentResult.update({ where: { id: existingResult.id }, data: arborValues });
      } else {
        await db.assessmentResult.upsert({
          where: key,
          create: { tenantId: student.tenantId, assessmentId: assessment.id, studentId: student.id, rawValue: value, normalizedScore, normalisedGrade: value, status: "PRESENT", isValid: normalizedScore !== null, dataSource: "ARBOR", ...arborValues },
          update: { rawValue: value, normalizedScore, normalisedGrade: value, status: "PRESENT", isValid: normalizedScore !== null, dataSource: "ARBOR", ...arborValues },
        });
      }
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
