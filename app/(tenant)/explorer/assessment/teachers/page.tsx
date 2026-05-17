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
  canExportExplorer,
} from "@/modules/authz";
import { computeAssessmentAnalysis } from "@/modules/analysis/assessmentAnalysis";
import { parseWindow } from "@/lib/explorerUtils";

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const PER_PAGE = 20;

function fmt(n: number | null): string {
  if (n === null) return "—";
  return (n * 100).toFixed(1) + "%";
}

function valueAddStr(v: number | null): string {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "pp";
}

function valueAddCellClass(v: number | null): string {
  if (v === null) return "text-muted";
  if (v <= -0.1) return "bg-[color-mix(in_srgb,var(--scale-limited-light,#FEE2E2)_40%,transparent)] font-semibold text-[var(--error)]";
  if (v <= -0.05) return "bg-[color-mix(in_srgb,var(--scale-limited-light,#FEE2E2)_20%,transparent)] text-[var(--error)]";
  if (v >= 0.05) return "text-[var(--pill-success-text)] font-semibold";
  return "text-text";
}

function gapClass(gap: number | null): string {
  if (gap === null) return "text-muted";
  if (gap > 0.15) return "text-[var(--error)] font-semibold";
  if (gap > 0.08) return "text-[var(--error)]";
  return "text-muted";
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

/* ─── Components ────────────────────────────────────────────────────────────── */

function SortLink({
  label,
  field,
  current,
  getUrl,
}: {
  label: string;
  field: string;
  current: string;
  getUrl: (f: string) => string;
}) {
  const active = current === field;
  return (
    <Link
      href={getUrl(field)}
      className={`text-[11px] font-semibold ${active ? "text-accent underline underline-offset-2" : "text-muted hover:text-text"}`}
    >
      {label} {active ? "↓" : ""}
    </Link>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default async function AssessmentTeachersPage({
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
  const search = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  const sortParam = (Array.isArray(params.sort) ? params.sort[0] : params.sort) ?? "valueAdd";
  const currentPage = Math.max(1, Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1);

  const assessment = await computeAssessmentAnalysis(
    user.tenantId,
    cycleId ? { cycleId } : undefined,
  );

  const showExport = canExportExplorer(viewerContext);

  // ── Filter & sort ───────────────────────────────────────────────────────────

  let rows = assessment.teachers;
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => r.teacherName.toLowerCase().includes(q));
  }

  rows = [...rows].sort((a, b) => {
    switch (sortParam) {
      case "valueAdd":
        return (a.overallValueAdd ?? 0) - (b.overallValueAdd ?? 0); // worst first
      case "mean":
        return (b.overallMean ?? 0) - (a.overallMean ?? 0);
      case "name":
        return a.teacherName.localeCompare(b.teacherName);
      default:
        return (a.overallValueAdd ?? 0) - (b.overallValueAdd ?? 0);
    }
  });

  // ── Pagination ──────────────────────────────────────────────────────────────

  const totalFiltered = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PER_PAGE;
  const pageRows = rows.slice(pageStart, pageStart + PER_PAGE);

  function pageUrl(p: number): string {
    const merged: Record<string, string> = {
      windowDays: String(windowDays),
      ...(cycleId ? { cycle: cycleId } : {}),
      ...(search ? { q: search } : {}),
      sort: sortParam,
      ...(p > 1 ? { page: String(p) } : {}),
    };
    return `/explorer/assessment/teachers?${new URLSearchParams(merged)}`;
  }

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const withConcern = assessment.teachers.filter(
    (t) => t.overallValueAdd !== null && t.overallValueAdd < -0.05,
  ).length;
  const withPositive = assessment.teachers.filter(
    (t) => t.overallValueAdd !== null && t.overallValueAdd >= 0.05,
  ).length;
  const avgValueAdd =
    assessment.teachers.filter((t) => t.overallValueAdd !== null).length > 0
      ? assessment.teachers
          .filter((t) => t.overallValueAdd !== null)
          .reduce((s, t) => s + t.overallValueAdd!, 0) /
        assessment.teachers.filter((t) => t.overallValueAdd !== null).length
      : null;

  const computedAtStr = assessment.computedAt.toLocaleDateString("en-GB");

  function sortUrl(s: string): string {
    const qs = new URLSearchParams({
      windowDays: String(windowDays),
      ...(cycleId ? { cycle: cycleId } : {}),
      ...(search ? { q: search } : {}),
      sort: s,
    });
    return `/explorer/assessment/teachers?${qs}`;
  }

  return (
    <div className="space-y-8">
      <ExplorerBackLink />

      <PageHeader
        variant="ledger"
        eyebrow="Explorer · Assessment"
        title="Teachers"
        subtitle="Value-add, subject-level attainment, and SEND/PP group gaps per teacher."
        actions={
          showExport ? (
            <form action="/api/explorer/export" method="POST" className="inline">
              <input type="hidden" name="view" value="ASSESSMENT_TEACHERS" />
              <input type="hidden" name="windowDays" value={String(windowDays)} />
              {cycleId && <input type="hidden" name="cycle" value={cycleId} />}
              <button type="submit" className="anx-btn-pill-ghost calm-transition font-semibold">
                <svg className="anx-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
                </svg>
                Export CSV
              </button>
            </form>
          ) : undefined
        }
      />

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div className="explorer-kpi-tile rounded-2xl p-6">
        <div className="grid gap-6 sm:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)]">
          <div className="lg:pr-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Teachers tracked</p>
            <p className="mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] text-text">{assessment.teachers.length}</p>
          </div>
          <div className="lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Below threshold</p>
            <p className="mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] text-[var(--error)]">{withConcern}</p>
            <p className="text-[11px] text-muted">value-add &lt; −5pp</p>
          </div>
          <div className="lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Above threshold</p>
            <p className="mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] text-[var(--pill-success-text)]">{withPositive}</p>
            <p className="text-[11px] text-muted">value-add ≥ +5pp</p>
          </div>
          <div className="lg:pl-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">School avg value-add</p>
            <p className={`mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] ${avgValueAdd !== null && avgValueAdd < -0.02 ? "text-[var(--error)]" : "text-text"}`}>
              {valueAddStr(avgValueAdd)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Search + sort ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form method="GET" className="flex items-center gap-2">
          <input type="hidden" name="windowDays" value={String(windowDays)} />
          {cycleId && <input type="hidden" name="cycle" value={cycleId} />}
          <input type="hidden" name="sort" value={sortParam} />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search teacher…"
            className="h-9 min-w-[180px] rounded-lg border border-border bg-white px-3 text-[13px] text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button type="submit" className="h-9 rounded-lg bg-accent px-4 text-[13px] font-semibold text-on-primary calm-transition hover:opacity-90">
            Search
          </button>
        </form>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span>Sort:</span>
          <SortLink label="Value-add" field="valueAdd" current={sortParam} getUrl={sortUrl} />
          <SortLink label="Mean" field="mean" current={sortParam} getUrl={sortUrl} />
          <SortLink label="Name" field="name" current={sortParam} getUrl={sortUrl} />
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <p className="text-[0.875rem] font-semibold text-text">
            {assessment.teachers.length === 0 ? "No teacher data available" : "No matches"}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {assessment.teachers.length === 0
              ? "Ensure student–teacher assignments are set up."
              : "Try adjusting your search."}
          </p>
        </div>
      ) : (
        <div className="table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="px-5 py-3">Teacher</th>
                  <th className="px-4 py-3">Dept</th>
                  <th className="px-4 py-3">Subjects</th>
                  <th className="px-4 py-3">Overall mean</th>
                  <th className="px-4 py-3">Value-add</th>
                  <th className="px-4 py-3">SEND gap</th>
                  <th className="px-4 py-3">PP gap</th>
                  <th className="px-4 py-3">Students</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const totalStudents = row.subjects.reduce((s, sub) => s + sub.studentCount, 0);
                  const avgSendGap = row.subjects.filter((s) => s.sendGap !== null).reduce((s, sub) => s + (sub.sendGap ?? 0), 0) /
                    Math.max(1, row.subjects.filter((s) => s.sendGap !== null).length);
                  const avgPpGap = row.subjects.filter((s) => s.ppGap !== null).reduce((s, sub) => s + (sub.ppGap ?? 0), 0) /
                    Math.max(1, row.subjects.filter((s) => s.ppGap !== null).length);
                  const hasSendData = row.subjects.some((s) => s.sendGap !== null);
                  const hasPpData = row.subjects.some((s) => s.ppGap !== null);

                  return (
                    <tr key={row.teacherId} className={`group table-row calm-transition ${row.overallValueAdd !== null && row.overallValueAdd <= -0.05 ? "bg-[color-mix(in_srgb,var(--scale-limited-light,#FEE2E2)_8%,transparent)]" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                            {getInitials(row.teacherName)}
                          </div>
                          <span className="font-medium text-text">{row.teacherName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-muted">
                        {row.departmentNames.length > 0 ? row.departmentNames.slice(0, 2).join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-muted">
                        {row.subjects.length > 0
                          ? Array.from(new Set(row.subjects.map((s) => s.subject))).slice(0, 3).join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums font-semibold text-text">
                        {fmt(row.overallMean)}
                      </td>
                      <td className={`px-4 py-3.5 tabular-nums ${valueAddCellClass(row.overallValueAdd)}`}>
                        {valueAddStr(row.overallValueAdd)}
                      </td>
                      <td className={`px-4 py-3.5 tabular-nums text-[12px] ${gapClass(hasSendData ? avgSendGap : null)}`}>
                        {hasSendData ? fmt(avgSendGap) : "—"}
                      </td>
                      <td className={`px-4 py-3.5 tabular-nums text-[12px] ${gapClass(hasPpData ? avgPpGap : null)}`}>
                        {hasPpData ? fmt(avgPpGap) : "—"}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-muted">{totalStudents}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Subject drilldown for teachers with concerns on this page */}
          {pageRows.filter((r) => r.overallValueAdd !== null && r.overallValueAdd < -0.05).length > 0 && (
            <div className="border-t border-border/20 p-5">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Subject breakdown — below threshold</p>
              <div className="space-y-5">
                {pageRows
                  .filter((r) => r.overallValueAdd !== null && r.overallValueAdd < -0.05)
                  .map((row) => (
                    <div key={row.teacherId}>
                      <p className="mb-2 text-[12px] font-semibold text-text">{row.teacherName}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-muted">
                              <th className="pb-1.5 pr-4 font-medium">Subject</th>
                              <th className="pb-1.5 pr-4 font-medium">Year</th>
                              <th className="pb-1.5 pr-4 font-medium">Mean</th>
                              <th className="pb-1.5 pr-4 font-medium">Value-add</th>
                              <th className="pb-1.5 pr-4 font-medium">SEND gap</th>
                              <th className="pb-1.5 pr-4 font-medium">PP gap</th>
                              <th className="pb-1.5 font-medium">↓/→/↑</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.subjects.map((sub) => (
                              <tr key={`${sub.subject}-${sub.yearGroup}`} className="border-t border-border/10">
                                <td className="py-1.5 pr-4 font-medium text-text">{sub.subject}</td>
                                <td className="py-1.5 pr-4 text-muted">{sub.yearGroup}</td>
                                <td className="py-1.5 pr-4 tabular-nums">{fmt(sub.meanNormalizedScore)}</td>
                                <td className={`py-1.5 pr-4 tabular-nums ${valueAddCellClass(sub.valueAdd)}`}>{valueAddStr(sub.valueAdd)}</td>
                                <td className={`py-1.5 pr-4 tabular-nums ${gapClass(sub.sendGap)}`}>{sub.sendGap !== null ? fmt(sub.sendGap) : "—"}</td>
                                <td className={`py-1.5 pr-4 tabular-nums ${gapClass(sub.ppGap)}`}>{sub.ppGap !== null ? fmt(sub.ppGap) : "—"}</td>
                                <td className="py-1.5 tabular-nums text-muted">{sub.decliningCount}/{sub.stableCount}/{sub.improvingCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/20 px-5 py-3.5">
            <p className="text-[0.8125rem] text-muted">
              Showing <span className="font-semibold text-text">{pageStart + 1}–{Math.min(pageStart + PER_PAGE, totalFiltered)}</span> of{" "}
              <span className="font-semibold text-text">{totalFiltered}</span> teachers
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {safePage > 1 && (
                  <Link href={pageUrl(safePage - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text" aria-label="Previous">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                )}
                {(() => {
                  const half = 3;
                  const winStart = Math.max(1, Math.min(safePage - half, totalPages - 6));
                  const winEnd = Math.min(totalPages, winStart + 6);
                  return Array.from({ length: winEnd - winStart + 1 }, (_, i) => winStart + i);
                })().map((p) => (
                  p === safePage ? (
                    <span key={p} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[0.8125rem] font-semibold text-on-primary">{p}</span>
                  ) : (
                    <Link key={p} href={pageUrl(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[0.8125rem] text-muted calm-transition hover:bg-surface-container-low hover:text-text">{p}</Link>
                  )
                ))}
                {safePage < totalPages && (
                  <Link href={pageUrl(safePage + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text" aria-label="Next">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-[0.75rem] text-muted">
        Explorer · Assessment · Teachers · Updated {computedAtStr}
      </p>
    </div>
  );
}
