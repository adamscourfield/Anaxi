import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import {
  canViewExplorer,
  canViewAssessmentExplorer,
  canExportExplorer,
} from "@/modules/authz";
import {
  computeAssessmentAnalysis,
  type AssessmentStudentRow,
  type MovementLabel,
} from "@/modules/analysis/assessmentAnalysis";
import { parseWindow } from "@/lib/explorerUtils";

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const PER_PAGE = 20;

function fmt(n: number | null): string {
  if (n === null) return "—";
  return (n * 100).toFixed(1) + "%";
}

function movementLabel(m: MovementLabel): { label: string; cls: string } {
  switch (m) {
    case "IMPROVING": return { label: "↑ Improving", cls: "text-[var(--pill-success-text)]" };
    case "DECLINING": return { label: "↓ Declining", cls: "text-[var(--error)]" };
    case "STABLE": return { label: "→ Stable", cls: "text-muted" };
    case "NO_PRIOR": return { label: "No prior", cls: "text-muted" };
  }
}

function overallMovementLabel(row: AssessmentStudentRow): MovementLabel {
  const movements = row.subjects.map((s) => s.movement).filter((m): m is number => m !== null);
  if (movements.length === 0) return "NO_PRIOR";
  const avg = movements.reduce((a, b) => a + b, 0) / movements.length;
  if (avg > 0.02) return "IMPROVING";
  if (avg < -0.02) return "DECLINING";
  return "STABLE";
}

