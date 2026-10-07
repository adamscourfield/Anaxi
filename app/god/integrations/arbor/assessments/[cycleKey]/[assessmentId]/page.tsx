import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminUser } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { H3, MetaText } from "@/components/ui/typography";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient, arborAssessmentMarkValue, type ArborQualificationResult } from "@/lib/integrations/arbor/client";
import { arborHistoricYearGroup, arborYearGroupAtAssessment, mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";
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

function currentAcademicYear(now = new Date()): string {
  const year = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 8 ? year : year - 1;
  return `${start}/${start + 1}`;
}

function normalisedYearGroup(value: string | null | undefined): string | null {
  const match = value?.trim().match(/^(?:Year|Y)\s*0?(\d{1,2})$/i);
  return match ? `Y${Number(match[1])}` : null;
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
  return [...marks].sort((a, b) => {
    const gradeDifference = Number(gradeValue(b) !== "No recorded grade") - Number(gradeValue(a) !== "No recorded grade");
    return gradeDifference || (b.assessmentDate ?? "").localeCompare(a.assessmentDate ?? "");
  })[0];
}

/**
 * Qualification results are stored separately from progress mark sheets in
 * Arbor. Match the actual qualification subject, not a broad phrase such as
 * "A-Level", so results never leak between subjects.
 */
function normalisedQualificationSubject(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\bfurther\s+maths?\b/g, "further mathematics")
    .replace(/\bmaths\b/g, "mathematics")
    .replace(/\b(?:p8|a[-\s]?level|gce|gcse|qualification|assessment|summer|spring|autumn|final|actual|results?|exam\s*board|ks\s*\d|year\s*\d+|y\s*\d+|level\s*\d+(?:\s*\/\s*\d+)?)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function qualificationResultMatchesDefinition(result: ArborQualificationResult, definitionLabel: string): boolean {
  const expected = normalisedQualificationSubject(definitionLabel);
  if (!expected || expected.length < 3) return false;
  const candidates = [
    result.qualificationAward?.shortTitle,
    result.qualificationAward?.title,
  ].map(normalisedQualificationSubject).filter(Boolean);

  // Arbor award titles often include an awarding body or qualification prefix
  // (for example "AQA GCE A Level Further Mathematics"). The configured
  // assessment label is the specific subject, so only allow the Arbor title
  // to contain that full subject; never reverse the comparison, which would
  // incorrectly put Mathematics results in Further Mathematics.
  return candidates.some((candidate) => candidate === expected || candidate.includes(expected));
}

function studentSubjectMatchesAssessment(studentSubject: string, assessmentLabel: string): boolean {
  const subject = normalisedQualificationSubject(studentSubject);
  const assessment = normalisedQualificationSubject(assessmentLabel);
  if (!subject || !assessment) return false;
  if (subject === assessment || subject.includes(assessment)) return true;
  // Do not allow the generic Mathematics membership to satisfy Further
  // Mathematics. Other short Arbor subject names (for example, Biology) are
  // safe contained matches for their longer assessment labels.
  return !assessment.includes("further mathematics") && assessment.includes(subject);
}

function qualificationResultAsMark(
  result: ArborQualificationResult,
  definition: PreparedDefinition,
  assessment: ArborMark["assessment"],
): ArborMark | null {
  if (!result.student) return null;
  return {
    id: `qualification-result:${result.id}`,
    student: result.student,
    assessmentDate: result.resultDate ?? definition.assessmentDate ?? null,
    // Keep the discovered cycle's period: a July published result belongs in
    // the reviewed Summer cycle even if Arbor labels the result record itself
    // only as a qualification outcome.
    displayName: definition.periodHint ?? null,
    valueFields: {
      ...(result.numericDisplayValue ? { resultValue: result.numericDisplayValue } : {}),
      ...(result.numericValue === null ? {} : { numericValue: result.numericValue }),
    },
    grade: null,
    assessment,
  };
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
  // Older discovery records identify a target while newer records identify its
  // parent batch. Both represent the same subject assessment and must read
  // the same dated mark feed.
  const batchMetadata = batch ?? batchTarget?.progressAssessmentBatch ?? null;
  const batchAssessmentId = batchMetadata?.assessment?.id ?? definition.id;
  const batchTargets = batch
    ? await client.listProgressAssessmentBatchTargets([batch.id])
    : batchTarget ? [batchTarget] : [];
  const batchRoster = [...new Map(
    batchTargets.flatMap((target) => target.allStudents.length ? target.allStudents : target.students).map((student) => [student.id, student]),
  ).values()];
  const targetMarks = batchTargets.flatMap((target) => target.studentProgressAssessmentMarks);
  const progressMarks = batchMetadata
    ? (await client.listAssessmentMarksForDefinitionInRange(batchAssessmentId, assessmentYearRange(cycle.academicYear)))
      .filter((mark) => mark.assessment?.id === batchAssessmentId)
    : [];
  // A live batch target can omit former pupils after rollover, even though
  // Arbor still returns their dated, subject-specific assessment mark. Merge
  // those records into the roster rather than losing valid historic results.
  const recordedBatchMarks = [...progressMarks, ...targetMarks];
  const recordedBatchStudentIds = new Set(recordedBatchMarks.map((mark) => mark.student.id));
  const allMarks: ArborMark[] = batchMetadata
      ? [
        ...recordedBatchMarks,
        ...batchRoster
          .filter((student) => !recordedBatchStudentIds.has(student.id))
          .map((student) => ({
            id: `roster:${batchMetadata.id}:${student.id}`,
            student,
            assessmentDate: definition.assessmentDate ?? null,
            displayName: definition.periodHint ?? null,
            valueFields: {},
            grade: null,
            assessment: batchMetadata.assessment,
          })),
      ]
      : await client.listAssessmentMarksForDefinitionInRange(definition.id, assessmentYearRange(cycle.academicYear));

  // Published GCSE and A-Level outcomes use Arbor's dedicated qualification
  // source. Batch targets are useful rosters for internal mark books but can
  // contain a whole-cohort allocation with blank cells for final outcomes.
  // When this source supplies subject-specific rows for a Summer/Final review,
  // it is authoritative and intentionally replaces those placeholders.
  const usesQualificationResults = (mapping.family === "GCSE" || (mapping.family === "A_LEVEL" && yearGroup === "Y13"))
    && (cycle.pointLabel === "Summer" || cycle.pointLabel === "Final");
  let qualificationReadFailed = false;
  let qualificationReadError: string | null = null;
  let qualificationResultsRead = 0;
  let qualificationMarks: ArborMark[] = [];
  if (usesQualificationResults) {
    try {
      const qualificationResults = await client.listQualificationResultsInRange(assessmentYearRange(cycle.academicYear));
      qualificationResultsRead = qualificationResults.length;
      qualificationMarks = qualificationResults
        .filter((result) => qualificationResultMatchesDefinition(result, definition.label))
        .map((result) => qualificationResultAsMark(result, definition, batchMetadata?.assessment ?? {
          id: definition.id,
          displayName: definition.label,
          assessmentName: definition.label,
          assessmentShortName: null,
        }))
        .filter((mark): mark is ArborMark => Boolean(mark));
    } catch (error) {
      // The review remains available from the existing, read-only mark feed.
      // Never make an Arbor source problem look like an Anaxi application error.
      qualificationReadFailed = true;
      qualificationReadError = error instanceof Error ? error.message.slice(0, 220) : "Arbor did not return qualification outcomes.";
    }
  }
  // Arbor accepts an assessment filter but a review must not rely on that
  // server-side filter alone. Verify the relationship on every returned mark
  // before it can appear in a subject sheet.
  const subjectMarks = qualificationMarks.length
    ? qualificationMarks
    : batchMetadata ? allMarks : allMarks.filter((mark) => mark.assessment?.id === definition.id);
  const termMarks = subjectMarks.filter((mark) => {
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
  const yearGroupMarks = termMarks.filter((mark) => {
    const linkedStudent = studentsByExternalId.get(mark.student.id);
    // For active pupils, Anaxi's linked record is the current cohort. Rebase
    // that current year to the assessment year so 2025/26 Year 12 results
    // follow the same pupils into their 2026/27 Year 13 view. Archived pupils
    // retain the historic/leaver handling below.
    const historicYearGroup = linkedStudent?.status === "ACTIVE"
      ? arborYearGroupAtAssessment(linkedStudent.yearGroup, cycle.academicYear)
      : arborHistoricYearGroup(
        mark.student.displayAcademicLevel?.displayName,
        linkedStudent?.status === "ARCHIVED" ? linkedStudent.yearGroup : null,
        mark.student.leavingDate,
        cycle.academicYear,
        mapping.family,
      );
    return historicYearGroup === yearGroup;
  });

  // A historic Year 12 A-Level sheet must follow the current Year 13 subject
  // class. GCSE French in Year 11 is not evidence that a pupil takes A-Level
  // French, so this stricter rule deliberately applies even to a recorded
  // placeholder mark. It prevents the Year 11 GCSE cohort being promoted into
  // a Year 12 A-Level assessment merely because the labels share a subject.
  const requiresCurrentYear13SubjectRoster = mapping.family === "A_LEVEL"
    && yearGroup === "Y12"
    && cycle.academicYear !== currentAcademicYear();
  let subjectsByStudent = new Map<string, string[]>();
  if (mapping.family === "A_LEVEL" && yearGroup === "Y12") {
    try {
      subjectsByStudent = await client.listAcademicUnitSubjectsForStudents([...new Set(yearGroupMarks.map((mark) => mark.student.id))]);
    } catch {
      // Keep the review available if Arbor's optional timetable relationship is
      // temporarily unavailable; this remains a read-only guard, not a sync.
    }
  }
  const marks = yearGroupMarks.filter((mark) => {
    const linkedStudent = studentsByExternalId.get(mark.student.id);
    const enrolledSubjects = subjectsByStudent.get(mark.student.id);
    if (requiresCurrentYear13SubjectRoster) {
      // Arbor's Year 12 A-Level batch rosters can contain the entire current
      // Year 13 cohort, even where the academic-unit enrolment is equally
      // broad. A recorded outcome is the only per-pupil evidence available in
      // this historic feed, so never render an ungraded placeholder as if it
      // proved subject membership.
      return linkedStudent?.status === "ACTIVE"
        && normalisedYearGroup(linkedStudent.yearGroup) === "Y13"
        && gradeValue(mark) !== "No recorded grade"
        && Boolean(enrolledSubjects?.some((subject) => studentSubjectMatchesAssessment(subject, definition.label)));
    }
    if (gradeValue(mark) !== "No recorded grade") return true;
    if (!enrolledSubjects?.length) return true;
    return enrolledSubjects.some((subject) => studentSubjectMatchesAssessment(subject, definition.label));
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
        subtitle="Read-only Arbor mark sheet. Historic cycles follow the same pupils into their current cohort where they remain enrolled; archived leavers stay visible as historic records."
        actions={<Link href={arborConnectionHref(reviewPath, integration.id)}><Button variant="secondary">Back to subject assessments</Button></Link>}
      />

      <Card className="grid gap-4 sm:grid-cols-3">
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Arbor subject roster</div><div className="mt-1 text-2xl font-semibold">{new Set(marks.map((mark) => mark.student.id)).size}</div><MetaText>{subjectMarks.length} records verified for this subject</MetaText></div>
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Recorded marks</div><div className="mt-1 text-2xl font-semibold">{recordedGrades}</div><MetaText>With a grade or result</MetaText></div>
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Included in this cycle</div><div className="mt-1 text-2xl font-semibold">{rows.length}</div><MetaText>{rows.filter((row) => row.student).length} linked to Anaxi</MetaText></div>
      </Card>

      <Card className="space-y-3">
        <div>
          <H3>Arbor mark sheet</H3>
          <MetaText className="mt-1">{cycle.cycleLabel} · {cycle.gradeFormat === "PERCENTAGE" ? "Percentage" : cycle.gradeFormat === "A_LEVEL" ? "A-Level" : "GCSE"} · This view does not create, amend, or import results.</MetaText>
        </div>
        {qualificationReadFailed ? <MetaText>Arbor could not provide qualification outcomes for this sheet just now. The available progress mark feed is shown instead; no data has been changed. Detail: {qualificationReadError}</MetaText> : null}
        {usesQualificationResults && !qualificationReadFailed ? <MetaText>Qualification-result source checked: {qualificationResultsRead} outcome{qualificationResultsRead === 1 ? "" : "s"} in this academic year; {qualificationMarks.length} matched to this subject.</MetaText> : null}
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
                    <td className="px-4 py-3">{student?.yearGroup?.replace(/^Y/i, "Year ") ?? yearGroup.replace(/^Y/, "Year ")}</td>
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
