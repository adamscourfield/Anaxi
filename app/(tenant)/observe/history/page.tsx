import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatPhaseLabel } from "@/modules/observations/phaseLabel";
import { formatYearGroup } from "@/modules/observations/yearGroup";
import { pedagogicalSignalTooltip } from "@/modules/observations/signalTooltip";
import { Avatar } from "@/components/ui/avatar";
import { HistoryFilters } from "./HistoryFilters";

/* ── Signal dot colours by scale level ────────────────────────────────── */
const SIGNAL_DOT_COLOR: Record<string, string> = {
  STRONG:     "bg-[var(--scale-strong-bar)]",
  CONSISTENT: "bg-[var(--scale-consistent-bar)]",
  SOME:       "bg-[var(--scale-some-bar)]",
  LIMITED:    "bg-[var(--scale-limited-bar)]",
};

const SIGNAL_LEGEND = [
  { label: "Strong",     className: "bg-[var(--scale-strong-bar)]" },
  { label: "Consistent", className: "bg-[var(--scale-consistent-bar)]" },
  { label: "Some",       className: "bg-[var(--scale-some-bar)]" },
  { label: "Limited",    className: "bg-[var(--scale-limited-bar)]" },
];

const PHASE_BADGE: Record<string, string> = {
  INSTRUCTION:           "border-[var(--phase-instruction-text)]/30 text-[var(--phase-instruction-text)]",
  GUIDED_PRACTICE:       "border-[var(--phase-guided-text)]/30 text-[var(--phase-guided-text)]",
  INDEPENDENT_PRACTICE:  "border-[var(--phase-independent-text)]/30 text-[var(--phase-independent-text)]",
  UNKNOWN:               "border-border text-muted",
};

/* ── Pagination constants ─────────────────────────────────────────────── */
const PAGE_SIZE = 10;

