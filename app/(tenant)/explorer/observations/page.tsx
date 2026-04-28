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

  // ─── Fetch data ───────────────────────────────────────────────────────────
  const [observations, departments] = await Promise.all([
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
  ]);

  const obsList = observations as any[];

  const hasFilters = departmentId || teacherMembershipId || yearGroup || subject;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <ExplorerBackLink />

      <PageHeader
        eyebrow="Explorer"
        title="Observations"
        subtitle="Recent classroom observations with signal coverage details."
      />

      {/* ── Window selector + Filters ──────────────────────────────────────── */}
      <div className="w-full rounded-2xl bg-surface-container-low p-5 shadow-ambient md:p-6">
      <form className="filter-bar">
        {/* Window selector */}
        <div className="filter-period-toggle">
          {VALID_WINDOWS.map((w) => (
            <button
              key={w}
              type="submit"
              name="windowDays"
              value={String(w)}
              className={`filter-period-btn ${windowDays === w ? "filter-period-btn-active" : ""}`}
            >
              {w}D
            </button>
          ))}
        </div>

        {/* Department */}
        <select name="departmentId" defaultValue={departmentId} className="field min-w-[160px] !rounded-lg !py-1.5 !text-[0.8125rem]">
          <option value="">All Departments</option>
          {(departments as any[]).map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Year Group */}
        <input
          name="yearGroup"
          type="text"
          defaultValue={yearGroup}
          placeholder="Year Group (e.g. 10)"
          className="field min-w-[150px] !rounded-lg !py-1.5 !text-[0.8125rem]"
        />

        {/* Subject */}
        <input
          name="subject"
          type="text"
          defaultValue={subject}
          placeholder="Subject (e.g. Maths)"
          className="field min-w-[150px] !rounded-lg !py-1.5 !text-[0.8125rem]"
        />

        <div className="ml-auto flex items-center gap-2">
          {/* Apply */}
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-1.5 text-[0.8125rem] font-semibold text-on-primary calm-transition hover:opacity-90"
          >
            Apply
          </button>
          {hasFilters && (
            <Link
              href={`/explorer/observations?windowDays=${windowDays}`}
              className="rounded-lg border border-border/40 bg-surface-container-lowest px-4 py-1.5 text-[0.8125rem] font-medium text-muted calm-transition hover:bg-surface-container-low hover:text-text"
            >
              Clear
            </Link>
          )}
          {/* Export */}
          {showExport && (
            <button
              type="submit"
              formAction="/api/explorer/export"
              formMethod="POST"
              name="view"
              value="observations"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[0.8125rem] font-semibold text-on-primary calm-transition hover:opacity-90"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Data
            </button>
          )}
        </div>
      </form>
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
          <div className="overflow-x-auto">
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