function priorBandPill(band: string): string {
  switch (band) {
    case "HIGH": return "bg-[var(--pill-success-bg)] text-[var(--pill-success-text)]";
    case "MID": return "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)]";
    case "LOW": return "bg-[var(--pill-error-bg)] text-[var(--pill-error-text)]";
    default: return "bg-surface-container-high text-muted";
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default async function AssessmentStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);
  const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

  if (!canViewExplorer(viewerContext) || !canViewAssessmentExplorer(viewerContext)) notFound();

  const windowDays = parseWindow(
    Array.isArray(params.windowDays) ? params.windowDays[0] : params.windowDays,
  );
  const cycleId = Array.isArray(params.cycle) ? params.cycle[0] : params.cycle;
  const search = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";
  const yearGroupFilter = (Array.isArray(params.yearGroup) ? params.yearGroup[0] : params.yearGroup) ?? "";
  const movementFilter = (Array.isArray(params.movement) ? params.movement[0] : params.movement) ?? "";
  const sendFilter = (Array.isArray(params.send) ? params.send[0] : params.send) ?? "";
  const ppFilter = (Array.isArray(params.pp) ? params.pp[0] : params.pp) ?? "";
  const currentPage = Math.max(1, Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1);

  const assessment = await computeAssessmentAnalysis(
    user.tenantId,
    cycleId ? { cycleId } : undefined,
  );

  const showExport = canExportExplorer(viewerContext);

  // ── Apply filters ───────────────────────────────────────────────────────────

  let rows = assessment.students;

  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((r) => r.studentName.toLowerCase().includes(q));
  }
  if (yearGroupFilter) {
    rows = rows.filter((r) => r.yearGroup === yearGroupFilter);
  }
  if (movementFilter) {
    rows = rows.filter((r) => overallMovementLabel(r) === movementFilter);
  }
  if (sendFilter === "1") {
    rows = rows.filter((r) => r.sendFlag);
  }
  if (ppFilter === "1") {
    rows = rows.filter((r) => r.ppFlag);
  }

  // Sort: declining first (by worst movement), then by overall mean descending
  rows = [...rows].sort((a, b) => {
    const movA = a.subjects.map((s) => s.movement ?? 0);
    const movB = b.subjects.map((s) => s.movement ?? 0);
    const worstA = movA.length > 0 ? Math.min(...movA) : 0;
    const worstB = movB.length > 0 ? Math.min(...movB) : 0;
    if (Math.abs(worstA - worstB) > 0.001) return worstA - worstB;
    return (b.overallMean ?? 0) - (a.overallMean ?? 0);
  });

  const yearGroups = Array.from(
    new Set(assessment.students.map((r) => r.yearGroup).filter(Boolean)),
  ).sort() as string[];

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
      ...(yearGroupFilter ? { yearGroup: yearGroupFilter } : {}),
      ...(movementFilter ? { movement: movementFilter } : {}),
      ...(sendFilter ? { send: sendFilter } : {}),
      ...(ppFilter ? { pp: ppFilter } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    };
    return `/explorer/assessment/students?${new URLSearchParams(merged)}`;
  }

  const computedAtStr = assessment.computedAt.toLocaleDateString("en-GB");

  return (
    <div className="space-y-8">
      <ExplorerBackLink />

      <PageHeader
        variant="ledger"
        eyebrow="Explorer · Assessment"
        title="Students"
        subtitle="Attainment, movement from prior, and cross-subject outliers for every tracked student."
        actions={
          showExport ? (
            <form action="/api/explorer/export" method="POST" className="inline">
              <input type="hidden" name="view" value="ASSESSMENT_STUDENTS" />
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Tracked</p>
            <p className="mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] text-text">{assessment.students.length}</p>
          </div>
          <div className="lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Declining</p>
            <p className="mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] text-[var(--error)]">
              {assessment.students.filter((s) => overallMovementLabel(s) === "DECLINING").length}
            </p>
          </div>
          <div className="lg:px-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">With outliers</p>
            <p className="mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] text-text">
              {assessment.students.filter((s) => s.outliers.length > 0).length}
            </p>
          </div>
          <div className="lg:pl-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">SEND declining</p>
            <p className="mt-1 text-[2.25rem] font-bold tabular-nums tracking-[-0.03em] text-text">
              {assessment.students.filter((s) => s.sendFlag && overallMovementLabel(s) === "DECLINING").length}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <form method="GET" className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="windowDays" value={String(windowDays)} />
        {cycleId && <input type="hidden" name="cycle" value={cycleId} />}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search student…"
          className="h-9 min-w-[160px] rounded-lg border border-border bg-white px-3 text-[13px] text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <select name="yearGroup" defaultValue={yearGroupFilter} className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-accent/40">
          <option value="">All year groups</option>
          {yearGroups.map((yg) => <option key={yg} value={yg}>{yg}</option>)}
        </select>
        <select name="movement" defaultValue={movementFilter} className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] text-text focus:outline-none focus:ring-2 focus:ring-accent/40">
          <option value="">All movement</option>
          <option value="DECLINING">Declining</option>
          <option value="STABLE">Stable</option>
          <option value="IMPROVING">Improving</option>
          <option value="NO_PRIOR">No prior</option>
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" name="send" value="1" defaultChecked={sendFilter === "1"} className="rounded" />
          SEND only
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          <input type="checkbox" name="pp" value="1" defaultChecked={ppFilter === "1"} className="rounded" />
          PP only
        </label>
        <button type="submit" className="h-9 rounded-lg bg-accent px-4 text-[13px] font-semibold text-on-primary calm-transition hover:opacity-90">
          Filter
        </button>
        {(search || yearGroupFilter || movementFilter || sendFilter || ppFilter) && (
          <Link href={`/explorer/assessment/students?windowDays=${windowDays}${cycleId ? `&cycle=${cycleId}` : ""}`} className="text-[12px] text-muted hover:text-text">
            Clear filters
          </Link>
        )}
      </form>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {pageRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <p className="text-[0.875rem] font-semibold text-text">
            {assessment.students.length === 0 ? "No assessment data available" : "No matches"}
          </p>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {assessment.students.length === 0 ? "Ensure assessment cycles have published results." : "Try adjusting your filters."}
          </p>
        </div>
      ) : (
        <div className="table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="px-5 py-3">Student</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3">Prior band</th>
                  <th className="px-4 py-3">Overall mean</th>
                  <th className="px-4 py-3">Movement</th>
                  <th className="px-4 py-3">Subjects</th>
                  <th className="px-4 py-3">Outliers</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const mvLabel = overallMovementLabel(row);
                  const mv = movementLabel(mvLabel);
                  const uniqueSubjects = Array.from(new Set(row.subjects.map((s) => s.subject)));
                  const hasOutliers = row.outliers.length > 0;
                  const underOutliers = row.outliers.filter((o) => o.direction === "UNDER");

                  return (
                    <tr key={row.studentId} className={`group table-row calm-transition ${mvLabel === "DECLINING" ? "bg-[color-mix(in_srgb,var(--scale-limited-light,#FEE2E2)_12%,transparent)]" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                            {getInitials(row.studentName)}
                          </div>
                          <span className="font-medium text-text">{row.studentName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted">{row.yearGroup ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1">
                          {row.sendFlag && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)]">SEND</span>}
                          {row.ppFlag && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[color-mix(in_srgb,#8B5CF6_15%,transparent)] text-[#6D28D9]">PP</span>}
                          {!row.sendFlag && !row.ppFlag && <span className="text-xs text-muted">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${priorBandPill(row.priorBand)}`}>
                          {row.priorBand === "UNKNOWN" ? "—" : row.priorBand}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums font-semibold text-text">
                        {fmt(row.overallMean)}
                      </td>
                      <td className={`px-4 py-3.5 text-[12px] font-medium ${mv.cls}`}>
                        {mv.label}
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-muted">
                        {uniqueSubjects.length > 0
                          ? uniqueSubjects.slice(0, 3).join(", ") + (uniqueSubjects.length > 3 ? ` +${uniqueSubjects.length - 3}` : "")
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {hasOutliers ? (
                          <div className="flex flex-wrap gap-1">
                            {underOutliers.map((o) => (
                              <span key={o.subject} title={`z=${o.zScore.toFixed(2)}`} className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[var(--pill-error-bg)] text-[var(--pill-error-text)]">
                                ↓ {o.subject}
                              </span>
                            ))}
                            {row.outliers
                              .filter((o) => o.direction === "OVER")
                              .map((o) => (
                                <span key={o.subject} title={`z=${o.zScore.toFixed(2)}`} className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-[var(--pill-success-bg)] text-[var(--pill-success-text)]">
                                  ↑ {o.subject}
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/20 px-5 py-3.5">
            <p className="text-[0.8125rem] text-muted">
              Showing <span className="font-semibold text-text">{pageStart + 1}–{Math.min(pageStart + PER_PAGE, totalFiltered)}</span> of{" "}
              <span className="font-semibold text-text">{totalFiltered}</span> students
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
        Explorer · Assessment · Students · Updated {computedAtStr}
      </p>
    </div>
  );
}
