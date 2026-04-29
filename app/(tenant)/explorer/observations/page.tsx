import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canViewExplorer, canExportExplorer } from "@/modules/authz";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorerBackLink } from "@/components/explorer/explorer-chrome";
import { Avatar } from "@/components/ui/avatar";
import { formatPhaseLabel, phaseVariant } from "@/modules/observations/phaseLabel";
import { StatusPill } from "@/components/ui/status-pill";

/* ─── Constants ────────────────────────────────────────────────────────────── */

const VALID_WINDOWS = [7, 21, 28] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

function isValidWindow(v: unknown): v is WindowDays {
  return VALID_WINDOWS.includes(Number(v) as WindowDays);
}

function formatShortDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default async function ExplorerObservationsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  // Build viewer context
  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);
  const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

  if (!canViewExplorer(viewerContext)) notFound();

  const showExport = canExportExplorer(viewerContext);

  // ─── Parse search params ──────────────────────────────────────────────────
  const rawWindow = typeof searchParams?.windowDays === "string" ? searchParams.windowDays : "21";
  const windowDays: WindowDays = isValidWindow(rawWindow) ? (Number(rawWindow) as WindowDays) : 21;

  const departmentId =
    typeof searchParams?.departmentId === "string" ? searchParams.departmentId : "";
  const teacherMembershipId =
    typeof searchParams?.teacherMembershipId === "string" ? searchParams.teacherMembershipId : "";
  const yearGroup =
    typeof searchParams?.yearGroup === "string" ? searchParams.yearGroup.trim() : "";
  const subject =
    typeof searchParams?.subject === "string" ? searchParams.subject.trim() : "";

  // ─── HOD scoping ──────────────────────────────────────────────────────────
  let hodScopedTeacherIds: string[] | null = null;

  if (user.role === "HOD" && hodDepartmentIds.length > 0) {
    const deptMembers = await (prisma as any).departmentMembership.findMany({
      where: { tenantId: user.tenantId, departmentId: { in: hodDepartmentIds } },
      select: { userId: true },
    });
    hodScopedTeacherIds = (deptMembers as any[]).map((m: any) => m.userId);
  }

  // ─── Build observation query ──────────────────────────────────────────────
  const obsWhere: any = { tenantId: user.tenantId };

  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  obsWhere.observedAt = { gte: windowStart };

  if (hodScopedTeacherIds) {
    obsWhere.observedTeacherId = { in: hodScopedTeacherIds };
  }

  if (departmentId) {
    const deptMembers = await (prisma as any).departmentMembership.findMany({
      where: { tenantId: user.tenantId, departmentId },
      select: { userId: true },
    });
    const deptUserIds = (deptMembers as any[]).map((m: any) => m.userId);
    if (hodScopedTeacherIds) {
      const intersection = deptUserIds.filter((id: string) => hodScopedTeacherIds!.includes(id));
      obsWhere.observedTeacherId = { in: intersection };
    } else {
      obsWhere.observedTeacherId = { in: deptUserIds };
    }
  }

  if (teacherMembershipId) {
    obsWhere.observedTeacherId = teacherMembershipId;
  }

  if (yearGroup) {
    obsWhere.yearGroup = yearGroup;
  }

  if (subject) {
    obsWhere.subject = { contains: subject, mode: "insensitive" };
  }

  const teacherRoleFilter = ["TEACHER", "LEADER", "HOD", "SLT"] as const;

  // ─── Fetch data ───────────────────────────────────────────────────────────
  const [observations, departments, teachersForFilter] = await Promise.all([
    (prisma as any).observation.findMany({
      where: obsWhere,
      include: {
        observedTeacher: { select: { fullName: true } },
        observer: { select: { fullName: true } },
        signals: { select: { signalKey: true, valueKey: true, notObserved: true } },
      },
      orderBy: { observedAt: "desc" },
      take: 200,
    }),
    (prisma as any).department.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
    }),
    (prisma as any).user.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        role: { in: [...teacherRoleFilter] },
        ...(hodScopedTeacherIds ? { id: { in: hodScopedTeacherIds } } : {}),
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 500,
    }),
  ]);

  const obsList = observations as any[];

  const hasFilters = departmentId || teacherMembershipId || yearGroup || subject;

  function buildObservationsUrl(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string> = {
      windowDays: String(windowDays),
      ...(departmentId ? { departmentId } : {}),
      ...(teacherMembershipId ? { teacherMembershipId } : {}),
      ...(yearGroup ? { yearGroup } : {}),
      ...(subject ? { subject } : {}),
      ...Object.fromEntries(
        Object.entries(overrides).filter((e): e is [string, string] => e[1] !== undefined),
      ),
    };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete merged[k];
    }
    const qs = new URLSearchParams(merged).toString();
    return `/explorer/observations${qs ? `?${qs}` : ""}`;
  }

  const fieldSurface = "field field-filter-trigger !py-2.5 !text-[0.8125rem]";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <ExplorerBackLink />

      <PageHeader
        eyebrow="Explorer"
        title="Observations"
        subtitle="Recent classroom observations with signal coverage details."
        actions={
          showExport ? (
            <form action="/api/explorer/export" method="POST" className="shrink-0">
              <input type="hidden" name="view" value="INSTRUCTION_LIST" />
              <input type="hidden" name="windowDays" value={String(windowDays)} />
              {departmentId ? <input type="hidden" name="departmentId" value={departmentId} /> : null}
              {teacherMembershipId ? (
                <input type="hidden" name="teacherMembershipId" value={teacherMembershipId} />
              ) : null}
              {yearGroup ? <input type="hidden" name="yearGroup" value={yearGroup} /> : null}
              {subject ? <input type="hidden" name="subject" value={subject} /> : null}
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[0.8125rem] font-semibold text-on-primary calm-transition hover:bg-primary-container"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Export CSV
              </button>
            </form>
          ) : undefined
        }
      />

      {/* ── Filters (aligned with Signals / Students explorer) ─────────────── */}
      <div className="filter-panel">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4">
          <div className="flex min-w-0 flex-col gap-1.5 lg:min-w-[220px] lg:flex-none">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
              Time window
            </span>
            <div className="filter-period-toggle w-fit max-w-full">
              {VALID_WINDOWS.map((w) => (
                <Link
                  key={w}
                  href={buildObservationsUrl({ windowDays: String(w) })}
                  className={`filter-period-btn ${w === windowDays ? "filter-period-btn-active" : ""}`}
                >
                  {w}D
                </Link>
              ))}
            </div>
          </div>

          <form
            id="observations-explorer-filters"
            method="get"
            action="/explorer/observations"
            className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <input type="hidden" name="windowDays" value={String(windowDays)} />

            <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[200px] lg:max-w-[min(100%,280px)]">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Department
              </span>
              <select
                name="departmentId"
                defaultValue={departmentId}
                className={fieldSurface}
              >
                <option value="">All departments</option>
                {(departments as any[]).map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[200px] lg:max-w-[min(100%,280px)]">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Teacher
              </span>
              <select
                name="teacherMembershipId"
                defaultValue={teacherMembershipId}
                className={fieldSurface}
              >
                <option value="">All teachers</option>
                {(teachersForFilter as { id: string; fullName: string }[]).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[140px] lg:max-w-[min(100%,200px)]">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Year group
              </span>
              <input
                name="yearGroup"
                type="text"
                defaultValue={yearGroup}
                placeholder="e.g. 10"
                className={fieldSurface}
              />
            </label>

            <label className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[160px] lg:max-w-[min(100%,240px)]">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                Subject
              </span>
              <input
                name="subject"
                type="text"
                defaultValue={subject}
                placeholder="e.g. Maths"
                className={fieldSurface}
              />
            </label>
          </form>

          <div className="filter-actions">
            <button
              type="submit"
              form="observations-explorer-filters"
              className="btn-filter-primary"
            >
              Apply Filters
            </button>
            {hasFilters && (
              <Link
                href={`/explorer/observations?windowDays=${windowDays}`}
                className="btn-filter-secondary"
              >
                Clear
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Result count ───────────────────────────────────────────────────── */}
      <p className="mt-4 text-[0.8125rem] text-muted">
        {obsList.length > 0
          ? `${obsList.length} observation${obsList.length !== 1 ? "s" : ""} in the last ${windowDays} days`
          : "No observations match your filters"}
      </p>

      {/* ── Table / Empty state ────────────────────────────────────────────── */}
      {obsList.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16.5 16.5 3 3" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-[0.875rem] font-semibold text-text">No observations found</p>
          <p className="mt-1 text-[0.8125rem] text-muted">Try widening your filters or window period.</p>
        </div>
      ) : (
        <div className="mt-4 table-shell">
          <p className="sr-only" id="explorer-observations-scroll-hint">
            This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
          </p>
          <div className="overflow-x-auto" aria-describedby="explorer-observations-scroll-hint">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head-row text-left">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Year Group</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Phase</th>
                  <th className="px-4 py-3">Signals</th>
                  <th className="px-4 py-3">Observer</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {obsList.map((obs: any) => {
                  const allSignals = (obs.signals ?? []) as any[];
                  const recordedCount = allSignals.filter(
                    (s: any) => s.valueKey && !s.notObserved,
                  ).length;
                  const totalSignals = allSignals.length;
                  const phase = (obs.phase as string) ?? "Unknown";

                  return (
                    <tr
                      key={obs.id}
                      className="group table-row calm-transition"
                    >
                      {/* Date */}
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Link
                          href={`/observe/${obs.id}`}
                          className="tabular-nums text-text calm-transition group-hover:text-accent"
                        >
                          {formatShortDate(obs.observedAt)}
                        </Link>
                      </td>

                      {/* Teacher */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/observe/${obs.id}`}
                          className="flex items-center gap-2 min-w-0"
                        >
                          <Avatar name={obs.observedTeacher?.fullName ?? "?"} size="sm" />
                          <span className="truncate font-semibold text-text calm-transition group-hover:text-accent">
                            {obs.observedTeacher?.fullName ?? "—"}
                          </span>
                        </Link>
                      </td>

                      {/* Year Group */}
                      <td className="px-4 py-3 text-muted">
                        {obs.yearGroup ? `Y${obs.yearGroup}` : "—"}
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3 text-text">
                        {obs.subject ?? "—"}
                      </td>

                      {/* Phase pill */}
                      <td className="px-4 py-3">
                        <StatusPill variant={phaseVariant(phase)} size="sm">
                          {formatPhaseLabel(phase)}
                        </StatusPill>
                      </td>

                      {/* Signals */}
                      <td className="px-4 py-3 tabular-nums text-muted">
                        {totalSignals > 0
                          ? `${recordedCount}/${totalSignals}`
                          : "—"}
                      </td>

                      {/* Observer */}
                      <td className="px-4 py-3 text-muted">
                        {obs.observer?.fullName ?? "—"}
                      </td>

                      {/* View button */}
                      <td className="pr-4 py-3 text-right">
                        <Link
                          href={`/observe/${obs.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-container-lowest/70 px-3 py-1.5 text-[0.75rem] font-medium text-muted calm-transition hover:text-accent hover:border-accent/30"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <p className="mt-8 text-[0.75rem] text-muted">
        Explorer · Observations · {windowDays}d window
      </p>
    </div>
  );
}
