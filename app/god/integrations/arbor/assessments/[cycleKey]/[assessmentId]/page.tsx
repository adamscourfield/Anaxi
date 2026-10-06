import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminUser } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { H3, MetaText } from "@/components/ui/typography";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient, arborAssessmentMarkValue } from "@/lib/integrations/arbor/client";
import { arborHistoricYearGroup, mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";
import { arborConnectionHref } from "@/lib/integrations/arbor/connectionScope";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null; periodHint?: string | null; yearGroups?: string[]; source?: "PROGRESS_MARK" | "BATCH_TARGET" | "BATCH" };
type ArborMark = Awaited<ReturnType<ArborClient["listAssessmentMarks"]>>[number];

function decodeCycleKey(value: string): string {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    return decoded.startsWith("ARBOR:assessment-cycle:") ? decoded : value;
  } catch {
    return value;
  }
}

function assessmentYearRange(academicYear: string): { from: string; before: string } | undefined {
  const match = academicYear.match(/^(20\d{2})\/(20\d{2})$/);
  return match ? { from: `${match[1]}-09-01`, before: `${match[2]}-09-01` } : undefined;
}

function gradeValue(mark: ArborMark): string {
  return arborAssessmentMarkValue(mark) ?? "No recorded grade";
}

function arborStudentName(mark: ArborMark): string | null {
  const student = mark.student;
  const firstName = student.preferredFirstName?.trim() || student.legalFirstName?.trim();
  const lastName = student.preferredLastName?.trim() || student.legalLastName?.trim();
  return [firstName, lastName].filter(Boolean).join(" ") || null;
}

function newestMark(marks: ArborMark[]): ArborMark {
  return [...marks].sort((a, b) => (b.assessmentDate ?? "").localeCompare(a.assessmentDate ?? ""))[0];
}

