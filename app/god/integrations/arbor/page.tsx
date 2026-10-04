import Link from "next/link";
import { ReactNode } from "react";
import { requireSuperAdminUser } from "@/lib/admin";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { getCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { CsrfInput } from "@/components/CsrfInput";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { PageHeader } from "@/components/ui/page-header";
import { FormField } from "@/components/ui/form-field";
import { H3, MetaText } from "@/components/ui/typography";
import { mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";

type PreparedAssessmentDefinition = { id: string; label: string; assessmentDate?: string | null };
type ProposedAssessmentCycle = {
  key: string;
  label: string;
  academicYear: string;
  yearGroup: string;
  gradeFormat: string;
  definitions: string[];
};

function proposedAssessmentCycles(config: unknown): ProposedAssessmentCycle[] {
  const record = config && typeof config === "object" ? config as Record<string, unknown> : {};
  const sync = record.assessmentSync && typeof record.assessmentSync === "object" ? record.assessmentSync as Record<string, unknown> : {};
  const definitions = [sync.definitions, sync.historicalDefinitions].flatMap((items) => Array.isArray(items)
    ? items.filter((item): item is PreparedAssessmentDefinition => Boolean(item) && typeof (item as PreparedAssessmentDefinition).id === "string" && typeof (item as PreparedAssessmentDefinition).label === "string")
    : []);
  const cycles = new Map<string, ProposedAssessmentCycle>();
  for (const definition of definitions) {
    const mapping = mapArborAssessment(definition.label, definition.assessmentDate);
    if (!mapping) continue;
    for (const yearGroup of mapping.yearGroups) {
      const cycle = mapArborAssessmentForYearGroup(mapping, yearGroup);
      if (!cycle) continue;
      const existing = cycles.get(cycle.cycleExternalId);
      if (existing) {
        if (!existing.definitions.includes(definition.label)) existing.definitions.push(definition.label);
      } else {
        cycles.set(cycle.cycleExternalId, {
          key: cycle.cycleExternalId,
          label: cycle.cycleLabel,
          academicYear: cycle.academicYear,
          yearGroup,
          gradeFormat: cycle.gradeFormat === "PERCENTAGE" ? "Percentage" : cycle.gradeFormat === "A_LEVEL" ? "A-Level grades" : "GCSE grades",
          definitions: [definition.label],
        });
      }
    }
  }
  return [...cycles.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// ─── Status banner ────────────────────────────────────────────────────────────
// Every Arbor action (connect, preview, sync...) redirects back here with query
// params describing its outcome. One shared banner keeps all of those consistent
// instead of each repeating its own ad-hoc card markup.

type BannerVariant = "success" | "danger";

const BANNER_STYLES: Record<BannerVariant, { border: string; bg: string; text: string }> = {
  success: { border: "border-success/30", bg: "bg-[var(--pill-success-bg)]", text: "text-success" },
  danger: { border: "border-danger/30", bg: "bg-[var(--pill-danger-bg)]", text: "text-danger" },
};

function StatusBanner({
  variant,
  title,
  extra,
  children,
}: {
  variant: BannerVariant;
  title: string;
  /** A second line of detail, shown below the main message (e.g. a list of warnings). */
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const styles = BANNER_STYLES[variant];
  return (
    <Card className={`${styles.border} ${styles.bg}`}>
      <H3 className={styles.text}>{title}</H3>
      {children ? <MetaText className="mt-1">{children}</MetaText> : null}
      {extra ? <MetaText className="mt-1">{extra}</MetaText> : null}
    </Card>
  );
}

export default async function ArborIntegrationPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string; test?: string; photo?: string; photoSync?: string; studentPhotos?: string; staffPhotos?: string; unavailable?: string; failed?: string; attendance?: string; attendancePreview?: string; attendanceRecords?: string; attendanceStudents?: string; attendancePct?: string; attendanceLate?: string; attendanceUnmatched?: string; attendanceSync?: string; attendanceFrom?: string; attendanceTo?: string; attendanceCreated?: string; attendanceUpdated?: string; attendancePreserved?: string; behaviour?: string; behaviourPointAwards?: string; behaviourDetentions?: string; behaviourInternalExclusions?: string; behaviourSuspensions?: string; behaviourPreview?: string; behaviourStudents?: string; behaviourPoints?: string; behaviourUnmatched?: string; behaviourCapped?: string; assessment?: string; assessmentRecords?: string; assessmentPreview?: string; assessmentMarks?: string; assessmentLinked?: string; assessmentDefinitions?: string; assessmentPriorityDefinitions?: string; assessmentDefinition?: string; assessmentDefinitionFields?: string; assessmentValues?: string; assessmentValueFormat?: string; assessmentValueExamples?: string; assessmentGrades?: string; assessmentGradeFields?: string; assessmentCatalogue?: string; assessmentCatalogueTotal?: string; assessmentCataloguePriority?: string; assessmentCatalogueLabels?: string; assessmentActive?: string; assessmentActiveMarks?: string; assessmentActiveDefinitions?: string; assessmentActiveLabels?: string; assessmentActiveError?: string; assessmentApproval?: string; assessmentApproved?: string; assessmentHistory?: string; assessmentHistoryCycles?: string; assessmentHistoryError?: string; assessmentFilters?: string; assessmentFilterNames?: string; timetable?: string; timetableFields?: string; timetablePreview?: string; timetableAssignments?: string; timetableLinkable?: string; timetableError?: string; leaveAccess?: string; leaveWriteOperations?: string; staffProvisioning?: string; staffProvisioningQueued?: string; preview?: string; total?: string; primary?: string; secondary?: string; offRoll?: string; review?: string; unrecognised?: string | string[]; comparison?: string; alreadyLinked?: string; possibleMatch?: string; ambiguousMatch?: string; newStudent?: string; skippedOffRoll?: string; needsReview?: string; sync?: string; created?: string; adopted?: string; archived?: string; staff?: string; activeInArbor?: string; linkedPrimaryOnly?: string; linkedSecondaryOnly?: string; linkedBoth?: string; possiblePrimaryOnly?: string; possibleSecondaryOnly?: string; possibleBoth?: string; unmatched?: string; ambiguous?: string; staffSync?: string; linked?: string }> }) {
  await requireSuperAdminUser();
  const [csrfToken, schools, integration, latestBehaviourRun, staffProvisioningRequests, params] = await Promise.all([
    getCsrfToken(),
    prisma.tenant.findMany({
      where: { id: { not: PLATFORM_TENANT_ID }, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true, tenantSettings: { select: { schoolType: true } } },
    }),
    (prisma as any).sharedIntegration.findUnique({
      where: { provider: "ARBOR" },
      include: { schools: { where: { enabled: true }, select: { tenantId: true } } },
    }),
    (prisma as any).sharedIntegrationSyncRun.findFirst({
      where: { integration: { provider: "ARBOR" }, entityType: "BEHAVIOUR" },
      orderBy: { startedAt: "desc" },
      select: { status: true, recordsCreated: true, recordsUpdated: true, startedAt: true, finishedAt: true, errorSummary: true },
    }),
    (prisma as any).staffProvisioningRequest.findMany({ where: { integration: { provider: "ARBOR" }, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 50 }),
    searchParams,
  ]);

  const selected = new Set<string>(integration?.schools.map((school: { tenantId: string }) => school.tenantId) ?? []);
  const hostname = typeof integration?.config?.schoolHostname === "string" ? integration.config.schoolHostname : "";
  const assessmentCycles = proposedAssessmentCycles(integration?.config);
  const assessmentCyclesByYear = new Map<string, ProposedAssessmentCycle[]>();
  for (const cycle of assessmentCycles) {
    const current = assessmentCyclesByYear.get(cycle.academicYear) ?? [];
    current.push(cycle);
    assessmentCyclesByYear.set(cycle.academicYear, current);
  }
  const assessmentYears = [...assessmentCyclesByYear.keys()].sort((a, b) => b.localeCompare(a));
  const assessmentSync = integration?.config?.assessmentSync && typeof integration.config.assessmentSync === "object"
    ? integration.config.assessmentSync as { historicPage?: number; historicComplete?: boolean; historicalDefinitions?: PreparedAssessmentDefinition[] }
    : {};
  const approvedAssessmentCycles = new Set<string>(
    Array.isArray(integration?.config?.assessmentApprovedCycleKeys)
      ? integration.config.assessmentApprovedCycleKeys.filter((key: unknown): key is string => typeof key === "string")
      : [],
  );
  const secondaryTenantIds = schools
    .filter((school) => school.tenantSettings?.schoolType === "SECONDARY")
    .map((school) => school.id);
  const activeStudentsByYearGroup = secondaryTenantIds.length
    ? await prisma.student.groupBy({
      by: ["yearGroup"],
      where: { tenantId: { in: secondaryTenantIds }, status: "ACTIVE" },
      _count: { _all: true },
    })
    : [];
  const studentCountByYearGroup = new Map(activeStudentsByYearGroup.map((row) => [row.yearGroup, row._count._all]));
  const previewCount = (value: string | undefined) => (/^\d+$/.test(value ?? "") ? Number(value) : 0);
  const actionButtonClass = "w-full sm:w-64";
  const unrecognisedLevels = Array.isArray(params?.unrecognised)
    ? params.unrecognised
    : params?.unrecognised
      ? [params.unrecognised]
      : [];
  const behaviourNeedsAttention = latestBehaviourRun?.status === "FAILED" || latestBehaviourRun?.status === "PARTIAL";
  const assessmentNeedsReview = assessmentCycles.some((cycle) => !approvedAssessmentCycles.has(cycle.key));
  const assessmentNeedsAttention = assessmentNeedsReview || params?.assessmentHistory === "failed";
  const savedAttention = integration?.config?.attention && typeof integration.config.attention === "object"
    ? integration.config.attention as Record<string, unknown>
    : {};
  const savedLeaveAccess = integration?.config?.leaveAbsenceAccess && typeof integration.config.leaveAbsenceAccess === "object"
    ? integration.config.leaveAbsenceAccess as { status?: unknown }
    : null;
  const leaveNeedsAttention = params?.leaveAccess === "failed"
    || params?.leaveAccess === "not-connected"
    || savedLeaveAccess?.status === "NEEDS_ATTENTION"
    || Boolean(savedAttention.leave);
  const connectionNeedsAttention = params?.error === "secure-storage" || params?.test === "failed" || params?.test === "not-configured" || Boolean(savedAttention.connection);
  const photoNeedsAttention = params?.photo === "unavailable" || params?.photo === "not-connected" || params?.photo === "no-student" || Boolean(savedAttention.photos);
  const timetableNeedsAttention = params?.timetable === "failed" || params?.timetablePreview === "failed" || Boolean(params?.timetableError) || Boolean(savedAttention.timetable);
  const peopleNeedsAttention = params?.staff === "failed" || params?.staffSync === "failed" || params?.sync === "failed" || Boolean(savedAttention.people);
  const attendanceNeedsAttention = params?.attendance === "failed" || params?.attendancePreview === "failed" || params?.attendanceSync === "failed" || Boolean(savedAttention.attendance);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        variant="ledger"
        eyebrow="God Mode"
        title="Arbor connection"
        subtitle="Connect one Arbor system and choose every Anaxi school that should receive its data."
        actions={<Link href="/god"><Button variant="secondary" className="w-full sm:w-64">Back to schools</Button></Link>}
      />

      {params?.saved === "1" ? (
        <StatusBanner variant="success" title="Arbor connection saved.">
          Its login details are encrypted. The connection will remain inactive until the first sync is built and verified.
        </StatusBanner>
      ) : null}

      {params?.error === "secure-storage" ? (
        <StatusBanner variant="danger" title="Arbor details were not saved.">
          Secure credential storage has not been configured for this Anaxi environment. Add the integration encryption key in the hosting environment, then try again.
        </StatusBanner>
      ) : null}

      {params?.test === "success" ? (
        <StatusBanner variant="success" title="Arbor connection verified.">
          Anaxi can securely read Arbor. No school data has been imported yet.
        </StatusBanner>
      ) : null}

      {params?.test === "failed" || params?.test === "not-configured" ? (
        <StatusBanner variant="danger" title="Arbor connection needs attention.">
          {params?.test === "not-configured" ? "Save the Arbor application credentials before checking the connection." : integration?.lastSyncError ?? "Try saving the Arbor application credentials again."}
        </StatusBanner>
      ) : null}

      {params?.photo === "success" ? (
        <StatusBanner variant="success" title="Arbor photo access verified.">
          Anaxi can request a photo from Arbor. No image has been imported or stored yet.
        </StatusBanner>
      ) : null}

      {params?.photo === "unavailable" || params?.photo === "not-connected" || params?.photo === "no-student" ? (
        <StatusBanner variant="danger" title="Arbor photo access is not available yet.">
          No image was imported. Check that Arbor has enabled photo API access for the Anaxi app.
        </StatusBanner>
      ) : null}

      {params?.photoSync === "success" ? (
        <StatusBanner variant="success" title="Arbor photo sync batch complete.">
          {previewCount(params.studentPhotos)} student and {previewCount(params.staffPhotos)} staff photos were copied; {previewCount(params.unavailable)} people had no available Arbor photo, and {previewCount(params.failed)} could not be downloaded. The nightly sync continues in small batches.
        </StatusBanner>
      ) : null}

      {params?.attendance === "success" ? (
        <StatusBanner variant="success" title="Arbor attendance access verified.">
          Anaxi read {previewCount(params.attendanceRecords)} attendance record without importing anything. The next step is a read-only attendance summary preview.
        </StatusBanner>
      ) : null}

      {params?.attendance === "failed" || params?.attendance === "not-connected" ? (
        <StatusBanner variant="danger" title="Arbor attendance access needs attention.">
          No attendance data was imported.
        </StatusBanner>
      ) : null}

      {params?.attendancePreview === "success" ? (
        <StatusBanner variant="success" title="Attendance summary preview complete.">
          From the latest seven days, {previewCount(params.attendanceRecords)} records covered {previewCount(params.attendanceStudents)} linked students: {params?.attendancePct ?? "0"}% attendance and {previewCount(params.attendanceLate)} late marks. {previewCount(params.attendanceUnmatched)} records could not be linked. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.attendancePreview === "failed" || params?.attendancePreview === "not-connected" ? (
        <StatusBanner variant="danger" title="Attendance summary preview could not run.">
          No attendance data was imported. Anaxi will use the confirmed Arbor response details to adjust the read-only query safely.
        </StatusBanner>
      ) : null}

      {params?.attendanceSync === "success" ? (
        <StatusBanner variant="success" title="Attendance sync batch complete.">
          Anaxi updated its academic-year attendance totals for {params.attendanceFrom} to {params.attendanceTo}: {previewCount(params.attendanceCreated)} new daily snapshots and {previewCount(params.attendanceUpdated)} refreshed snapshots. {previewCount(params.attendancePreserved)} manual snapshots were left unchanged. The nightly sync will continue until it is caught up, then update the latest completed day.
        </StatusBanner>
      ) : null}

      {params?.attendanceSync === "up-to-date" ? (
        <StatusBanner variant="success" title="Attendance is up to date.">
          Anaxi already holds the latest completed academic-year attendance day from Arbor.
        </StatusBanner>
      ) : null}

      {params?.attendanceSync === "failed" || params?.attendanceSync === "not-connected" || params?.attendanceSync === "confirmation-required" ? (
        <StatusBanner variant="danger" title="Attendance sync did not run.">
          {params.attendanceSync === "confirmation-required" ? "Confirm the attendance sync before Anaxi changes its attendance measures." : params.attendanceSync === "not-connected" ? "Check the Arbor connection before starting attendance sync." : "No further attendance changes were made after the issue was detected. Check the God Mode audit log."}
        </StatusBanner>
      ) : null}

      {params?.behaviour === "success" ? (
        <StatusBanner variant="success" title="Arbor behaviour access verified.">
          Anaxi read one record from each behaviour source without importing anything: {previewCount(params.behaviourPointAwards)} positive-point awards, {previewCount(params.behaviourDetentions)} detentions, {previewCount(params.behaviourInternalExclusions)} internal exclusions, and {previewCount(params.behaviourSuspensions)} suspensions were available in the test.
        </StatusBanner>
      ) : null}

      {params?.behaviour === "failed" || params?.behaviour === "not-connected" ? (
        <StatusBanner variant="danger" title="Arbor behaviour access needs attention.">
          No behaviour data was imported. Anaxi will adjust the read-only check from Arbor&rsquo;s confirmed response before enabling a sync.
        </StatusBanner>
      ) : null}

      {params?.behaviourPreview === "success" ? (
        <StatusBanner variant="success" title="Behaviour summary preview complete.">
          From the latest seven days, {previewCount(params.behaviourStudents)} linked students had {previewCount(params.behaviourPoints)} positive points, {previewCount(params.behaviourDetentions)} detentions, {previewCount(params.behaviourInternalExclusions)} internal exclusions, and {previewCount(params.behaviourSuspensions)} suspensions. {previewCount(params.behaviourUnmatched)} records could not be linked. {params.behaviourCapped === "1" ? "This is the first 100 records from one or more sources, so it is a safe sample rather than a full period total." : "Nothing has been imported."}
        </StatusBanner>
      ) : null}

      {params?.behaviourPreview === "failed" || params?.behaviourPreview === "not-connected" || params?.behaviourPreview === "range-mismatch" ? (
        <StatusBanner variant="danger" title="Behaviour summary preview could not run.">
          {params.behaviourPreview === "range-mismatch" ? "Arbor returned behaviour records outside the requested seven-day period. No data was imported; Anaxi will not enable the sync until the date filter is corrected." : "No behaviour data was imported. Anaxi will use the confirmed Arbor response details to adjust the read-only query safely."}
        </StatusBanner>
      ) : null}

      {params?.assessment === "success" ? (
        <StatusBanner variant="success" title="Arbor priority-assessment access verified.">
          Anaxi read {previewCount(params.assessmentRecords)} progress assessment mark without importing anything. The next step is a read-only mapping preview.
        </StatusBanner>
      ) : null}

      {params?.assessment === "failed" || params?.assessment === "not-connected" ? (
        <StatusBanner variant="danger" title="Arbor assessment access needs attention.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentPreview === "success" ? (
        <StatusBanner variant="success" title="Assessment mapping preview complete.">
          {previewCount(params.assessmentMarks)} Arbor marks were sampled: {previewCount(params.assessmentLinked)} link to Anaxi students across {previewCount(params.assessmentDefinitions)} assessment definitions, including {previewCount(params.assessmentPriorityDefinitions)} matching P8, A-Level, KS1, or KS2. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentPreview === "failed" || params?.assessmentPreview === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment mapping preview could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentDefinition === "success" ? (
        <StatusBanner variant="success" title="Assessment definition checked.">
          Arbor confirms these mapping details are available: {params.assessmentDefinitionFields || "none of the required fields"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentDefinition === "failed" || params?.assessmentDefinition === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment definition check could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentValues === "success" ? (
        <StatusBanner variant="success" title="Assessment values previewed.">
          The sample looks like {params.assessmentValueFormat ?? "needs review"}. Example values: {params.assessmentValueExamples || "none"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentValues === "failed" || params?.assessmentValues === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment values preview could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentGrades === "success" ? (
        <StatusBanner variant="success" title="Assessment grade fields checked.">
          Arbor confirms these grade label fields are available: {params.assessmentGradeFields || "none"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentGrades === "failed" || params?.assessmentGrades === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment grade check could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentCatalogue === "success" ? (
        <StatusBanner variant="success" title="Priority assessment catalogue preview complete.">
          Arbor has {previewCount(params.assessmentCatalogueTotal)} assessment definitions, with {previewCount(params.assessmentCataloguePriority)} matching P8, A-Level, KS1, or KS2. {params.assessmentCatalogueLabels ? `Matches: ${params.assessmentCatalogueLabels}.` : ""} Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentCatalogue === "failed" || params?.assessmentCatalogue === "not-connected" ? (
        <StatusBanner variant="danger" title="Priority assessment catalogue preview could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentActive === "prepared" ? (
        <StatusBanner variant="success" title="Assessment sync prepared.">
          {previewCount(params.assessmentActiveDefinitions)} agreed assessment definitions are ready for review. No results will import until individual cycles have been approved below.
        </StatusBanner>
      ) : null}

      {params?.assessmentApproval === "success" ? (
        <StatusBanner variant="success" title="Assessment cycles approved.">
          {previewCount(params.assessmentApproved)} cycle(s) can now import linked Arbor results gradually overnight. All unselected cycles remain paused.
        </StatusBanner>
      ) : null}

      {params?.assessmentApproval === "paused" ? (
        <StatusBanner variant="success" title="Assessment imports paused.">
          No new Arbor assessment results will be imported until cycles are approved again.
        </StatusBanner>
      ) : null}

      {params?.assessmentActive === "failed" || params?.assessmentActive === "not-connected" ? (
        <StatusBanner variant="danger" title="Active priority assessment preview could not run.">
          {params.assessmentActiveError || "No assessment data was imported."}
        </StatusBanner>
      ) : null}

      {params?.assessmentFilters === "success" ? (
        <StatusBanner variant="success" title="Assessment filters checked.">
          Arbor supports these progress-mark filters: {params.assessmentFilterNames || "none"}. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.assessmentFilters === "failed" || params?.assessmentFilters === "not-connected" ? (
        <StatusBanner variant="danger" title="Assessment filter check could not run.">
          No assessment data was imported.
        </StatusBanner>
      ) : null}

      {params?.timetable === "success" ? (
        <StatusBanner variant="success" title="Arbor timetable mapping is available.">
          Anaxi has confirmed the timetable relationships it needs. The next step is to map these safely to each student&apos;s existing subject-teacher links.
        </StatusBanner>
      ) : null}

      {params?.timetable === "failed" || params?.timetable === "not-connected" ? (
        <StatusBanner variant="danger" title="Arbor timetable mapping needs attention.">
          No student-teacher links were changed.
        </StatusBanner>
      ) : null}

      {params?.timetablePreview === "success" ? (
        <StatusBanner variant="success" title="Subject-teacher preview complete.">
          Arbor returned {previewCount(params.timetableAssignments)} timetable assignments, of which {previewCount(params.timetableLinkable)} can be linked to existing Anaxi students and staff. Nothing has been changed.
        </StatusBanner>
      ) : null}

      {params?.timetablePreview === "failed" || params?.timetablePreview === "not-connected" ? (
        <StatusBanner variant="danger" title="Subject-teacher preview could not run.">
          {params.timetableError || "No student-teacher links were changed."}
        </StatusBanner>
      ) : null}

      {params?.preview === "success" ? (
        <StatusBanner
          variant="success"
          title="Student preview complete."
          extra={unrecognisedLevels.length > 0 ? <>Unrecognised levels: {unrecognisedLevels.join("; ")}.</> : null}
        >
          {previewCount(params.total)} students found: {previewCount(params.primary)} for Primary, {previewCount(params.secondary)} for Secondary, {previewCount(params.offRoll)} off-roll records skipped, and {previewCount(params.review)} needing review. Nothing has been imported.
        </StatusBanner>
      ) : null}

      {params?.preview === "failed" || params?.preview === "not-connected" ? (
        <StatusBanner variant="danger" title="Student preview could not run.">
          {params?.preview === "not-connected" ? "Check the Arbor connection before previewing students." : "Anaxi could not read the student fields needed for the preview. No data was imported."}
        </StatusBanner>
      ) : null}

      {params?.comparison === "success" ? (
        <StatusBanner variant="success" title="Student comparison complete.">
          {previewCount(params.alreadyLinked)} already linked to Arbor, {previewCount(params.possibleMatch)} possible existing Anaxi matches, {previewCount(params.ambiguousMatch)} ambiguous matches, and {previewCount(params.newStudent)} potentially new students. Nothing has been changed.
        </StatusBanner>
      ) : null}

      {params?.comparison === "failed" || params?.comparison === "not-connected" ? (
        <StatusBanner variant="danger" title="Student comparison could not run.">
          {params?.comparison === "not-connected" ? "Check the Arbor connection before comparing students." : "Anaxi could not compare Arbor students with the existing Anaxi records. No data was changed."}
        </StatusBanner>
      ) : null}

      {params?.sync === "success" ? (
        <StatusBanner variant="success" title="Student sync complete.">
          {previewCount(params.created)} new students were added and {previewCount(params.adopted)} existing Anaxi students were linked to Arbor. Future syncs can update these records safely.
        </StatusBanner>
      ) : null}

      {params?.sync === "failed" || params?.sync === "not-connected" || params?.sync === "confirmation-required" || params?.sync === "migration-required" ? (
        <StatusBanner variant="danger" title="Student sync did not run.">
          {params?.sync === "confirmation-required" ? "Confirm that you want to apply the student sync before it can run." : params?.sync === "not-connected" ? "Check the Arbor connection before syncing students." : params?.sync === "migration-required" ? "Anaxi is updating its database for student-sync audit records. Wait for the latest deployment to finish, then try again." : "No further changes were made after the issue was detected. Check the God Mode audit log."}
        </StatusBanner>
      ) : null}

      {params?.staff === "success" ? (
        <StatusBanner variant="success" title="Staff comparison complete.">
          {previewCount(params.activeInArbor)} active Arbor staff: {previewCount(params.linkedPrimaryOnly)} already linked to Primary, {previewCount(params.linkedSecondaryOnly)} to Secondary, {previewCount(params.linkedBoth)} to both schools; {previewCount(params.possiblePrimaryOnly)} possible Primary-only matches, {previewCount(params.possibleSecondaryOnly)} possible Secondary-only matches, {previewCount(params.possibleBoth)} possible cross-school matches, {previewCount(params.unmatched)} unmatched, and {previewCount(params.ambiguous)} ambiguous. Nothing has been changed.
        </StatusBanner>
      ) : null}

      {params?.staff === "failed" || params?.staff === "not-connected" ? (
        <StatusBanner variant="danger" title="Staff comparison could not run.">
          No staff records were changed.
        </StatusBanner>
      ) : null}

      {params?.staffSync === "success" ? (
        <StatusBanner variant="success" title="Staff sync complete.">
          {previewCount(params.linked)} existing Anaxi staff accounts were linked to Arbor. Their roles and access were not changed. Future nightly syncs can keep their names up to date safely.
        </StatusBanner>
      ) : null}

      {params?.staffSync === "failed" || params?.staffSync === "not-connected" || params?.staffSync === "confirmation-required" ? (
        <StatusBanner variant="danger" title="Staff sync did not run.">
          {params?.staffSync === "confirmation-required" ? "Confirm that you want to apply the staff sync before it can run." : params?.staffSync === "not-connected" ? "Check the Arbor connection before syncing staff." : "No further changes were made after the issue was detected. Check the God Mode audit log."}
        </StatusBanner>
      ) : null}
      {params?.staffProvisioning === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">New Arbor staff checked.</div><MetaText className="mt-1">{previewCount(params.staffProvisioningQueued)} staff record(s) were added to the approval queue. No account has been created yet.</MetaText></Card> : null}
      {params?.staffProvisioning === "provisioned" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Staff account created.</div><MetaText className="mt-1">The selected school account(s) were created or linked, and an invitation was sent.</MetaText></Card> : null}
      {params?.staffProvisioning === "failed" || params?.staffProvisioning === "invalid" || params?.staffProvisioning === "not-found" || params?.staffProvisioning === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Staff provisioning needs attention.</div><MetaText className="mt-1">No new staff access was granted.</MetaText></Card> : null}

      {integration?.status === "CONNECTED" ? (
        <>
          <Card className="border-success/25">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-success">Connected and syncing nightly</div>
            <H3 className="mt-2 text-xl">Arbor is the source of truth for Goresbrook data.</H3>
            <MetaText className="mt-2 max-w-3xl">Students, staff, attendance, behaviour, and profile photos update automatically. Primary and Secondary remain separate inside Anaxi.</MetaText>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/70 pt-4 text-sm">
              <span><span className="text-muted">Schools:</span> <strong>2 connected</strong></span>
              <span><span className="text-muted">Assessment cycles:</span> <strong>{approvedAssessmentCycles.size ? `${approvedAssessmentCycles.size} approved` : "awaiting review"}</strong></span>
              <span><span className="text-muted">Connection:</span> <strong className="text-success">healthy</strong></span>
            </div>
          </Card>

          <div className="space-y-3">
            <CollapsibleCard title="1. Connection" defaultOpen={false} attention={connectionNeedsAttention} attentionKey="connection" csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>Shared Goresbrook connection</H3>
                  <MetaText className="mt-1">Goresbrook Primary and Goresbrook Secondary share one Arbor connection while remaining separate Anaxi schools. Records are always routed to their existing school rather than guessed.</MetaText>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form method="post" action="/api/god/integrations/arbor/test" className={actionButtonClass}>
                    <CsrfInput token={csrfToken} />
                    <SubmitButton variant="secondary" className="w-full">Check connection</SubmitButton>
                  </form>
                </div>
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="2. Photo access" defaultOpen={false} attention={photoNeedsAttention} attentionKey="photos" csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>Profile photos update automatically</H3>
                  <MetaText className="mt-1">Photos are copied from Arbor securely in small batches. Manually added Anaxi images remain untouched.</MetaText>
                </div>
                <form method="post" action="/api/god/integrations/arbor/test-photos" className={actionButtonClass}>
                  <CsrfInput token={csrfToken} />
                  <SubmitButton variant="secondary" className="w-full">Check photo access</SubmitButton>
                </form>
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="3. Timetable access" defaultOpen={false} attention={timetableNeedsAttention} attentionKey="timetable" csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>Subject teachers</H3>
                  <MetaText className="mt-1">This is waiting for Arbor to grant access to <code>AcademicUnitAutomaticEnrolment</code>. Once available, Anaxi can show each student&apos;s teachers by subject.</MetaText>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form method="post" action="/api/god/integrations/arbor/preview/timetable" className={actionButtonClass}>
                    <CsrfInput token={csrfToken} />
                    <SubmitButton variant="secondary" className="w-full">Check timetable access</SubmitButton>
                  </form>
                  <form method="post" action="/api/god/integrations/arbor/preview/timetable/summary" className={actionButtonClass}>
                    <CsrfInput token={csrfToken} />
                    <SubmitButton variant="ghost" className="w-full">Preview subject links</SubmitButton>
                  </form>
                </div>
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="4. Staff and student syncing" defaultOpen={false} attention={peopleNeedsAttention} attentionKey="people" csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>People records update nightly</H3>
                  <MetaText className="mt-1">New active students, off-roll changes, linked staff details, and cross-school staff links are kept current automatically.</MetaText>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form method="post" action="/api/god/integrations/arbor/preview/students" className={actionButtonClass}><CsrfInput token={csrfToken} /><SubmitButton variant="secondary" className="w-full">Check students</SubmitButton></form>
                  <form method="post" action="/api/god/integrations/arbor/preview/staff" className={actionButtonClass}><CsrfInput token={csrfToken} /><SubmitButton variant="secondary" className="w-full">Check staff</SubmitButton></form>
                </div>
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="5. Behaviour syncing" defaultOpen={false} attention={behaviourNeedsAttention || Boolean(savedAttention.behaviour)} attentionKey="behaviour" csrfToken={csrfToken}>
              <div className="space-y-3">
                <H3>Behaviour data updates nightly</H3>
                <MetaText className="mt-1">Positive points, detentions, internal exclusions, and suspensions are imported into Anaxi&apos;s existing behaviour measures. No manual behaviour upload is needed.</MetaText>
                {latestBehaviourRun?.status === "SUCCESS" ? <MetaText>Last sync: {previewCount(String(latestBehaviourRun.recordsCreated))} new and {previewCount(String(latestBehaviourRun.recordsUpdated))} refreshed daily snapshots. Nightly catch-up continues automatically.</MetaText> : null}
                {behaviourNeedsAttention ? <StatusBanner variant="danger" title="Latest behaviour sync needs attention.">{latestBehaviourRun?.errorSummary ?? "No further behaviour changes were made after the issue was detected."}</StatusBanner> : null}
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="6. Attendance syncing" defaultOpen={false} attention={attendanceNeedsAttention} attentionKey="attendance" csrfToken={csrfToken}>
              <div>
                <H3>Attendance updates nightly</H3>
                <MetaText className="mt-1">Academic-year attendance totals and daily snapshots refresh automatically. Anaxi then compares the selected 7, 14, 21, or 28-day period with the previous period.</MetaText>
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="7. Leave of absence syncing" defaultOpen={false} attention={leaveNeedsAttention} attentionKey="leave" csrfToken={csrfToken}>
              <div className="space-y-4">
                <div>
                  <H3>Check Arbor staff-absence access</H3>
                  <MetaText className="mt-1">Before Anaxi sends an approved leave request to Arbor, confirm that the Anaxi application can read the staff-absence area and whether Arbor advertises a relevant write operation. This check is read-only and never creates or changes an absence.</MetaText>
                </div>
                {params?.leaveAccess === "success" ? (
                  <StatusBanner variant="success" title="Arbor staff-absence read access verified.">
                    Anaxi can read the staff-absence area. Arbor reported {previewCount(params.leaveWriteOperations)} relevant write operation{previewCount(params.leaveWriteOperations) === 1 ? "" : "s"}; this is not permission to write yet. We will confirm the exact create/update contract before enabling an approved-leave sync.
                  </StatusBanner>
                ) : null}
                {leaveNeedsAttention ? (
                  <StatusBanner variant="danger" title="Arbor staff-absence access needs attention.">
                    {params?.leaveAccess === "not-connected" ? "Check the main Arbor connection first." : "Arbor did not allow the read-only staff-absence check. No leave data was changed."}
                  </StatusBanner>
                ) : null}
                <form method="post" action="/api/god/integrations/arbor/test-staff-absence" className={actionButtonClass}>
                  <CsrfInput token={csrfToken} />
                  <SubmitButton variant="secondary" className="w-full">Check leave access</SubmitButton>
                </form>
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="8. Assessment syncing" defaultOpen={false} attention={assessmentNeedsAttention || Boolean(savedAttention.assessments)} attentionKey="assessments" csrfToken={csrfToken}>
              <div className="space-y-5">
                <div>
                  <H3>Assessment review</H3>
                  <MetaText className="mt-1">This is the only data area that requires a decision before it appears in Anaxi.</MetaText>
                </div>
                {params?.assessmentHistory === "progress" || params?.assessmentHistory === "complete" ? (
                  <StatusBanner variant="success" title={params.assessmentHistory === "complete" ? "Historic assessment discovery complete." : "Historic assessment discovery updated."}>
                    {previewCount(params.assessmentHistoryCycles)} dated Arbor cycle(s) are now available for review. {params.assessmentHistory === "complete" ? "No results have been imported." : "The next safe batch will run overnight, or you can run another batch now."}
                  </StatusBanner>
                ) : null}
                {params?.assessmentHistory === "failed" ? (
                  <StatusBanner variant="danger" title="Historic assessment discovery could not run.">
                    {params.assessmentHistoryError || "No assessment data was imported."}
                  </StatusBanner>
                ) : null}
                <Card className="space-y-5" tone="inset">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Controlled import</div>
                    <H3 className="mt-2">Proposed assessment cycles</H3>
                    <MetaText className="mt-1">Review and approve only the cycles you want to bring in. Each uses the agreed year group, phase, and term naming convention.</MetaText>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form method="post" action="/api/god/integrations/arbor/preview/assessments/active" className={actionButtonClass}>
                      <CsrfInput token={csrfToken} />
                      <SubmitButton variant="secondary" className="w-full">Refresh catalogue</SubmitButton>
                    </form>
                    {!assessmentSync.historicComplete ? <form method="post" action="/api/god/integrations/arbor/preview/assessments/history" className={actionButtonClass}><CsrfInput token={csrfToken} /><SubmitButton variant="secondary" className="w-full">Find historic cycles</SubmitButton></form> : null}
                  </div>
                </div>

                <MetaText>{assessmentSync.historicComplete ? "Historic assessment discovery is complete. Every dated cycle found in Arbor is available below for review." : `Historic assessment discovery is in progress${typeof assessmentSync.historicPage === "number" ? ` (batch ${assessmentSync.historicPage + 1})` : ""}. It reads 100 dated marks at a time and runs automatically overnight; you can also run the next safe batch now.`}</MetaText>

                {assessmentCycles.length ? (
                  <form method="post" action="/api/god/integrations/arbor/assessments/approval" className="space-y-4">
                    <CsrfInput token={csrfToken} />
                    <div className="space-y-3">
                      {assessmentYears.map((academicYear) => {
                        const cycles = assessmentCyclesByYear.get(academicYear) ?? [];
                        const approved = cycles.filter((cycle) => approvedAssessmentCycles.has(cycle.key)).length;
                        return (
                          <details key={academicYear} className="overflow-hidden rounded-sm border border-border/70 bg-[var(--surface-container-lowest)]">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                              <span>{academicYear}</span>
                              <MetaText>{cycles.length} proposed {cycles.length === 1 ? "cycle" : "cycles"}{approved ? ` · ${approved} approved` : ""}</MetaText>
                            </summary>
                            <div className="divide-y divide-border/70 border-t border-border/70">
                              {cycles.map((cycle) => {
                                const students = studentCountByYearGroup.get(cycle.yearGroup) ?? 0;
                                return (
                                  <div key={cycle.key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                                    <label className="flex min-w-0 cursor-pointer items-start gap-3">
                                      <input type="checkbox" name="cycleKey" value={cycle.key} defaultChecked={approvedAssessmentCycles.has(cycle.key)} className="mt-1 accent-accent" />
                                      <span className="min-w-0">
                                        <span className="block font-medium">{cycle.label}</span>
                                        <MetaText className="mt-1">{cycle.gradeFormat} · {students} active {students === 1 ? "student" : "students"} · {cycle.definitions.length} Arbor {cycle.definitions.length === 1 ? "definition" : "definitions"}</MetaText>
                                        <MetaText className="mt-1 break-words">{cycle.definitions.slice(0, 3).join(" · ")}{cycle.definitions.length > 3 ? ` +${cycle.definitions.length - 3} more` : ""}</MetaText>
                                      </span>
                                    </label>
                                    <Link href={`/god/integrations/arbor/assessments/${encodeURIComponent(cycle.key)}`} className="shrink-0 text-sm font-semibold text-accent underline underline-offset-4">Open review</Link>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
                      <SubmitButton className={actionButtonClass}>Save approved cycles</SubmitButton>
                      <MetaText>{approvedAssessmentCycles.size ? `${approvedAssessmentCycles.size} cycle(s) are currently approved.` : "All assessment imports are currently paused."}</MetaText>
                    </div>
                  </form>
                ) : (
                  <div className="rounded-sm border border-dashed border-border bg-[var(--surface-container-low)] p-5">
                    <H3>No assessment cycles are ready to review yet</H3>
                    <MetaText className="mt-1">Refresh the Arbor catalogue to find the agreed P8 GCSE, A-Level, KS3 percentage, Year 10 percentage, and final-result definitions. This is read-only.</MetaText>
                  </div>
                )}

                {approvedAssessmentCycles.size ? (
                  <form method="post" action="/api/god/integrations/arbor/assessments/approval" className={actionButtonClass}>
                    <CsrfInput token={csrfToken} />
                    <input type="hidden" name="action" value="pause" />
                    <SubmitButton variant="ghost" className="w-full">Pause all assessment imports</SubmitButton>
                  </form>
                ) : null}
                </Card>
              </div>
            </CollapsibleCard>
          </div>
        </>
      ) : integration?.credentialsCiphertext ? (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <H3>Check the Arbor connection</H3>
            <MetaText className="mt-1">This makes one read-only request to Arbor. It does not import or change data.</MetaText>
          </div>
          <form method="post" action="/api/god/integrations/arbor/test" className={actionButtonClass}>
            <CsrfInput token={csrfToken} />
            <SubmitButton variant="secondary" className="w-full">Check connection</SubmitButton>
          </form>
        </Card>
      ) : null}

      {params?.comparison === "success" && previewCount(params.ambiguousMatch) === 0 && previewCount(params.needsReview) === 0 ? (
        <Card className="border-warning/30 bg-[var(--pill-warning-bg)]">
          <form method="post" action="/api/god/integrations/arbor/sync/students" className="space-y-3">
            <CsrfInput token={csrfToken} />
            <div>
              <H3>Apply the first student sync</H3>
              <MetaText className="mt-1">This will link {previewCount(params.possibleMatch)} existing Anaxi students to Arbor and add {previewCount(params.newStudent)} new students. Off-roll records stay untouched. Every change is recorded in the God Mode audit trail.</MetaText>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input required type="checkbox" name="confirm" value="SYNC_STUDENTS" className="mt-1 accent-accent" />
              <span>I have reviewed the comparison and want to apply this student sync.</span>
            </label>
            <SubmitButton className={actionButtonClass}>Apply student sync</SubmitButton>
          </form>
        </Card>
      ) : null}

      {params?.staff === "success" && previewCount(params.ambiguous) === 0 && (previewCount(params.possiblePrimaryOnly) + previewCount(params.possibleSecondaryOnly) + previewCount(params.possibleBoth)) > 0 ? (
        <Card className="border-warning/30 bg-[var(--pill-warning-bg)]">
          <form method="post" action="/api/god/integrations/arbor/sync/staff" className="space-y-3">
            <CsrfInput token={csrfToken} />
            <div>
              <H3>Apply the first staff sync</H3>
              <MetaText className="mt-1">This will link {previewCount(params.possiblePrimaryOnly) + previewCount(params.possibleSecondaryOnly) + previewCount(params.possibleBoth)} existing Anaxi staff accounts to Arbor, including cross-school staff. It does not change roles, permissions, passwords, or create the {previewCount(params.unmatched)} unmatched staff accounts.</MetaText>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input required type="checkbox" name="confirm" value="SYNC_STAFF" className="mt-1 accent-accent" />
              <span>I have reviewed the comparison and want to link these existing staff accounts to Arbor.</span>
            </label>
            <SubmitButton className={actionButtonClass}>Apply staff sync</SubmitButton>
          </form>
        </Card>
      ) : null}

      <Card>
        <form method="post" action="/api/god/integrations/arbor" className="space-y-5">
          <CsrfInput token={csrfToken} />
          <div className="space-y-4">
            <div>
              <H3>Arbor application credentials</H3>
              <MetaText className="mt-1">Use the dedicated credentials for the Anaxi app in Arbor&apos;s Developer Portal, not a staff member&apos;s Arbor email and password. These details are stored encrypted and are never shown again after saving.</MetaText>
            </div>
            <FormField id="schoolHostname" label="Arbor school name" required hint={<>Enter the part before <code>.uk.arbor.sc</code>, not the full web address.</>}>
              <input id="schoolHostname" name="schoolHostname" required defaultValue={hostname} className="field" placeholder="goresbrook" autoCapitalize="none" />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="username" label="Arbor API username" required hint="The Anaxi app username from Arbor's Developer Portal.">
                <input id="username" name="username" required className="field" autoComplete="off" />
              </FormField>
              <FormField id="password" label="Arbor API password" required hint="The matching app password or secret from Arbor's Developer Portal.">
                <input id="password" name="password" required type="password" className="field" autoComplete="new-password" />
              </FormField>
            </div>
          </div>

          <fieldset className="space-y-3 border-t border-border/70 pt-5">
            <legend className="p-0">
              <H3>Schools that receive Arbor data</H3>
            </legend>
            <MetaText>Choose both schools for Goresbrook. Their data stays separated inside Anaxi.</MetaText>
            <div className="grid gap-2 sm:grid-cols-2">
              {schools.map((school) => (
                <label key={school.id} className="flex items-center gap-3 rounded-sm border border-border/70 bg-surface/60 px-3 py-3 text-sm">
                  <input type="checkbox" name="tenantIds" value={school.id} defaultChecked={selected.has(school.id)} className="accent-accent" />
                  <span>
                    <span className="block font-medium">{school.name}</span>
                    <MetaText>{school.tenantSettings?.schoolType === "PRIMARY" ? "Primary" : "Secondary"} · {school.status.toLowerCase()}</MetaText>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <SubmitButton className={actionButtonClass}>Save Arbor connection</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