function formatLongDate(date: Date | string): string {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleDateString("en-GB", { month: "short" })} ${d.getFullYear()}`;
}

export default async function ObservationHistoryPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");

  const teacherId = String(searchParams?.teacherId || "");
  const subject = String(searchParams?.subject || "").trim();
  const yearGroup = String(searchParams?.yearGroup || "").trim();
  const observerId = String(searchParams?.observerId || "");
  const from = String(searchParams?.from || "");
  const to = String(searchParams?.to || "");
  const page = Math.max(1, Number(searchParams?.page || "1"));
  const windowDays = Number(searchParams?.window || "");
  const useWindow = Number.isFinite(windowDays) && windowDays > 0 && !from && !to;
  const windowStart = useWindow ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000) : null;

  const [teachers, observers, hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).user.findMany({ where: { tenantId: user.tenantId, isActive: true }, orderBy: { fullName: "asc" } }),
    (prisma as any).user.findMany({ where: { tenantId: user.tenantId, isActive: true, role: { in: ["LEADER", "SLT", "ADMIN"] } }, orderBy: { fullName: "asc" } }),
    (prisma as any).departmentMembership.findMany({ where: { userId: user.id, isHeadOfDepartment: true } }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);

  const hodDeptMemberships = hodDepartmentIds.length > 0
    ? await (prisma as any).departmentMembership.findMany({
        where: { tenantId: user.tenantId, departmentId: { in: hodDepartmentIds } },
        select: { userId: true },
      })
    : [];

  const hodVisibleUserIds = new Set((hodDeptMemberships as any[]).map((m: any) => m.userId));
  const coachVisibleUserIds = new Set(coacheeUserIds);

  const where: any = {
    tenantId: user.tenantId,
    ...(subject ? { subject } : {}),
    ...(yearGroup ? { yearGroup } : {}),
    ...(observerId ? { observerId } : {}),
    ...((from || to || useWindow)
      ? {
          observedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
            ...(useWindow && windowStart ? { gte: windowStart } : {}),
          },
        }
      : {}),
  };

  let allowedTeacherIds: Set<string> | null = null;

  if (user.role === "TEACHER") {
    where.observedTeacherId = user.id;
    allowedTeacherIds = new Set([user.id]);
  } else if (user.role === "ADMIN" || user.role === "SLT" || user.role === "SUPER_ADMIN") {
    if (teacherId) where.observedTeacherId = teacherId;
  } else {
    allowedTeacherIds = new Set<string>([...Array.from(hodVisibleUserIds), ...Array.from(coachVisibleUserIds)]);
    if (teacherId) {
      where.observedTeacherId = allowedTeacherIds.has(teacherId) ? teacherId : "__NO_MATCH__";
    } else {
      where.observedTeacherId = { in: Array.from(allowedTeacherIds) };
    }
  }

  const visibleTeachers = allowedTeacherIds
    ? (teachers as any[]).filter((t: any) => (allowedTeacherIds as Set<string>).has(t.id))
    : (teachers as any[]);

  const scopedFilterWhere: any = { tenantId: user.tenantId };
  if (user.role === "TEACHER") scopedFilterWhere.observedTeacherId = user.id;
  else if (allowedTeacherIds) scopedFilterWhere.observedTeacherId = { in: Array.from(allowedTeacherIds) };

  const [totalCount, observations, distinctSubjects] = await Promise.all([
    (prisma as any).observation.count({ where }),
    (prisma as any).observation.findMany({
      where,
      include: { observedTeacher: true, observer: true, signals: true },
      orderBy: { observedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    (prisma as any).observation.findMany({ where: scopedFilterWhere, distinct: ["subject"], select: { subject: true }, orderBy: { subject: "asc" } }),
  ]);

  const obsList = observations as any[];
  const totalPages = Math.max(1, Math.ceil((totalCount as number) / PAGE_SIZE));
  const hasFilters = teacherId || subject || yearGroup || observerId || from || to;

  /* Build URL for a specific page, preserving current filters */
  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    if (teacherId) params.set("teacherId", teacherId);
    if (observerId) params.set("observerId", observerId);
    if (subject) params.set("subject", subject);
    if (yearGroup) params.set("yearGroup", yearGroup);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/observe/history${qs ? `?${qs}` : ""}`;
  }

  /* Compute visible page numbers (e.g. 1 2 3 ... 10) */
  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "ellipsis")[] = [];
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  const rangeStart = (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount as number);

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-text">Observation History</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            Secure academic ledger of pedagogical data across all departments.
          </p>
        </div>
        {user.role !== "TEACHER" && (
          <Link
            href="/observe/new"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[0.875rem] font-semibold text-on-primary shadow-sm calm-transition hover:bg-accentHover"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
            </svg>
            New Observation
          </Link>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <HistoryFilters
        teachers={visibleTeachers.map((t: any) => ({ id: t.id, fullName: t.fullName }))}
        observers={(observers as any[]).map((o: any) => ({ id: o.id, fullName: o.fullName }))}
        subjects={(distinctSubjects as { subject: string }[]).map((r) => r.subject)}
        defaults={{ teacherId, observerId, subject, from, to }}
        showTeacherFilters={user.role !== "TEACHER"}
        hasFilters={!!hasFilters}
      />

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {obsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="11" cy="11" r="6.5" /><path d="m16.5 16.5 3 3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[0.875rem] font-semibold text-text">No observations found</p>
          <p className="mt-1 text-[0.8125rem] text-muted">Try widening your filters.</p>
        </div>
      ) : (
        <div className="table-shell">
          {/* Desktop table (≥ md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="px-5 py-3.5">Teacher</th>
                  {user.role !== "TEACHER" && <th className="px-4 py-3.5">Observer</th>}
                  <th className="px-4 py-3.5">Subject / Year</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Phase</th>
                  <th className="px-4 py-3.5">Pedagogical Signals</th>
                </tr>
              </thead>
              <tbody>
                {obsList.map((obs: any) => {
                  const signalValues = (obs.signals as any[]).filter((s: any) => s.valueKey);
                  const phase = obs.phase as string;
                  const phaseBadge = PHASE_BADGE[phase] ?? PHASE_BADGE.UNKNOWN;

                  return (
                    <tr key={obs.id} className="group table-row calm-transition">
                      {/* Teacher */}
                      <td className="px-5 py-4">
                        <Link href={`/observe/${obs.id}`} className="flex items-center gap-3 min-w-0">
                          <Avatar name={obs.observedTeacher?.fullName ?? "?"} size="sm" />
                          <span className="truncate font-semibold text-text group-hover:text-accent calm-transition">
                            {obs.observedTeacher?.fullName ?? "—"}
                          </span>
                        </Link>
                      </td>

                      {/* Observer */}
                      {user.role !== "TEACHER" && (
                        <td className="px-4 py-4 text-muted">
                          {obs.observer?.fullName ?? "—"}
                        </td>
                      )}

                      {/* Subject / Year */}
                      <td className="px-4 py-4">
                        <div className="font-semibold text-text">{obs.subject}</div>
                        <div className="text-[0.75rem] text-muted">{formatYearGroup(obs.yearGroup)}{obs.setGroup ? ` • ${obs.setGroup}` : ""}</div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 tabular-nums text-muted whitespace-nowrap">
                        {formatLongDate(obs.observedAt)}
                      </td>

                      {/* Phase */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] ${phaseBadge}`}>
                          {formatPhaseLabel(phase)}
                        </span>
                      </td>

                      {/* Pedagogical Signals */}
                      <td className="px-4 py-4">
                        {signalValues.length === 0 ? (
                          <span className="text-xs text-muted">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {signalValues.map((s: any, i: number) => (
                              <span
                                key={i}
                                className={`inline-block h-2.5 w-2.5 cursor-help rounded-full ${SIGNAL_DOT_COLOR[s.valueKey] ?? "bg-border"}`}
                                title={pedagogicalSignalTooltip(s.signalKey, s.valueKey)}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list (< md) */}
          <div className="md:hidden divide-y divide-border/20">
            {obsList.map((obs: any) => {
              const signalValues = (obs.signals as any[]).filter((s: any) => s.valueKey);
              const phase = obs.phase as string;
              const phaseBadge = PHASE_BADGE[phase] ?? PHASE_BADGE.UNKNOWN;

              return (
                <Link
                  key={obs.id}
                  href={`/observe/${obs.id}`}
                  className="group block px-4 py-3.5 calm-transition hover:bg-accent/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={obs.observedTeacher?.fullName ?? "?"} size="sm" />
                        <span className="truncate text-[0.875rem] font-semibold text-text">
                          {obs.observedTeacher?.fullName ?? "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
                        <span>{obs.subject} · {formatYearGroup(obs.yearGroup)}</span>
                        <span className="tabular-nums">{formatLongDate(obs.observedAt)}</span>
                        {user.role !== "TEACHER" && obs.observer?.fullName && (
                          <span>by {obs.observer.fullName}</span>
                        )}
                      </div>
                    </div>
                    <svg className="mt-1 h-4 w-4 shrink-0 text-border calm-transition group-hover:text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] ${phaseBadge}`}>
                      {formatPhaseLabel(phase)}
                    </span>
                    {signalValues.length > 0 && (
                      <div className="flex items-center gap-1">
                        {signalValues.map((s: any, i: number) => (
                          <span
                            key={i}
                            className={`inline-block h-2.5 w-2.5 cursor-help rounded-full ${SIGNAL_DOT_COLOR[s.valueKey] ?? "bg-border"}`}
                            title={pedagogicalSignalTooltip(s.signalKey, s.valueKey)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* ── Pagination ───────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/20 px-5 py-3.5">
              <p className="text-[0.8125rem] text-muted">
                Showing <span className="font-semibold text-text">{rangeStart}-{rangeEnd}</span> of <span className="font-semibold text-text">{totalCount}</span> observations found
              </p>
              <div className="flex items-center gap-1">
                {/* Prev */}
                {page > 1 ? (
                  <Link href={pageUrl(page - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                )}
                {/* Pages */}
                {getPageNumbers().map((p, i) =>
                  p === "ellipsis" ? (
                    <span key={`e${i}`} className="inline-flex h-8 w-8 items-center justify-center text-[0.8125rem] text-muted">…</span>
                  ) : p === page ? (
                    <span key={p} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[0.8125rem] font-semibold text-on-primary">
                      {p}
                    </span>
                  ) : (
                    <Link key={p} href={pageUrl(p)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[0.8125rem] text-muted calm-transition hover:bg-surface-container-low hover:text-text">
                      {p}
                    </Link>
                  )
                )}
                {/* Next */}
                {page < totalPages ? (
                  <Link href={pageUrl(page + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-border">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer: Signal Legend + Intelligence Insight ─────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        {/* Signal Legend */}
        <div className="rounded-2xl bg-surface-container-lowest px-5 py-4">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Signal Legend</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            {SIGNAL_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.className}`} />
                <span className="text-[0.75rem] text-text">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligence Insight */}
        <div className="relative overflow-hidden rounded-2xl bg-[#e8f4f8] px-6 py-5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Intelligence Insight</p>
          <p className="mt-2 text-[0.9375rem] font-semibold text-text">
            Observations are up 12% this quarter.
          </p>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            Focus remains on &quot;Checking for Understanding&quot; across STEM departments.
          </p>
          {/* Decorative sparkle icons */}
          <svg className="absolute right-4 bottom-3 h-12 w-12 text-[#c4dfe6] opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74L12 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg className="absolute right-14 bottom-8 h-6 w-6 text-[#c4dfe6] opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2l2.09 6.26L20.18 10l-6.09 1.74L12 18l-2.09-6.26L3.82 10l6.09-1.74L12 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