export default async function ArborAssessmentMarkSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleKey: string; assessmentId: string }>;
  searchParams?: Promise<{ connectionId?: string }>;
}) {
  await requireSuperAdminUser();
  const { cycleKey: encodedCycleKey, assessmentId: encodedAssessmentId } = await params;
  const query = await searchParams;
  const cycleKey = decodeCycleKey(encodedCycleKey);
  const assessmentId = decodeURIComponent(encodedAssessmentId);
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({
    where: { provider: "ARBOR", ...(query?.connectionId ? { id: query.connectionId } : {}) },
    select: { id: true, credentialsCiphertext: true, status: true, config: true, schools: { select: { tenantId: true } } },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") notFound();

  const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
  const sync = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as Record<string, unknown> : {};
  const definitions = Array.isArray(sync.historicalDefinitions)
    ? sync.historicalDefinitions.filter((item): item is PreparedDefinition => Boolean(item) && typeof (item as PreparedDefinition).id === "string" && typeof (item as PreparedDefinition).label === "string")
    : [];
  // A single Arbor subject definition can be present in Autumn, Spring, and
  // Summer. Select the dated discovery record for this URL's requested cycle,
  // rather than whichever term happened to be stored first.
  const definition = definitions.find((item) => {
    if (item.id !== assessmentId) return false;
    const candidate = mapArborAssessment(item.label, item.assessmentDate, item.periodHint);
    if (!candidate) return false;
    const discoveredYearGroups = item.yearGroups?.length ? item.yearGroups : candidate?.yearGroups ?? [];
    return discoveredYearGroups.some((value) => mapArborAssessmentForYearGroup(candidate, value)?.cycleExternalId === cycleKey);
  });
  if (!definition) notFound();

  const mapping = mapArborAssessment(definition.label, definition.assessmentDate, definition.periodHint);
  if (!mapping) notFound();
  const discoveredYearGroups = definition.yearGroups?.length ? definition.yearGroups : mapping?.yearGroups ?? [];
  const yearGroup = discoveredYearGroups.find((value) => mapArborAssessmentForYearGroup(mapping, value)?.cycleExternalId === cycleKey);
  const cycle = mapping && yearGroup ? mapArborAssessmentForYearGroup(mapping, yearGroup) : null;
  if (!mapping || !cycle || !yearGroup) notFound();

  const tenantIds = (integration.schools as Array<{ tenantId: string }>).map((school) => school.tenantId);
  // Load linked and archived pupils before filtering Arbor's roster. A Year 13
  // leaver has no current Arbor level, but their archived Anaxi record and
  // leaving date can still place their historic result in the right cohort.
  const linkedStudents = tenantIds.length
    ? await db.student.findMany({
      where: { tenantId: { in: tenantIds }, externalId: { not: null } },
      select: { externalId: true, fullName: true, yearGroup: true, status: true },
    })
    : [];
  const studentsByExternalId = new Map<string, { externalId: string; fullName: string; yearGroup: string | null; status: string }>(
    (linkedStudents as Array<{ externalId: string; fullName: string; yearGroup: string | null; status: string }>).map((student) => [student.externalId, student]),
  );
  const client = new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
  const batchTarget = definition.source === "BATCH_TARGET"
    ? await client.getProgressAssessmentBatchTarget(definition.id)
    : null;
  const batch = definition.source === "BATCH"
    ? await client.getProgressAssessmentBatch(definition.id)
    : null;
  const batchAssessmentId = batch?.assessment?.id ?? definition.id;
  const batchTargets = batch ? await client.listProgressAssessmentBatchTargets([batch.id]) : [];
  const batchRoster = [...new Map(
    batchTargets.flatMap((target) => target.allStudents).map((student) => [student.id, student]),
  ).values()];
  const batchRosterIds = new Set(batchRoster.map((student) => student.id));
  const targetMarks = batchTargets.flatMap((target) => target.studentProgressAssessmentMarks)
    .filter((mark) => batchRosterIds.has(mark.student.id));
  const progressMarks = batch
    ? (await client.listAssessmentMarksForDefinitionInRange(batchAssessmentId, assessmentYearRange(cycle.academicYear)))
      .filter((mark) => batchRosterIds.has(mark.student.id))
    : [];
  const allMarks: ArborMark[] = batchTarget
    ? [
      ...batchTarget.studentProgressAssessmentMarks,
      // A target's students are Arbor's roster even if a particular pupil has
      // not received a grade yet. Include a blank row for those pupils rather
      // than substituting the whole year group.
      ...batchTarget.students
        .filter((student) => !batchTarget.studentProgressAssessmentMarks.some((mark) => mark.student.id === student.id))
        .map((student) => ({
          id: `roster:${batchTarget.id}:${student.id}`,
          student,
          assessmentDate: definition.assessmentDate ?? null,
          displayName: definition.periodHint ?? null,
          valueFields: {},
          grade: null,
          assessment: batchTarget.progressAssessmentBatch?.assessment ?? null,
        })),
    ]
    : batch
      ? [
        ...(targetMarks.length ? targetMarks : progressMarks),
        ...batchRoster
          .filter((student) => !(targetMarks.length ? targetMarks : progressMarks).some((mark) => mark.student.id === student.id))
          .map((student) => ({
            id: `roster:${batch.id}:${student.id}`,
            student,
            assessmentDate: definition.assessmentDate ?? null,
            displayName: definition.periodHint ?? null,
            valueFields: {},
            grade: null,
            assessment: batch.assessment,
          })),
      ]
      : await client.listAssessmentMarksForDefinitionInRange(definition.id, assessmentYearRange(cycle.academicYear));
  // Arbor accepts an assessment filter but a review must not rely on that
  // server-side filter alone. Verify the relationship on every returned mark
  // before it can appear in a subject sheet.
  const subjectMarks = batchTarget || batch ? allMarks : allMarks.filter((mark) => mark.assessment?.id === definition.id);
  const termMarks = batchTarget || batch ? subjectMarks : subjectMarks.filter((mark) => {
    // Arbor returns every dated mark for this subject definition. Keep only
    // the term represented by the requested cycle; otherwise a July result
    // can incorrectly replace an Autumn mark in the review grid.
    const markMapping = mapArborAssessment(
      mark.assessment ? `${mark.assessment.assessmentName ?? mark.assessment.assessmentShortName ?? mark.assessment.displayName ?? definition.label}` : definition.label,
      mark.assessmentDate,
      mark.displayName,
    );
    return Boolean(markMapping && mapArborAssessmentForYearGroup(markMapping, yearGroup)?.cycleExternalId === cycleKey);
  });
  const marks = (batch || batchTarget) ? termMarks : termMarks.filter((mark) => {
    const linkedStudent = studentsByExternalId.get(mark.student.id);
    const historicYearGroup = arborHistoricYearGroup(
      mark.student.displayAcademicLevel?.displayName,
      linkedStudent?.status === "ARCHIVED" ? linkedStudent.yearGroup : null,
      mark.student.leavingDate,
      cycle.academicYear,
      mapping.family,
    );
    return historicYearGroup === yearGroup;
  });

  // Arbor's mark records are the subject roster: we intentionally do not add the
  // wider year group, even when a pupil has not yet received a grade.
  const marksByStudent = new Map<string, ArborMark[]>();
  for (const mark of marks) {
    const studentMarks = marksByStudent.get(mark.student.id) ?? [];
    studentMarks.push(mark);
    marksByStudent.set(mark.student.id, studentMarks);
  }
  const studentExternalIds = [...marksByStudent.keys()];
  const rows = studentExternalIds.map((externalId) => {
    const mark = newestMark(marksByStudent.get(externalId) ?? []);
    return { externalId, mark, student: studentsByExternalId.get(externalId) ?? null };
  }).sort((a, b) => (a.student?.fullName ?? arborStudentName(a.mark) ?? a.externalId).localeCompare(b.student?.fullName ?? arborStudentName(b.mark) ?? b.externalId));
  const recordedGrades = rows.filter(({ mark }) => gradeValue(mark) !== "No recorded grade").length;
  const reviewPath = `/god/integrations/arbor/assessments/${encodeURIComponent(Buffer.from(cycleKey).toString("base64url"))}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        eyebrow="God Mode · Arbor · Assessment review"
        title={definition.label}
        subtitle="Read-only Arbor mark sheet. Every row is a pupil returned by Arbor for this subject assessment; Anaxi does not add other pupils from the year group."
        actions={<Link href={arborConnectionHref(reviewPath, integration.id)}><Button variant="secondary">Back to subject assessments</Button></Link>}
      />

      <Card className="grid gap-4 sm:grid-cols-3">
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Arbor subject roster</div><div className="mt-1 text-2xl font-semibold">{new Set(termMarks.map((mark) => mark.student.id)).size}</div><MetaText>{subjectMarks.length} records verified for this subject</MetaText></div>
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Recorded marks</div><div className="mt-1 text-2xl font-semibold">{recordedGrades}</div><MetaText>With a grade or result</MetaText></div>
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Included in this cycle</div><div className="mt-1 text-2xl font-semibold">{rows.length}</div><MetaText>{rows.filter((row) => row.student).length} linked to Anaxi</MetaText></div>
      </Card>

      <Card className="space-y-3">
        <div>
          <H3>Arbor mark sheet</H3>
          <MetaText className="mt-1">{cycle.cycleLabel} · {cycle.gradeFormat === "PERCENTAGE" ? "Percentage" : cycle.gradeFormat === "A_LEVEL" ? "A-Level" : "GCSE"} · This view does not create, amend, or import results.</MetaText>
        </div>
        {rows.length ? (
          <div className="max-h-[70vh] overflow-auto rounded-sm border border-border/70">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--surface-container-low)] text-xs uppercase tracking-[0.1em] text-muted">
                <tr><th className="px-4 py-3">Pupil</th><th className="px-4 py-3">Year</th><th className="px-4 py-3">Arbor link</th><th className="px-4 py-3">Assessment date</th><th className="px-4 py-3">Mark</th></tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {rows.map(({ externalId, mark, student }) => (
                  <tr key={externalId}>
                    <td className="px-4 py-3 font-medium">{student?.fullName ?? arborStudentName(mark) ?? "Former pupil not yet synced"}</td>
                    <td className="px-4 py-3">{student?.yearGroup ?? yearGroup.replace(/^Y/, "Year ")}</td>
                    <td className="px-4 py-3 text-muted">{student ? student.status === "ARCHIVED" ? "Archived" : "Linked" : "Historic pupil"}</td>
                    <td className="px-4 py-3">{mark.assessmentDate ? new Date(mark.assessmentDate).toLocaleDateString("en-GB") : "Not supplied"}</td>
                    <td className="px-4 py-3 font-semibold">{gradeValue(mark)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <MetaText>Arbor returned no subject roster records for this definition in the selected academic year.</MetaText>}
      </Card>
    </div>
  );
}
