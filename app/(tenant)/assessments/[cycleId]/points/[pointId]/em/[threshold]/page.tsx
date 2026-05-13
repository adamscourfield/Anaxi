import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { EMTargetGroupToolbar } from "./EMTargetGroupToolbar";
import { EMTargetGroupAccordions } from "./EMTargetGroupAccordions";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";

export default async function EMThresholdPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleId: string; pointId: string; threshold: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { cycleId, pointId, threshold } = await params;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const targetThreshold = parseInt(threshold, 10);
  if (isNaN(targetThreshold) || ![4, 5, 7].includes(targetThreshold)) {
    notFound();
  }

  // Fetch current point and cycle
  const currentPoint = await prisma.assessmentPoint.findUnique({
    where: { id: pointId, tenantId: user.tenantId },
    include: { cycle: true },
  });
  if (!currentPoint) notFound();

  // Find previous point for comparison
  const previousPoint = await prisma.assessmentPoint.findFirst({
    where: { cycleId, tenantId: user.tenantId, ordinal: { lt: currentPoint.ordinal } },
    orderBy: { ordinal: "desc" },
  });

  // Fetch all assessments in current point
  const currentAssessments = await prisma.assessment.findMany({
    where: { pointId, tenantId: user.tenantId },
    include: {
      results: {
        where: { tenantId: user.tenantId, status: "PRESENT" },
        include: { student: true },
      },
    },
  });

  const engA = currentAssessments.find((a) => a.gradeFormat === "GCSE" && /english/i.test(a.subject) && !/lit/i.test(a.subject));
  const mathsA = currentAssessments.find((a) => a.gradeFormat === "GCSE" && /maths?/i.test(a.subject));

  if (!engA || !mathsA) {
    return (
      <div className="w-full text-center py-12">
        <p className="text-muted">English or Maths assessments not found in this result point.</p>
        <Link href={`/assessments/${cycleId}/points/${pointId}`} className="link-accent mt-4 inline-block">
          Back to analysis
        </Link>
      </div>
    );
  }

  // Map students
  const engMap = new Map(engA.results.map((r) => [r.studentId, r]));
  const mathsMap = new Map(mathsA.results.map((r) => [r.studentId, r]));
  const allIds = [...new Set([...engMap.keys(), ...mathsMap.keys()])];

  const bothPresentIds = allIds.filter((id) => engMap.has(id) && mathsMap.has(id));

  // Compute metrics for top cards
  let engMeets = 0;
  let mathsMeets = 0;
  let ppMeets = 0;
  let nonPpMeets = 0;
  let sendMeets = 0;
  let nonSendMeets = 0;

  const ppTotal = bothPresentIds.filter(id => engMap.get(id)!.student.ppFlag).length;
  const sendTotal = bothPresentIds.filter(id => engMap.get(id)!.student.sendFlag).length;
  const nonPpTotal = bothPresentIds.length - ppTotal;
  const nonSendTotal = bothPresentIds.length - sendTotal;

  for (const id of bothPresentIds) {
    const eScore = engMap.get(id)!.normalizedScore;
    const mScore = mathsMap.get(id)!.normalizedScore;
    const student = engMap.get(id)!.student;

    const eHas = eScore !== null && Math.round(eScore * 9) >= targetThreshold;
    const mHas = mScore !== null && Math.round(mScore * 9) >= targetThreshold;
    const bothHas = eHas && mHas;

    if (eHas) engMeets++;
    if (mHas) mathsMeets++;

    if (bothHas) {
      if (student.ppFlag) ppMeets++; else nonPpMeets++;
      if (student.sendFlag) sendMeets++; else nonSendMeets++;
    }
  }

  const engPct = bothPresentIds.length > 0 ? Math.round((engMeets / bothPresentIds.length) * 100) : 0;
  const mathsPct = bothPresentIds.length > 0 ? Math.round((mathsMeets / bothPresentIds.length) * 100) : 0;

  const ppPct = ppTotal > 0 ? Math.round((ppMeets / ppTotal) * 100) : 0;
  const nonPpPct = nonPpTotal > 0 ? Math.round((nonPpMeets / nonPpTotal) * 100) : 0;

  const sendPct = sendTotal > 0 ? Math.round((sendMeets / sendTotal) * 100) : 0;
  const nonSendPct = nonSendTotal > 0 ? Math.round((nonSendMeets / nonSendTotal) * 100) : 0;

  // Previous point data for comparisons
  let prevEngMap = new Map<string, number | null>();
  let prevMathsMap = new Map<string, number | null>();
  let prevAvgMap = new Map<string, number>();

  if (previousPoint) {
    const prevAssessments = await prisma.assessment.findMany({
      where: { pointId: previousPoint.id, tenantId: user.tenantId },
      include: {
        results: {
          where: { tenantId: user.tenantId, status: "PRESENT" },
        },
      },
    });

    const pEngA = prevAssessments.find((a) => a.gradeFormat === "GCSE" && /english/i.test(a.subject) && !/lit/i.test(a.subject));
    const pMathsA = prevAssessments.find((a) => a.gradeFormat === "GCSE" && /maths?/i.test(a.subject));

    if (pEngA) pEngA.results.forEach(r => prevEngMap.set(r.studentId, r.normalizedScore));
    if (pMathsA) pMathsA.results.forEach(r => prevMathsMap.set(r.studentId, r.normalizedScore));

    // Calculate previous averages
    const pSums = new Map<string, number>();
    const pCounts = new Map<string, number>();
    for (const a of prevAssessments) {
      if (a.gradeFormat !== "GCSE") continue;
      for (const r of a.results) {
        if (r.normalizedScore !== null) {
          pSums.set(r.studentId, (pSums.get(r.studentId) || 0) + r.normalizedScore * 9);
          pCounts.set(r.studentId, (pCounts.get(r.studentId) || 0) + 1);
        }
      }
    }
    for (const [sid, sum] of pSums.entries()) {
      prevAvgMap.set(sid, sum / pCounts.get(sid)!);
    }
  }

  // Calculate current averages
  const cSums = new Map<string, number>();
  const cCounts = new Map<string, number>();
  for (const a of currentAssessments) {
    if (a.gradeFormat !== "GCSE") continue;
    for (const r of a.results) {
      if (r.normalizedScore !== null) {
        cSums.set(r.studentId, (cSums.get(r.studentId) || 0) + r.normalizedScore * 9);
        cCounts.set(r.studentId, (cCounts.get(r.studentId) || 0) + 1);
      }
    }
  }

  // Build table rows
  let studentsData = bothPresentIds.map(id => {
    const student = engMap.get(id)!.student;
    const eRaw = engMap.get(id)!.rawValue;
    const mRaw = mathsMap.get(id)!.rawValue;
    const eScore = engMap.get(id)!.normalizedScore;
    const mScore = mathsMap.get(id)!.normalizedScore;

    const eMeets = eScore !== null && Math.round(eScore * 9) >= targetThreshold;
    const mMeets = mScore !== null && Math.round(mScore * 9) >= targetThreshold;
    const met = eMeets && mMeets;

    const cAvg = cCounts.get(id) ? +(cSums.get(id)! / cCounts.get(id)!).toFixed(2) : null;
    const pAvg = prevAvgMap.get(id) ? +(prevAvgMap.get(id)!.toFixed(2)) : null;

    let avgDiff = null;
    if (cAvg !== null && pAvg !== null) {
      avgDiff = +(cAvg - pAvg).toFixed(2);
    }

    return {
      id,
      name: student.fullName,
      year: student.yearGroup,
      sendFlag: student.sendFlag,
      ppFlag: student.ppFlag,
      eRaw,
      mRaw,
      met,
      eMeets,
      mMeets,
      cAvg,
      avgDiff
    };
  });

  // Apply filters via query params
  const rawParams = await searchParams;
  const filterSend = Array.isArray(rawParams.send) ? rawParams.send[0] : rawParams.send;
  const filterPp = Array.isArray(rawParams.pp) ? rawParams.pp[0] : rawParams.pp;
  const filterMet = Array.isArray(rawParams.met) ? rawParams.met[0] : rawParams.met;
  const rawSearch = Array.isArray(rawParams.studentSearch)
    ? rawParams.studentSearch[0]
    : rawParams.studentSearch;
  const studentSearch = (rawSearch ?? "").trim();
  const studentSearchLower = studentSearch.toLowerCase();

  if (filterSend === "true") studentsData = studentsData.filter((s) => s.sendFlag);
  if (filterSend === "false") studentsData = studentsData.filter((s) => !s.sendFlag);
  if (filterPp === "true") studentsData = studentsData.filter((s) => s.ppFlag);
  if (filterPp === "false") studentsData = studentsData.filter((s) => !s.ppFlag);
  if (filterMet === "true") studentsData = studentsData.filter((s) => s.met);
  else if (filterMet === "all") {
    /* show everyone */
  } else {
    studentsData = studentsData.filter((s) => !s.met);
  }
  if (studentSearchLower) {
    studentsData = studentsData.filter((s) =>
      s.name.toLowerCase().includes(studentSearchLower),
    );
  }

  const basePath = `/assessments/${cycleId}/points/${pointId}/em/${threshold}`;
  const defaultMet =
    filterMet === "true" ? "true" : filterMet === "all" ? "all" : "";
  const defaultPp =
    filterPp === "true" ? "true" : filterPp === "false" ? "false" : "";
  const defaultSend =
    filterSend === "true" ? "true" : filterSend === "false" ? "false" : "";
  const hasToolbarFilters = Boolean(
    studentSearch ||
      filterPp ||
      filterSend ||
      filterMet === "true" ||
      filterMet === "all",
  );

  // Sort by average grade descending, then name
  studentsData.sort((a, b) => {
    if (a.cAvg === null && b.cAvg !== null) return 1;
    if (b.cAvg === null && a.cAvg !== null) return -1;
    if (a.cAvg !== null && b.cAvg !== null && a.cAvg !== b.cAvg) return b.cAvg - a.cAvg;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="anx-reports-page min-h-full w-full space-y-8 bg-[color-mix(in_srgb,var(--surface-container)_38%,var(--surface-container-lowest))] pb-16">
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: currentPoint.cycle.label, href: `/assessments/${cycleId}` },
          { label: currentPoint.label, href: `/assessments/${cycleId}/points/${pointId}` },
          { label: `E&M ${targetThreshold}+` },
        ]}
      />

      <PageHeader
        variant="ledger"
        eyebrow="English & Maths"
        title={`Grade ${targetThreshold}+ target group`}
        subtitle={`Students who have not yet achieved grade ${targetThreshold} or above in both English and Maths. Filter to include those who have met the threshold or everyone.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <div className="rounded-sm border border-border bg-[var(--surface-container-lowest)] p-6 shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            English {targetThreshold}+
          </p>
          <p className="mt-4 text-4xl font-bold leading-none tracking-tight text-text tabular-nums">{engPct}%</p>
          <p className="mt-3 text-sm text-muted">
            <span className="font-semibold text-text">{engMeets}</span> students met
          </p>
        </div>
        <div className="rounded-sm border border-border bg-[var(--surface-container-lowest)] p-6 shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Maths {targetThreshold}+
          </p>
          <p className="mt-4 text-4xl font-bold leading-none tracking-tight text-text tabular-nums">{mathsPct}%</p>
          <p className="mt-3 text-sm text-muted">
            <span className="font-semibold text-text">{mathsMeets}</span> students met
          </p>
        </div>
        <div className="rounded-sm border border-border bg-[var(--surface-container-lowest)] p-6 shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">PP vs Non-PP gap</p>
          <p className="mt-4 text-4xl font-bold leading-none tracking-tight text-text tabular-nums">
            {Math.abs(nonPpPct - ppPct)}pp
          </p>
          <p className="mt-3 text-sm leading-snug text-muted">
            {nonPpPct}% Non-PP vs {ppPct}% PP{" "}
            <span className="text-[var(--on-surface-variant)]">(Both E&amp;M)</span>
          </p>
        </div>
        <div className="rounded-sm border border-border bg-[var(--surface-container-lowest)] p-6 shadow-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">SEND vs Non-SEND gap</p>
          <p className="mt-4 text-4xl font-bold leading-none tracking-tight text-text tabular-nums">
            {Math.abs(nonSendPct - sendPct)}pp
          </p>
          <p className="mt-3 text-sm leading-snug text-muted">
            {nonSendPct}% Non-SEND vs {sendPct}% SEND
          </p>
        </div>
      </div>

      <EMTargetGroupToolbar
        basePath={basePath}
        defaultSearch={studentSearch}
        defaultMet={defaultMet}
        defaultPp={defaultPp}
        defaultSend={defaultSend}
        hasFilters={hasToolbarFilters}
      />

      <div className="space-y-3">
        <EMTargetGroupAccordions students={studentsData} />
        <p className="text-sm text-muted">
          Showing{" "}
          <span className="font-semibold text-text">{studentsData.length}</span>
          {filterMet === "all"
            ? " students"
            : filterMet === "true"
              ? " students who met both"
              : " students not yet meeting both"}
        </p>
      </div>
    </div>
  );
}
