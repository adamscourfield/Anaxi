import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { buildViewerContext } from "@/lib/viewerContext";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import {
  canViewExplorer,
  canViewAssessmentExplorer,
} from "@/modules/authz";
import { computeAssessmentAnalysis } from "@/modules/analysis/assessmentAnalysis";
import { computeAttainmentBehaviourCorrelation } from "@/modules/analysis/attainmentBehaviourCorrelation";
import { parseWindow } from "@/lib/explorerUtils";

function fmt2(n: number | null): string {
  if (n === null) return "—";
  return (n * 100).toFixed(1) + "%";
}

function valueAddClass(v: number | null): string {
  if (v === null) return "text-muted";
  if (v <= -0.05) return "text-[var(--error)] font-semibold";
  if (v >= 0.05) return "text-[var(--pill-success-text)] font-semibold";
  return "text-text";
}

export default async function AssessmentHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const viewerContext = await buildViewerContext(user);

  if (!canViewExplorer(viewerContext) || !canViewAssessmentExplorer(viewerContext)) notFound();

  const windowDays = parseWindow(
    Array.isArray(params.windowDays) ? params.windowDays[0] : params.windowDays,
  );
  const cycleId = Array.isArray(params.cycle) ? params.cycle[0] : params.cycle;

  const [assessment, correlation] = await Promise.all([
    computeAssessmentAnalysis(user.tenantId, cycleId ? { cycleId } : undefined),
    computeAttainmentBehaviourCorrelation(user.tenantId, windowDays),
  ]);

  // ─── KPI derivations ───────────────────────────────────────────────────────

  const totalStudentsTracked = assessment.students.length;
  const studentsWithDecline = assessment.students.filter((s) =>
    s.subjects.some((sub) => sub.movement !== null && sub.movement < -0.02),
  ).length;

  const teachersWithConcern = assessment.teachers.filter(
    (t) => t.overallValueAdd !== null && t.overallValueAdd < -0.05,
  ).length;
  const totalTeachersTracked = assessment.teachers.length;

  // Student counts for display
  const sendStudents = assessment.students.filter((s) => s.sendFlag);
  const nonSendStudents = assessment.students.filter((s) => !s.sendFlag);
  const ppStudents = assessment.students.filter((s) => s.ppFlag);
  const nonPpStudents = assessment.students.filter((s) => !s.ppFlag);

  // Use cohort-based gap aggregation — consistent with the cohorts page and AI briefing
  const cohortsWithSendGap = assessment.cohorts.filter((c) => c.sendGap !== null);
  const sendGap =
    cohortsWithSendGap.length > 0
      ? cohortsWithSendGap.reduce((s, c) => s + c.sendGap!, 0) / cohortsWithSendGap.length
      : null;

  const cohortsWithPpGap = assessment.cohorts.filter((c) => c.ppGap !== null);
  const ppGap =
    cohortsWithPpGap.length > 0
      ? cohortsWithPpGap.reduce((s, c) => s + c.ppGap!, 0) / cohortsWithPpGap.length
      : null;

  const activeCycle = cycleId
    ? assessment.cycles.find((c) => c.cycleId === cycleId)
    : assessment.cycles[0];

  // Top value-add concern teachers (sorted ascending by valueAdd)
  const concernTeachers = assessment.teachers
    .filter((t) => t.overallValueAdd !== null && t.overallValueAdd < -0.05)
    .sort((a, b) => (a.overallValueAdd ?? 0) - (b.overallValueAdd ?? 0))
    .slice(0, 5);

  // Top declining students
  const decliningStudents = assessment.students
    .filter((s) => s.subjects.some((sub) => sub.movement !== null && sub.movement < -0.08))
    .sort((a, b) => {
      const worstA = Math.min(...a.subjects.map((sub) => sub.movement ?? 0));
      const worstB = Math.min(...b.subjects.map((sub) => sub.movement ?? 0));
      return worstA - worstB;
    })
    .slice(0, 5);

  // Strongest correlations
  const strongCorrelations = correlation.schoolWide
    .filter((r) => Math.abs(r.correlation) >= 0.3 && r.confidence === "HIGH")
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .slice(0, 4);

  const computedAtStr = assessment.computedAt.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  function windowUrl(w: number): string {
    const qs = new URLSearchParams({
      windowDays: String(w),
      ...(cycleId ? { cycle: cycleId } : {}),
    });
    return `/explorer/assessment?${qs}`;
  }

  function cycleUrl(cId: string): string {
    const qs = new URLSearchParams({ windowDays: String(windowDays), cycle: cId });
    return `/explorer/assessment?${qs}`;
  }

  return (
    <div className="space-y-8">
      <ExplorerBackLink />

      <PageHeader
        variant="ledger"
        eyebrow="Explorer"
        title="Assessment"
        subtitle="Attainment, value-add, group gaps, and cross-domain correlations across all active cycles."
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex flex-wrap items-center gap-2 text-[0.8125rem] leading-snug text-muted">
              <svg className="anx-icon-inline opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <rect x="3" y="5" width="18" height="16" rx="2" strokeLinejoin="round" />
                <path strokeLinecap="round" d="M16 3v4M8 3v4M3 11h18" />
              </svg>
              Updated {computedAtStr}
            </span>
            <div className="flex items-center gap-1">
              {([7, 21, 28, 90] as const).map((w) => (
                <Link
                  key={w}
                  href={windowUrl(w)}
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold calm-transition ${
                    windowDays === w
                      ? "bg-accent text-on-primary"
                      : "text-muted hover:bg-surface-container-low hover:text-text"
                  }`}
                >
                  {w}d
                </Link>
              ))}
            </div>
          </div>
        }
      />

      {/* ── Cycle selector ──────────────────────────────────────────────────── */}
      {assessment.cycles.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Cycle:</span>
          {assessment.cycles.map((c) => (
            <Link
              key={c.cycleId}
              href={cycleUrl(c.cycleId)}
              className={`rounded-md px-3 py-1 text-[12px] font-medium calm-transition ${
                activeCycle?.cycleId === c.cycleId
                  ? "bg-accent text-on-primary"
                  : "border border-border text-muted hover:border-accent hover:text-text"
              }`}
            >
              {c.cycleLabel}
            </Link>
          ))}
        </div>
      )}

      {/* ── KPI cards ────────────────────────────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Students tracked */}
        <Link href={`/explorer/assessment/students?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]">
          <div className="explorer-hub-kpi-card flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#F3F4F6] text-[#9CA3AF]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-7.342m0 0A50.702 50.702 0 0 1 12 13.489m3.741-7.342A50.666 50.666 0 0 1 12 6.147m-7.741 4.342A50.666 50.666 0 0 1 12 6.147" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <p className="explorer-hub-kpi-label">Students tracked</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{totalStudentsTracked}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-[#E5E7EB] pt-3">
              {studentsWithDecline > 0 ? (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--error)]">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--error)]" />
                  {studentsWithDecline} declining
                </p>
              ) : (
                <p className="text-[13px] text-[var(--on-surface-variant)]">No significant decline</p>
              )}
            </div>
          </div>
        </Link>

        {/* Teachers */}
        <Link href={`/explorer/assessment/teachers?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]">
          <div className="explorer-hub-kpi-card flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#F3F4F6] text-[#9CA3AF]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <p className="explorer-hub-kpi-label">Teachers assessed</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[2.5rem] font-bold leading-none tracking-[-0.03em] text-[var(--on-surface)] tabular-nums">{totalTeachersTracked}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-[#E5E7EB] pt-3">
              {teachersWithConcern > 0 ? (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--error)]">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--error)]" />
                  {teachersWithConcern} below value-add threshold
                </p>
              ) : (
                <p className="text-[13px] text-[var(--on-surface-variant)]">All within expected range</p>
              )}
            </div>
          </div>
        </Link>

        {/* SEND gap */}
        <Link href={`/explorer/assessment/cohorts?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]">
          <div className="explorer-hub-kpi-card flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#F3F4F6] text-[#9CA3AF]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <p className="explorer-hub-kpi-label">SEND gap</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-[2.5rem] font-bold leading-none tracking-[-0.03em] tabular-nums ${sendGap !== null && sendGap > 0.1 ? "text-[var(--error)]" : "text-[var(--on-surface)]"}`}>
                  {sendGap !== null ? fmt2(sendGap) : "—"}
                </span>
              </div>
            </div>
            <div className="mt-4 border-t border-[#E5E7EB] pt-3">
              <p className="text-[13px] text-[var(--on-surface-variant)]">
                {sendStudents.length} SEND · {nonSendStudents.length} non-SEND
              </p>
            </div>
          </div>
        </Link>

        {/* PP gap */}
        <Link href={`/explorer/assessment/cohorts?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)]">
          <div className="explorer-hub-kpi-card flex h-full flex-col justify-between p-5 calm-transition sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#F3F4F6] text-[#9CA3AF]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </span>
            </div>
            <div className="mt-4">
              <p className="explorer-hub-kpi-label">PP gap</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-[2.5rem] font-bold leading-none tracking-[-0.03em] tabular-nums ${ppGap !== null && ppGap > 0.1 ? "text-[var(--error)]" : "text-[var(--on-surface)]"}`}>
                  {ppGap !== null ? fmt2(ppGap) : "—"}
                </span>
              </div>
            </div>
            <div className="mt-4 border-t border-[#E5E7EB] pt-3">
              <p className="text-[13px] text-[var(--on-surface-variant)]">
                {ppStudents.length} PP · {nonPpStudents.length} non-PP
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Priorities panel ──────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Value-add concerns */}
        <div className="rounded-2xl border border-border bg-surface-container-low p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Value-add concerns</h2>
            <Link href={`/explorer/assessment/teachers?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}&sort=valueAdd`} className="text-[11px] font-semibold text-accent hover:underline">
              View all →
            </Link>
          </div>
          {concernTeachers.length === 0 ? (
            <p className="text-[13px] text-muted">No teachers below threshold in this cycle.</p>
          ) : (
            <ul className="space-y-3">
              {concernTeachers.map((t) => (
                <li key={t.teacherId} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-text">{t.teacherName}</p>
                    <p className="text-[11px] text-muted">
                      {t.subjects.length} subject{t.subjects.length !== 1 ? "s" : ""}
                      {t.departmentNames.length > 0 && ` · ${t.departmentNames[0]}`}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[13px] tabular-nums ${valueAddClass(t.overallValueAdd)}`}>
                    {t.overallValueAdd !== null ? (t.overallValueAdd >= 0 ? "+" : "") + (t.overallValueAdd * 100).toFixed(1) + "pp" : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Students with rapid decline */}
        <div className="rounded-2xl border border-border bg-surface-container-low p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text">Rapid decline alerts</h2>
            <Link href={`/explorer/assessment/students?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}&movement=DECLINING`} className="text-[11px] font-semibold text-accent hover:underline">
              View all →
            </Link>
          </div>
          {decliningStudents.length === 0 ? (
            <p className="text-[13px] text-muted">No significant progress drops detected.</p>
          ) : (
            <ul className="space-y-3">
              {decliningStudents.map((s) => {
                const decliningSubjects = s.subjects
                  .filter((sub) => sub.movement !== null && sub.movement < -0.08)
                  .map((sub) => sub.subject);
                return (
                  <li key={s.studentId} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-text">{s.studentName}</p>
                        {s.sendFlag && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)]">SEND</span>}
                        {s.ppFlag && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-[var(--cat-violet-bg,#EDE9FE)] text-[var(--cat-violet-text,#5B21B6)]">PP</span>}
                      </div>
                      <p className="text-[11px] text-muted">Yr {s.yearGroup} · {decliningSubjects.join(", ")}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--error)]">
                      ↓ {decliningSubjects.length} subj.
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Attainment–behaviour correlations ────────────────────────────────── */}
      {strongCorrelations.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface-container-low p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text">Attainment–behaviour correlations</h2>
              <p className="mt-0.5 text-[11px] text-muted">{correlation.pairedStudentCount} students with both assessment and behaviour data · {windowDays}d window</p>
            </div>
            <Link href={`/explorer/assessment/cohorts?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}`} className="text-[11px] font-semibold text-accent hover:underline">
              View cohorts →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {strongCorrelations.map((row) => {
              const isPositive = row.correlation > 0;
              const absR = Math.abs(row.correlation);
              const barWidth = Math.min(100, absR * 100);
              return (
                <div key={row.metric} className="rounded-lg border border-border bg-white p-4">
                  <p className="text-[11px] font-semibold text-muted">{row.metricLabel}</p>
                  <p className={`mt-1 text-[1.5rem] font-bold tabular-nums tracking-[-0.03em] ${isPositive ? "text-[var(--pill-success-text)]" : "text-[var(--error)]"}`}>
                    {row.correlation >= 0 ? "+" : ""}{row.correlation.toFixed(2)}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                    <div
                      className={`h-full rounded-full ${isPositive ? "bg-[var(--scale-consistent-bar,#22C55E)]" : "bg-[var(--scale-limited-bar,#EF4444)]"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted">{row.strength.toLowerCase().replace(/_/g, " ")} · {row.sampleSize} pairs</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sub-page navigation ───────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            href: `/explorer/assessment/students?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}`,
            title: "Students",
            desc: "Individual attainment, movement, and cross-subject outliers with SEND/PP flags.",
            icon: (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-7.342" />
            ),
          },
          {
            href: `/explorer/assessment/teachers?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}`,
            title: "Teachers",
            desc: "Value-add scores, group gaps, and subject-level attainment by teacher.",
            icon: (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            ),
          },
          {
            href: `/explorer/assessment/cohorts?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}`,
            title: "Cohorts",
            desc: "Year group × subject grid with prior attainment bands and SEND/PP gaps.",
            icon: (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            ),
          },
        ].map(({ href, title, desc, icon }) => (
          <Link key={href} href={href} className="group flex items-start gap-4 rounded-2xl border border-border bg-white p-5 calm-transition hover:border-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#F3F4F6] text-[#9CA3AF]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">{icon}</svg>
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-text group-hover:text-accent">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-[0.75rem] text-muted">
        Explorer · Assessment · {windowDays}d window · {computedAtStr}
      </p>
    </div>
  );
}
