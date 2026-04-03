import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

function gcseColour(g: string | number | null): string {
  if (g === null) return "bg-slate-100 text-slate-400";
  const n = Number(g);
  if (n >= 8) return "bg-emerald-600 text-white";
  if (n >= 7) return "bg-green-500 text-white";
  if (n >= 6) return "bg-blue-500 text-slate-900";
  if (n >= 5) return "bg-violet-500 text-white";
  if (n >= 4) return "bg-amber-500 text-slate-900";
  if (n >= 3) return "bg-orange-500 text-white";
  return "bg-red-600 text-white";
}

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
        <p className="text-slate-500">English or Maths assessments not found in this result point.</p>
        <Link href={`/assessments/${cycleId}/points/${pointId}`} className="text-accent mt-4 inline-block hover:underline">
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
    
    // Check if met both
    const met = eScore !== null && Math.round(eScore * 9) >= targetThreshold && mScore !== null && Math.round(mScore * 9) >= targetThreshold;

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
      cAvg,
      avgDiff
    };
  });

  // Apply filters via query params
  const rawParams = await searchParams;
  const paramsObj = new URLSearchParams();
  if (rawParams.send) paramsObj.set("send", String(rawParams.send));
  if (rawParams.pp) paramsObj.set("pp", String(rawParams.pp));
  if (rawParams.met) paramsObj.set("met", String(rawParams.met));

  const filterSend = paramsObj.get("send");
  const filterPp = paramsObj.get("pp");
  const filterMet = paramsObj.get("met");
  
  if (filterSend === "true") studentsData = studentsData.filter(s => s.sendFlag);
  if (filterSend === "false") studentsData = studentsData.filter(s => !s.sendFlag);
  if (filterPp === "true") studentsData = studentsData.filter(s => s.ppFlag);
  if (filterPp === "false") studentsData = studentsData.filter(s => !s.ppFlag);
  if (filterMet === "true") studentsData = studentsData.filter(s => s.met);
  if (filterMet === "false") studentsData = studentsData.filter(s => !s.met);

  // Sort by average grade descending, then name
  studentsData.sort((a, b) => {
    if (a.cAvg === null && b.cAvg !== null) return 1;
    if (b.cAvg === null && a.cAvg !== null) return -1;
    if (a.cAvg !== null && b.cAvg !== null && a.cAvg !== b.cAvg) return b.cAvg - a.cAvg;
    return a.name.localeCompare(b.name);
  });

  function getTrendIcon(diff: number | null) {
    if (diff === null) return <span className="text-muted">—</span>;
    if (diff > 0.1) return <span className="text-emerald-500 font-bold">↗ +{diff}</span>;
    if (diff < -0.1) return <span className="text-red-500 font-bold">↘ {diff}</span>;
    return <span className="text-slate-400 font-bold">→ {diff}</span>;
  }

  function getFilterUrl(key: string, val: string | null) {
    const u = new URLSearchParams(paramsObj);
    if (val === null) u.delete(key);
    else u.set(key, val);
    return `?${u.toString()}`;
  }

  return (
    <div className="w-full space-y-8 pb-16">
      {/* Top Breadcrumb & Header */}
      <div className="flex items-center gap-2 text-sm text-[var(--on-surface-muted)]">
        <Link href="/assessments" className="hover:underline">Attainment Cycles</Link>
        <span>›</span>
        <Link href={`/assessments/${cycleId}`} className="hover:underline">{currentPoint.cycle.label}</Link>
        <span>›</span>
        <Link href={`/assessments/${cycleId}/points/${pointId}`} className="hover:underline">{currentPoint.label}</Link>
        <span>›</span>
        <span className="text-[var(--on-surface)]">E&M {targetThreshold}+</span>
      </div>

      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.03em] text-slate-900 sm:text-[36px]">
          English & Maths {targetThreshold}+ Target Group
        </h1>
        <p className="mt-1 text-sm text-[var(--on-surface-muted)]">Detailed student breakdown and average grade tracking.</p>
      </div>

      {/* Top 4 Metrics Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-[var(--outline-variant)]/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">English {targetThreshold}+</p>
          <div className="mt-3">
             <span className="text-3xl font-bold leading-none tracking-tight text-slate-900">{engPct}%</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{engMeets} students met</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-[var(--outline-variant)]/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Maths {targetThreshold}+</p>
          <div className="mt-3">
             <span className="text-3xl font-bold leading-none tracking-tight text-slate-900">{mathsPct}%</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{mathsMeets} students met</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-[var(--outline-variant)]/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">PP vs Non-PP Gap</p>
          <div className="mt-3">
             <span className="text-3xl font-bold leading-none tracking-tight text-slate-900">
               {Math.abs(nonPpPct - ppPct)}pp
             </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
             {nonPpPct}% Non-PP vs {ppPct}% PP (Both E&M)
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-[var(--outline-variant)]/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">SEND vs Non-SEND Gap</p>
          <div className="mt-3">
             <span className="text-3xl font-bold leading-none tracking-tight text-slate-900">
               {Math.abs(nonSendPct - sendPct)}pp
             </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
             {nonSendPct}% Non-SEND vs {sendPct}% SEND
          </p>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex gap-4 items-center flex-wrap">
         <span className="text-sm font-semibold text-slate-700">Filter:</span>
         <div className="flex gap-2">
            <Link href={getFilterUrl('pp', null)} className={`rounded-xl px-3 py-1 text-xs font-bold ${!filterPp ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>All</Link>
            <Link href={getFilterUrl('pp', 'true')} className={`rounded-xl px-3 py-1 text-xs font-bold ${filterPp === 'true' ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-600'}`}>PP</Link>
            <Link href={getFilterUrl('pp', 'false')} className={`rounded-xl px-3 py-1 text-xs font-bold ${filterPp === 'false' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Non-PP</Link>
         </div>
         <div className="w-px h-6 bg-[var(--outline-variant)]/30 mx-2"></div>
         <div className="flex gap-2">
            <Link href={getFilterUrl('send', null)} className={`rounded-xl px-3 py-1 text-xs font-bold ${!filterSend ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>All</Link>
            <Link href={getFilterUrl('send', 'true')} className={`rounded-xl px-3 py-1 text-xs font-bold ${filterSend === 'true' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>SEND</Link>
            <Link href={getFilterUrl('send', 'false')} className={`rounded-xl px-3 py-1 text-xs font-bold ${filterSend === 'false' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Non-SEND</Link>
         </div>
      </div>

      {/* Explorer Match Table */}
      <div className="mt-4 table-shell rounded-2xl border border-[var(--outline-variant)]/20 shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-[var(--outline-variant)]/20 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Name</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3 text-center">English</th>
                <th className="px-4 py-3 text-center">Maths</th>
                <th className="px-4 py-3 text-center">Met Both?</th>
                <th className="px-4 py-3 text-center">Overall Avg</th>
                <th className="px-4 py-3 text-center">vs Prev Point</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--outline-variant)]/10">
              {studentsData.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-slate-500">No students match your criteria.</td></tr>
              ) : (
                studentsData.map((row) => (
                  <tr key={row.id} className="group hover:bg-slate-50 transition-colors">
                    {/* Name */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{row.name}</span>
                        <span className="text-[11px] text-slate-400">Year {row.year ?? "—"}</span>
                      </div>
                    </td>

                    {/* Flags */}
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1.5 flex-wrap">
                        {row.sendFlag && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">SEND</span>
                        )}
                        {row.ppFlag && (
                          <span className="rounded bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">PP</span>
                        )}
                        {!row.sendFlag && !row.ppFlag && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>

                    {/* English Grade */}
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${gcseColour(row.eRaw)}`}>
                        {row.eRaw}
                      </span>
                    </td>

                    {/* Maths Grade */}
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${gcseColour(row.mRaw)}`}>
                        {row.mRaw}
                      </span>
                    </td>

                    {/* Met Threshold */}
                    <td className="px-4 py-3.5 text-center flex items-center justify-center h-14">
                      {row.met ? (
                         <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                         </div>
                      ) : (
                         <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                         </div>
                      )}
                    </td>

                    {/* Overall Average */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-bold text-slate-800">{row.cAvg ?? "—"}</span>
                    </td>

                    {/* Direction of Travel */}
                    <td className="px-4 py-3.5 text-center">
                      {getTrendIcon(row.avgDiff)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
