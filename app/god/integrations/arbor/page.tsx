import Link from "next/link";
import { requireSuperAdminUser } from "@/lib/admin";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { getCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { CsrfInput } from "@/components/CsrfInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { MetaText } from "@/components/ui/typography";

export default async function ArborIntegrationPage({ searchParams }: { searchParams?: Promise<{ saved?: string; error?: string; test?: string; photo?: string; photoSync?: string; studentPhotos?: string; staffPhotos?: string; unavailable?: string; failed?: string; attendance?: string; attendancePreview?: string; attendanceRecords?: string; attendanceStudents?: string; attendancePct?: string; attendanceLate?: string; attendanceUnmatched?: string; attendanceSync?: string; attendanceFrom?: string; attendanceTo?: string; attendanceCreated?: string; attendanceUpdated?: string; attendancePreserved?: string; behaviour?: string; behaviourPointAwards?: string; behaviourDetentions?: string; behaviourInternalExclusions?: string; behaviourSuspensions?: string; behaviourPreview?: string; behaviourStudents?: string; behaviourPoints?: string; behaviourUnmatched?: string; behaviourCapped?: string; assessment?: string; assessmentRecords?: string; assessmentPreview?: string; assessmentMarks?: string; assessmentLinked?: string; assessmentDefinitions?: string; assessmentPriorityDefinitions?: string; assessmentDefinition?: string; assessmentDefinitionFields?: string; assessmentValues?: string; assessmentValueFormat?: string; assessmentValueExamples?: string; assessmentGrades?: string; assessmentGradeFields?: string; assessmentCatalogue?: string; assessmentCatalogueTotal?: string; assessmentCataloguePriority?: string; assessmentCatalogueLabels?: string; assessmentActive?: string; assessmentActiveMarks?: string; assessmentActiveDefinitions?: string; assessmentActiveLabels?: string; assessmentActiveError?: string; assessmentFilters?: string; assessmentFilterNames?: string; preview?: string; total?: string; primary?: string; secondary?: string; offRoll?: string; review?: string; unrecognised?: string | string[]; comparison?: string; alreadyLinked?: string; possibleMatch?: string; ambiguousMatch?: string; newStudent?: string; skippedOffRoll?: string; needsReview?: string; sync?: string; created?: string; adopted?: string; staff?: string; activeInArbor?: string; linkedPrimaryOnly?: string; linkedSecondaryOnly?: string; linkedBoth?: string; possiblePrimaryOnly?: string; possibleSecondaryOnly?: string; possibleBoth?: string; unmatched?: string; ambiguous?: string; staffSync?: string; linked?: string }> }) {
  await requireSuperAdminUser();
  const [csrfToken, schools, integration, latestBehaviourRun, params] = await Promise.all([
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
    searchParams,
  ]);

  const selected = new Set<string>(integration?.schools.map((school: { tenantId: string }) => school.tenantId) ?? []);
  const hostname = typeof integration?.config?.schoolHostname === "string" ? integration.config.schoolHostname : "";
  const previewCount = (value: string | undefined) => (/^\d+$/.test(value ?? "") ? Number(value) : 0);
  const unrecognisedLevels = Array.isArray(params?.unrecognised)
    ? params.unrecognised
    : params?.unrecognised
      ? [params.unrecognised]
      : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <PageHeader
        variant="ledger"
        eyebrow="God Mode"
        title="Arbor connection"
        subtitle="Connect one Arbor system and choose every Anaxi school that should receive its data."
        actions={<Link href="/god"><Button variant="secondary">Back to schools</Button></Link>}
      />

      {params?.saved === "1" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Arbor connection saved.</div>
          <MetaText className="mt-1">Its login details are encrypted. The connection will remain inactive until the first sync is built and verified.</MetaText>
        </Card>
      ) : null}

      {params?.error === "secure-storage" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Arbor details were not saved.</div>
          <MetaText className="mt-1">Secure credential storage has not been configured for this Anaxi environment. Add the integration encryption key in the hosting environment, then try again.</MetaText>
        </Card>
      ) : null}

      {params?.test === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Arbor connection verified.</div>
          <MetaText className="mt-1">Anaxi can securely read Arbor. No school data has been imported yet.</MetaText>
        </Card>
      ) : null}

      {params?.test === "failed" || params?.test === "not-configured" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Arbor connection needs attention.</div>
          <MetaText className="mt-1">{params?.test === "not-configured" ? "Save the Arbor application credentials before checking the connection." : integration?.lastSyncError ?? "Try saving the Arbor application credentials again."}</MetaText>
        </Card>
      ) : null}

      {params?.photo === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Arbor photo access verified.</div><MetaText className="mt-1">Anaxi can request a photo from Arbor. No image has been imported or stored yet.</MetaText></Card>
      ) : null}

      {params?.photo === "unavailable" || params?.photo === "not-connected" || params?.photo === "no-student" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Arbor photo access is not available yet.</div><MetaText className="mt-1">No image was imported. Check that Arbor has enabled photo API access for the Anaxi app.</MetaText></Card>
      ) : null}

      {params?.photoSync === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Arbor photo sync batch complete.</div><MetaText className="mt-1">{previewCount(params.studentPhotos)} student and {previewCount(params.staffPhotos)} staff photos were copied; {previewCount(params.unavailable)} people had no available Arbor photo, and {previewCount(params.failed)} could not be downloaded. The nightly sync continues in small batches.</MetaText></Card> : null}
      {params?.attendance === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Arbor attendance access verified.</div><MetaText className="mt-1">Anaxi read {previewCount(params.attendanceRecords)} attendance record without importing anything. The next step is a read-only attendance summary preview.</MetaText></Card> : null}
      {params?.attendance === "failed" || params?.attendance === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Arbor attendance access needs attention.</div><MetaText className="mt-1">No attendance data was imported.</MetaText></Card> : null}
      {params?.attendancePreview === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Attendance summary preview complete.</div><MetaText className="mt-1">From the latest seven days, {previewCount(params.attendanceRecords)} records covered {previewCount(params.attendanceStudents)} linked students: {params?.attendancePct ?? "0"}% attendance and {previewCount(params.attendanceLate)} late marks. {previewCount(params.attendanceUnmatched)} records could not be linked. Nothing has been imported.</MetaText></Card> : null}
      {params?.attendancePreview === "failed" || params?.attendancePreview === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Attendance summary preview could not run.</div><MetaText className="mt-1">No attendance data was imported. Anaxi will use the confirmed Arbor response details to adjust the read-only query safely.</MetaText></Card> : null}
      {params?.attendanceSync === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Attendance sync batch complete.</div><MetaText className="mt-1">Anaxi updated its academic-year attendance totals for {params.attendanceFrom} to {params.attendanceTo}: {previewCount(params.attendanceCreated)} new daily snapshots and {previewCount(params.attendanceUpdated)} refreshed snapshots. {previewCount(params.attendancePreserved)} manual snapshots were left unchanged. The nightly sync will continue until it is caught up, then update the latest completed day.</MetaText></Card> : null}
      {params?.attendanceSync === "up-to-date" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Attendance is up to date.</div><MetaText className="mt-1">Anaxi already holds the latest completed academic-year attendance day from Arbor.</MetaText></Card> : null}
      {params?.attendanceSync === "failed" || params?.attendanceSync === "not-connected" || params?.attendanceSync === "confirmation-required" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Attendance sync did not run.</div><MetaText className="mt-1">{params.attendanceSync === "confirmation-required" ? "Confirm the attendance sync before Anaxi changes its attendance measures." : params.attendanceSync === "not-connected" ? "Check the Arbor connection before starting attendance sync." : "No further attendance changes were made after the issue was detected. Check the God Mode audit log."}</MetaText></Card> : null}
      {params?.behaviour === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Arbor behaviour access verified.</div><MetaText className="mt-1">Anaxi read one record from each behaviour source without importing anything: {previewCount(params.behaviourPointAwards)} positive-point awards, {previewCount(params.behaviourDetentions)} detentions, {previewCount(params.behaviourInternalExclusions)} internal exclusions, and {previewCount(params.behaviourSuspensions)} suspensions were available in the test.</MetaText></Card> : null}
      {params?.behaviour === "failed" || params?.behaviour === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Arbor behaviour access needs attention.</div><MetaText className="mt-1">No behaviour data was imported. Anaxi will adjust the read-only check from Arbor’s confirmed response before enabling a sync.</MetaText></Card> : null}
      {params?.behaviourPreview === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Behaviour summary preview complete.</div><MetaText className="mt-1">From the latest seven days, {previewCount(params.behaviourStudents)} linked students had {previewCount(params.behaviourPoints)} positive points, {previewCount(params.behaviourDetentions)} detentions, {previewCount(params.behaviourInternalExclusions)} internal exclusions, and {previewCount(params.behaviourSuspensions)} suspensions. {previewCount(params.behaviourUnmatched)} records could not be linked. {params.behaviourCapped === "1" ? "This is the first 100 records from one or more sources, so it is a safe sample rather than a full period total." : "Nothing has been imported."}</MetaText></Card> : null}
      {params?.behaviourPreview === "failed" || params?.behaviourPreview === "not-connected" || params?.behaviourPreview === "range-mismatch" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Behaviour summary preview could not run.</div><MetaText className="mt-1">{params.behaviourPreview === "range-mismatch" ? "Arbor returned behaviour records outside the requested seven-day period. No data was imported; Anaxi will not enable the sync until the date filter is corrected." : "No behaviour data was imported. Anaxi will use the confirmed Arbor response details to adjust the read-only query safely."}</MetaText></Card> : null}
      {latestBehaviourRun?.status === "SUCCESS" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Latest behaviour sync completed.</div><MetaText className="mt-1">{previewCount(String(latestBehaviourRun.recordsCreated))} new daily snapshots and {previewCount(String(latestBehaviourRun.recordsUpdated))} existing snapshots were updated. Nightly catch-up will continue automatically.</MetaText></Card> : null}
      {latestBehaviourRun?.status === "FAILED" || latestBehaviourRun?.status === "PARTIAL" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Latest behaviour sync needs attention.</div><MetaText className="mt-1">{latestBehaviourRun.errorSummary ?? "No further behaviour changes were made after the issue was detected."}</MetaText></Card> : null}
      {params?.assessment === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Arbor priority-assessment access verified.</div><MetaText className="mt-1">Anaxi read {previewCount(params.assessmentRecords)} progress assessment mark without importing anything. The next step is a read-only mapping preview.</MetaText></Card> : null}
      {params?.assessment === "failed" || params?.assessment === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Arbor assessment access needs attention.</div><MetaText className="mt-1">No assessment data was imported.</MetaText></Card> : null}
      {params?.assessmentPreview === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Assessment mapping preview complete.</div><MetaText className="mt-1">{previewCount(params.assessmentMarks)} Arbor marks were sampled: {previewCount(params.assessmentLinked)} link to Anaxi students across {previewCount(params.assessmentDefinitions)} assessment definitions, including {previewCount(params.assessmentPriorityDefinitions)} matching P8, A-Level, KS1, or KS2. Nothing has been imported.</MetaText></Card> : null}
      {params?.assessmentPreview === "failed" || params?.assessmentPreview === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Assessment mapping preview could not run.</div><MetaText className="mt-1">No assessment data was imported.</MetaText></Card> : null}
      {params?.assessmentDefinition === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Assessment definition checked.</div><MetaText className="mt-1">Arbor confirms these mapping details are available: {params.assessmentDefinitionFields || "none of the required fields"}. Nothing has been imported.</MetaText></Card> : null}
      {params?.assessmentDefinition === "failed" || params?.assessmentDefinition === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Assessment definition check could not run.</div><MetaText className="mt-1">No assessment data was imported.</MetaText></Card> : null}
      {params?.assessmentValues === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Assessment values previewed.</div><MetaText className="mt-1">The sample looks like {params.assessmentValueFormat ?? "needs review"}. Example values: {params.assessmentValueExamples || "none"}. Nothing has been imported.</MetaText></Card> : null}
      {params?.assessmentValues === "failed" || params?.assessmentValues === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Assessment values preview could not run.</div><MetaText className="mt-1">No assessment data was imported.</MetaText></Card> : null}
      {params?.assessmentGrades === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Assessment grade fields checked.</div><MetaText className="mt-1">Arbor confirms these grade label fields are available: {params.assessmentGradeFields || "none"}. Nothing has been imported.</MetaText></Card> : null}
      {params?.assessmentGrades === "failed" || params?.assessmentGrades === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Assessment grade check could not run.</div><MetaText className="mt-1">No assessment data was imported.</MetaText></Card> : null}
      {params?.assessmentCatalogue === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Priority assessment catalogue preview complete.</div><MetaText className="mt-1">Arbor has {previewCount(params.assessmentCatalogueTotal)} assessment definitions, with {previewCount(params.assessmentCataloguePriority)} matching P8, A-Level, KS1, or KS2. {params.assessmentCatalogueLabels ? `Matches: ${params.assessmentCatalogueLabels}.` : ""} Nothing has been imported.</MetaText></Card> : null}
      {params?.assessmentCatalogue === "failed" || params?.assessmentCatalogue === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Priority assessment catalogue preview could not run.</div><MetaText className="mt-1">No assessment data was imported.</MetaText></Card> : null}
      {params?.assessmentActive === "prepared" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Assessment sync prepared.</div><MetaText className="mt-1">{previewCount(params.assessmentActiveDefinitions)} agreed assessment definitions are queued. Anaxi will inspect them one at a time overnight, without importing results until their mappings are safe.</MetaText></Card> : null}
      {params?.assessmentActive === "failed" || params?.assessmentActive === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Active priority assessment preview could not run.</div><MetaText className="mt-1">{params.assessmentActiveError || "No assessment data was imported."}</MetaText></Card> : null}
      {params?.assessmentFilters === "success" ? <Card className="border-success/30 bg-[var(--pill-success-bg)]"><div className="font-medium text-success">Assessment filters checked.</div><MetaText className="mt-1">Arbor supports these progress-mark filters: {params.assessmentFilterNames || "none"}. Nothing has been imported.</MetaText></Card> : null}
      {params?.assessmentFilters === "failed" || params?.assessmentFilters === "not-connected" ? <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Assessment filter check could not run.</div><MetaText className="mt-1">No assessment data was imported.</MetaText></Card> : null}

      {params?.preview === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Student preview complete.</div>
          <MetaText className="mt-1">{previewCount(params.total)} students found: {previewCount(params.primary)} for Primary, {previewCount(params.secondary)} for Secondary, {previewCount(params.offRoll)} off-roll records skipped, and {previewCount(params.review)} needing review. Nothing has been imported.</MetaText>
          {unrecognisedLevels.length > 0 ? <MetaText className="mt-1">Unrecognised levels: {unrecognisedLevels.join("; ")}.</MetaText> : null}
        </Card>
      ) : null}

      {params?.preview === "failed" || params?.preview === "not-connected" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Student preview could not run.</div>
          <MetaText className="mt-1">{params?.preview === "not-connected" ? "Check the Arbor connection before previewing students." : "Anaxi could not read the student fields needed for the preview. No data was imported."}</MetaText>
        </Card>
      ) : null}

      {params?.comparison === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Student comparison complete.</div>
          <MetaText className="mt-1">{previewCount(params.alreadyLinked)} already linked to Arbor, {previewCount(params.possibleMatch)} possible existing Anaxi matches, {previewCount(params.ambiguousMatch)} ambiguous matches, and {previewCount(params.newStudent)} potentially new students. Nothing has been changed.</MetaText>
        </Card>
      ) : null}

      {params?.comparison === "failed" || params?.comparison === "not-connected" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Student comparison could not run.</div>
          <MetaText className="mt-1">{params?.comparison === "not-connected" ? "Check the Arbor connection before comparing students." : "Anaxi could not compare Arbor students with the existing Anaxi records. No data was changed."}</MetaText>
        </Card>
      ) : null}

      {params?.sync === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Student sync complete.</div>
          <MetaText className="mt-1">{previewCount(params.created)} new students were added and {previewCount(params.adopted)} existing Anaxi students were linked to Arbor. Future syncs can update these records safely.</MetaText>
        </Card>
      ) : null}

      {params?.sync === "failed" || params?.sync === "not-connected" || params?.sync === "confirmation-required" || params?.sync === "migration-required" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Student sync did not run.</div>
          <MetaText className="mt-1">{params?.sync === "confirmation-required" ? "Confirm that you want to apply the student sync before it can run." : params?.sync === "not-connected" ? "Check the Arbor connection before syncing students." : params?.sync === "migration-required" ? "Anaxi is updating its database for student-sync audit records. Wait for the latest deployment to finish, then try again." : "No further changes were made after the issue was detected. Check the God Mode audit log."}</MetaText>
        </Card>
      ) : null}

      {params?.staff === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Staff comparison complete.</div>
          <MetaText className="mt-1">{previewCount(params.activeInArbor)} active Arbor staff: {previewCount(params.linkedPrimaryOnly)} already linked to Primary, {previewCount(params.linkedSecondaryOnly)} to Secondary, {previewCount(params.linkedBoth)} to both schools; {previewCount(params.possiblePrimaryOnly)} possible Primary-only matches, {previewCount(params.possibleSecondaryOnly)} possible Secondary-only matches, {previewCount(params.possibleBoth)} possible cross-school matches, {previewCount(params.unmatched)} unmatched, and {previewCount(params.ambiguous)} ambiguous. Nothing has been changed.</MetaText>
        </Card>
      ) : null}

      {params?.staff === "failed" || params?.staff === "not-connected" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]"><div className="font-medium text-danger">Staff comparison could not run.</div><MetaText className="mt-1">No staff records were changed.</MetaText></Card>
      ) : null}

      {params?.staffSync === "success" ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Staff sync complete.</div>
          <MetaText className="mt-1">{previewCount(params.linked)} existing Anaxi staff accounts were linked to Arbor. Their roles and access were not changed. Future nightly syncs can keep their names up to date safely.</MetaText>
        </Card>
      ) : null}

      {params?.staffSync === "failed" || params?.staffSync === "not-connected" || params?.staffSync === "confirmation-required" ? (
        <Card className="border-danger/30 bg-[var(--pill-danger-bg)]">
          <div className="font-medium text-danger">Staff sync did not run.</div>
          <MetaText className="mt-1">{params?.staffSync === "confirmation-required" ? "Confirm that you want to apply the staff sync before it can run." : params?.staffSync === "not-connected" ? "Check the Arbor connection before syncing staff." : "No further changes were made after the issue was detected. Check the God Mode audit log."}</MetaText>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div className="font-medium">How this works</div>
        <MetaText>
          Goresbrook Primary and Goresbrook Secondary can share one Arbor connection while remaining separate Anaxi schools. Before the first sync is enabled, we will confirm the Arbor field that distinguishes the two, so no record is guessed into the wrong school.
        </MetaText>
      </Card>

      {integration?.status === "CONNECTED" ? (
        <>
          <Card className="border-success/30 bg-[var(--pill-success-bg)]">
            <div className="font-medium text-success">Arbor is connected and updating automatically.</div>
            <MetaText className="mt-1">Students, staff, attendance, behaviour and photos run overnight. Primary and Secondary remain separate inside Anaxi.</MetaText>
          </Card>

          <section className="space-y-3">
            <div><div className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Daily data</div><MetaText className="mt-1">These areas are already connected. No regular action is needed.</MetaText></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card><div className="font-medium">Students and staff</div><MetaText className="mt-1">New active students and linked staff are kept up to date from Arbor.</MetaText></Card>
              <Card><div className="font-medium">Attendance and behaviour</div><MetaText className="mt-1">Academic-year attendance and Anaxi&apos;s existing behaviour totals update nightly.</MetaText></Card>
              <Card><div className="font-medium">Profile photos</div><MetaText className="mt-1">Photos continue in small batches. Manually uploaded Anaxi photos are never replaced.</MetaText></Card>
              <Card><div className="font-medium">Assessment data</div><MetaText className="mt-1">The agreed assessment families are being checked gradually. No assessment results will be imported until their mappings are confirmed.</MetaText></Card>
            </div>
          </section>

          <details className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer font-medium">Connection checks and troubleshooting</summary>
            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3"><MetaText>Use these only if something stops updating or a new school is added.</MetaText><form method="post" action="/api/god/integrations/arbor/test"><CsrfInput token={csrfToken} /><Button type="submit" variant="secondary">Check connection</Button></form></div>
              <div className="flex flex-wrap items-center justify-between gap-3"><MetaText>Run a read-only check that Arbor still allows Anaxi to retrieve photos.</MetaText><form method="post" action="/api/god/integrations/arbor/test-photos"><CsrfInput token={csrfToken} /><Button type="submit" variant="secondary">Check photo access</Button></form></div>
              <div className="flex flex-wrap items-center justify-between gap-3"><MetaText>Re-check student routing or staff links without making changes.</MetaText><div className="flex gap-2"><form method="post" action="/api/god/integrations/arbor/preview/students"><CsrfInput token={csrfToken} /><Button type="submit" variant="secondary">Check students</Button></form><form method="post" action="/api/god/integrations/arbor/preview/staff"><CsrfInput token={csrfToken} /><Button type="submit" variant="secondary">Check staff</Button></form></div></div>
            </div>
          </details>
        </>
      ) : integration?.credentialsCiphertext ? (
        <Card className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-medium">Check the Arbor connection</div><MetaText className="mt-1">This makes one read-only request to Arbor. It does not import or change data.</MetaText></div><form method="post" action="/api/god/integrations/arbor/test"><CsrfInput token={csrfToken} /><Button type="submit" variant="secondary">Check connection</Button></form></Card>
      ) : null}

      {params?.comparison === "success" && previewCount(params.ambiguousMatch) === 0 && previewCount(params.needsReview) === 0 ? (
        <Card className="border-warning/30 bg-[var(--pill-warning-bg)]">
          <form method="post" action="/api/god/integrations/arbor/sync/students" className="space-y-3">
            <CsrfInput token={csrfToken} />
            <div>
              <div className="font-medium">Apply the first student sync</div>
              <MetaText className="mt-1">This will link {previewCount(params.possibleMatch)} existing Anaxi students to Arbor and add {previewCount(params.newStudent)} new students. Off-roll records stay untouched. Every change is recorded in the God Mode audit trail.</MetaText>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input required type="checkbox" name="confirm" value="SYNC_STUDENTS" className="mt-1 accent-accent" />
              <span>I have reviewed the comparison and want to apply this student sync.</span>
            </label>
            <Button type="submit">Apply student sync</Button>
          </form>
        </Card>
      ) : null}

      {params?.staff === "success" && previewCount(params.ambiguous) === 0 && (previewCount(params.possiblePrimaryOnly) + previewCount(params.possibleSecondaryOnly) + previewCount(params.possibleBoth)) > 0 ? (
        <Card className="border-warning/30 bg-[var(--pill-warning-bg)]">
          <form method="post" action="/api/god/integrations/arbor/sync/staff" className="space-y-3">
            <CsrfInput token={csrfToken} />
            <div>
              <div className="font-medium">Apply the first staff sync</div>
              <MetaText className="mt-1">This will link {previewCount(params.possiblePrimaryOnly) + previewCount(params.possibleSecondaryOnly) + previewCount(params.possibleBoth)} existing Anaxi staff accounts to Arbor, including cross-school staff. It does not change roles, permissions, passwords, or create the {previewCount(params.unmatched)} unmatched staff accounts.</MetaText>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input required type="checkbox" name="confirm" value="SYNC_STAFF" className="mt-1 accent-accent" />
              <span>I have reviewed the comparison and want to link these existing staff accounts to Arbor.</span>
            </label>
            <Button type="submit">Apply staff sync</Button>
          </form>
        </Card>
      ) : null}

      <Card>
        <form method="post" action="/api/god/integrations/arbor" className="space-y-5">
          <CsrfInput token={csrfToken} />
          <div className="space-y-3">
            <div>
              <div className="font-medium">Arbor application credentials</div>
              <MetaText className="mt-1">Use the dedicated credentials for the Anaxi app in Arbor&apos;s Developer Portal, not a staff member&apos;s Arbor email and password. These details are stored encrypted and are never shown again after saving.</MetaText>
            </div>
            <label className="block text-sm font-medium">
              Arbor school name
              <input name="schoolHostname" required defaultValue={hostname} className="field mt-1 w-full" placeholder="goresbrook" autoCapitalize="none" />
              <MetaText className="mt-1">Enter the part before <code>.uk.arbor.sc</code>, not the full web address.</MetaText>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Arbor API username
                <input name="username" required className="field mt-1 w-full" autoComplete="off" />
                <MetaText className="mt-1">The Anaxi app username from Arbor&apos;s Developer Portal.</MetaText>
              </label>
              <label className="text-sm font-medium">
                Arbor API password
                <input name="password" required type="password" className="field mt-1 w-full" autoComplete="new-password" />
                <MetaText className="mt-1">The matching app password or secret from Arbor&apos;s Developer Portal.</MetaText>
              </label>
            </div>
          </div>

          <fieldset className="space-y-3 border-t border-border/70 pt-5">
            <legend className="font-medium">Schools that receive Arbor data</legend>
            <MetaText>Choose both schools for Goresbrook. Their data stays separated inside Anaxi.</MetaText>
            <div className="grid gap-2 sm:grid-cols-2">
              {schools.map((school) => (
                <label key={school.id} className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface/60 px-3 py-3 text-sm">
                  <input type="checkbox" name="tenantIds" value={school.id} defaultChecked={selected.has(school.id)} className="accent-accent" />
                  <span>
                    <span className="block font-medium">{school.name}</span>
                    <MetaText>{school.tenantSettings?.schoolType === "PRIMARY" ? "Primary" : "Secondary"} · {school.status.toLowerCase()}</MetaText>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <Button type="submit">Save Arbor connection</Button>
        </form>
      </Card>
    </div>
  );
}
