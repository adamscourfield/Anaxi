import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { MetaText, BodyText } from "@/components/ui/typography";
import { PageHeader } from "@/components/ui/page-header";
import { AnalysisBreadcrumb } from "@/components/explorer/explorer-breadcrumb";
import { StatusPill } from "@/components/ui/status-pill";
import { computeTeacherSignalProfile, type RiskStatus, type SignalProfileEntry } from "@/modules/analysis/teacherRisk";
import { canViewObservation, canViewTeacherAnalysis } from "@/modules/authz";
import { formatPhaseLabel } from "@/modules/observations/phaseLabel";
import { formatYearGroup } from "@/modules/observations/yearGroup";

const WINDOW_OPTIONS = [7, 21, 28, 90] as const;

const STATUS_LABELS: Record<RiskStatus, string> = {
  SIGNIFICANT_DRIFT: "Significant drift",
  EMERGING_DRIFT: "Emerging drift",
  STABLE: "Stable",
  LOW_COVERAGE: "Low coverage",
};

const STATUS_PILL: Record<RiskStatus, string> = {
  SIGNIFICANT_DRIFT: "bg-risk-urgent-bg text-risk-urgent-text",
  EMERGING_DRIFT:
    "border border-[var(--amber-border)] bg-[var(--amber-soft)] text-[#9a3412]",
  STABLE: "bg-risk-stable-bg text-risk-stable-text",
  LOW_COVERAGE: "bg-divider text-muted",
};

const OBS_CARD_SHELL =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

function IconCircle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] ${className}`}
    >
      {children}
    </span>
  );
}

function IconObservee() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="1.75">
      <path
        d="M2 12s3.5-5 10-5 10 5 10 5-3.5 5-10 5-10-5-10-5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function IconObserverPeople() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="1.75">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCalendarSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-muted" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="5" width="17" height="15" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" strokeLinecap="round" />
    </svg>
  );
}

function IconDriftDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 14l4 4 4-10 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrendUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="1.75">
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10l4-4 4 10 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-muted" stroke="currentColor" strokeWidth="1.75">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyObserverIllustration() {
  return (
    <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl bg-[var(--surface-container-high)]/70 text-muted">
      <svg viewBox="0 0 48 48" fill="none" className="h-16 w-16" aria-hidden>
        <rect x="11" y="9" width="22" height="28" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 17h16M16 23h12M16 29h14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity={0.35} />
        <circle cx="33" cy="31" r="8" fill="var(--surface-container-lowest)" stroke="currentColor" strokeWidth="1.25" />
        <path d="M30 31h6M33 28v6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function windowBounds(windowDays: number): { currentStart: Date; currentEnd: Date } {
  const now = new Date();
  const currentEnd = now;
  const currentStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return { currentStart, currentEnd };
}

function buildWindowHref(
  teacherId: string,
  windowDays: number,
  refSource: string | undefined,
): string {
  const q = new URLSearchParams({ window: String(windowDays) });
  if (refSource === "instruction" || refSource === "explorer") q.set("ref", refSource);
  return `/analysis/teachers/${teacherId}?${q.toString()}`;
}

function signalRows(
  signals: SignalProfileEntry[],
  driftThreshold: number,
): { drifting: SignalProfileEntry[]; improving: SignalProfileEntry[] } {
  const drifting = signals.filter(
    (s) => s.delta !== null && s.delta < -driftThreshold,
  );
  drifting.sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));
  const improving = signals.filter((s) => s.delta !== null && s.delta > driftThreshold);
  improving.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  return { drifting, improving };
}

function formatShortDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function TeacherProfilePage({
  params,
  searchParams,
}: {
  params: { memberId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const rawWindow = Number(searchParams?.window ?? "21");
  const windowDays = WINDOW_OPTIONS.includes(rawWindow as (typeof WINDOW_OPTIONS)[number])
    ? (rawWindow as (typeof WINDOW_OPTIONS)[number])
    : 21;

  const refRaw = typeof searchParams?.ref === "string" ? searchParams.ref : "";
  const refSource = refRaw === "instruction" || refRaw === "explorer" ? refRaw : undefined;

  const highlightSignal = typeof searchParams?.signal === "string" ? searchParams.signal : null;

  const teacherId = params.memberId;

  const [hodMemberships, coachAssignments, teacherDeptMemberships, settings] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
    (prisma as any).departmentMembership.findMany({ where: { userId: teacherId } }),
    (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);
  const teacherDepartmentIds = (teacherDeptMemberships as any[]).map((m: any) => m.departmentId);

  const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

  const canView = canViewTeacherAnalysis(viewerContext, { teacherUserId: teacherId, teacherDepartmentIds });
  if (!canView) notFound();

  const profile = await computeTeacherSignalProfile(user.tenantId, teacherId, windowDays);
  if (!profile) notFound();

  const driftThreshold: number = settings?.driftDeltaThreshold ?? 0.15;
  const { drifting, improving } = signalRows(profile.signals, driftThreshold);

  const computedAt = profile.computedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const deptMemberships = await (prisma as any).departmentMembership.findMany({
    where: { userId: teacherId },
    include: { department: true },
  });
  const departmentNames = (deptMemberships as any[]).map((m: any) => m.department.name);

  const teacherDeptMap = new Map<string, string[]>();
  const allTeacherDepts = await (prisma as any).departmentMembership.findMany({
    where: { tenantId: user.tenantId },
    select: { userId: true, departmentId: true },
  });
  for (const row of allTeacherDepts as { userId: string; departmentId: string }[]) {
    if (!teacherDeptMap.has(row.userId)) teacherDeptMap.set(row.userId, []);
    teacherDeptMap.get(row.userId)!.push(row.departmentId);
  }

  const { currentStart, currentEnd } = windowBounds(windowDays);

  const [asObserveeRaw, asObserverRaw, timetableRows] = await Promise.all([
    (prisma as any).observation.findMany({
      where: {
        tenantId: user.tenantId,
        observedTeacherId: teacherId,
        observedAt: { gte: currentStart, lte: currentEnd },
      },
      include: { observer: { select: { id: true, fullName: true } } },
      orderBy: { observedAt: "desc" },
      take: 15,
    }),
    (prisma as any).observation.findMany({
      where: {
        tenantId: user.tenantId,
        observerId: teacherId,
        observedAt: { gte: currentStart, lte: currentEnd },
      },
      include: { observedTeacher: { select: { id: true, fullName: true } } },
      orderBy: { observedAt: "desc" },
      take: 15,
    }),
    (prisma as any).timetableEntry.findMany({
      where: { tenantId: user.tenantId, teacherUserId: teacherId },
      select: { classCode: true, subject: true, yearGroup: true },
      take: 500,
    }),
  ]);

  const filterVisibleObs = (obsList: any[]) =>
    obsList.filter((obs) =>
      canViewObservation(viewerContext, {
        observedUserId: obs.observedTeacherId,
        observerUserId: obs.observerId,
        observedUserDepartmentIds: teacherDeptMap.get(obs.observedTeacherId) ?? [],
      }),
    );

  const asObservee = filterVisibleObs(asObserveeRaw as any[]);
  const asObserver = filterVisibleObs(asObserverRaw as any[]);
  const asObserveePreview = asObservee.slice(0, 4);
  const asObserverPreview = asObserver.slice(0, 4);

  const classKey = (r: { classCode: string; subject: string; yearGroup: string }) =>
    `${r.yearGroup}\u0000${r.subject}\u0000${r.classCode}`;
  const classMap = new Map<string, { classCode: string; subject: string; yearGroup: string }>();
  for (const r of timetableRows as { classCode: string; subject: string; yearGroup: string }[]) {
    classMap.set(classKey(r), r);
  }
  const assignedClasses = [...classMap.values()].sort((a, b) => {
    const y = a.yearGroup.localeCompare(b.yearGroup);
    if (y !== 0) return y;
    const s = a.subject.localeCompare(b.subject);
    if (s !== 0) return s;
    return a.classCode.localeCompare(b.classCode);
  });

  const backHref =
    refSource === "instruction"
      ? `/instruction/teachers?windowDays=${windowDays}`
      : refSource === "explorer"
        ? `/explorer/teachers?windowDays=${windowDays}`
        : `/analytics?tab=teachers&window=${windowDays}`;
  const backLabel =
    refSource === "instruction"
      ? "← Back to teachers"
      : refSource === "explorer"
        ? "← Back to Explorer teachers"
        : "← Back to teacher priorities";

  const historyHref = `/observe/history?teacherId=${teacherId}&window=${windowDays}`;
  const profileHref = buildWindowHref(teacherId, windowDays, refSource);
  const fullProfileAnchor = `${profileHref}#teacher-full-signal-profile`;

  return (
    <div className="space-y-8 pb-10">
      <AnalysisBreadcrumb
        items={[
          { label: "Teachers", href: "/instruction/teachers" },
          { label: profile.teacherName },
        ]}
      />

      <PageHeader
        variant="ledger"
        title={profile.teacherName}
        subtitle={departmentNames.length > 0 ? departmentNames.join(", ") : undefined}
        meta={
          <StatusPill
            variant={
              profile.status === "SIGNIFICANT_DRIFT"
                ? "error"
                : profile.status === "STABLE"
                  ? "success"
                  : "warning"
            }
          >
            {STATUS_LABELS[profile.status]}
          </StatusPill>
        }
        actions={
          <Link
            href={`/explorer/teachers?window=${windowDays}`}
            className="text-sm font-semibold text-accent underline-offset-2 hover:text-accentHover"
          >
            Explorer teacher view →
          </Link>
        }
      />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] leading-relaxed text-muted">
          <span className="inline-flex items-center gap-1.5">
            <IconCalendarSmall />
            <span>
              <span className="font-medium text-text">Coverage:</span> {profile.teacherCoverage} observation
              {profile.teacherCoverage !== 1 ? "s" : ""} in last {windowDays} days
            </span>
          </span>
          {profile.lastObservationAt && (
            <>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <span>Last observed {formatShortDate(new Date(profile.lastObservationAt))}</span>
            </>
          )}
          <span className="text-border" aria-hidden>
            ·
          </span>
          <span>Updated {computedAt}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[0.8125rem] font-medium text-muted">Window:</span>
          <div className="inline-flex flex-wrap gap-2">
            {WINDOW_OPTIONS.map((w) => (
              <Link
                key={w}
                href={buildWindowHref(teacherId, w, refSource)}
                className={`rounded-md px-3.5 py-1.5 text-[0.8125rem] font-semibold calm-transition ${
                  w === windowDays
                    ? "bg-[var(--surface-container-high)] text-text shadow-sm"
                    : "bg-[var(--surface-container-low)] text-muted hover:bg-[var(--surface-container)] hover:text-text"
                }`}
              >
                {w} days
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Observed (observee) */}
        <section className={OBS_CARD_SHELL}>
          <div className="flex gap-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)] px-5 py-4">
            <IconCircle>
              <IconObservee />
            </IconCircle>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text">Observed (observee)</h2>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">
                Observations where this teacher was observed in the window.
              </p>
            </div>
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            {asObservee.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">No observations in this window.</p>
            ) : (
              <ul className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)]">
                {asObserveePreview.map((obs: any) => (
                  <li key={obs.id}>
                    <Link
                      href={`/observe/${obs.id}`}
                      className="group flex items-start gap-3 px-5 py-4 calm-transition hover:bg-[var(--surface-container-low)]/80"
                    >
                      <div className="mt-0.5">
                        <IconCalendarSmall />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text">{formatShortDate(new Date(obs.observedAt))}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          Observer: {obs.observer?.fullName ?? "—"} · {obs.subject}
                          {obs.yearGroup ? ` · ${formatYearGroup(obs.yearGroup)}` : ""}
                          {obs.classCode ? ` · ${obs.classCode}` : ""}
                        </p>
                        <p className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted">
                          {formatPhaseLabel(obs.phase)}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-2">
                        <span className="rounded-md bg-[color-mix(in_srgb,var(--scale-strong-bar)_18%,var(--surface-container-lowest))] px-2.5 py-1 text-[0.6875rem] font-semibold text-scale-strong-text calm-transition group-hover:bg-[color-mix(in_srgb,var(--scale-strong-bar)_28%,var(--surface-container-lowest))]">
                          Open
                        </span>
                        <IconChevronRight />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {asObservee.length > 0 && (
            <div className="border-t border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] px-5 py-3 text-center">
              <Link
                href={historyHref}
                className="text-[0.8125rem] font-semibold text-accent hover:underline"
              >
                View all observations
                <span aria-hidden> →</span>
              </Link>
            </div>
          )}
        </section>

        {/* Observations conducted */}
        <section className={OBS_CARD_SHELL}>
          <div className="flex gap-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)] px-5 py-4">
            <IconCircle>
              <IconObserverPeople />
            </IconCircle>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text">Observations conducted (observer)</h2>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">
                Lessons this teacher observed for others in the window.
              </p>
            </div>
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            {asObserver.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-10 text-center">
                <EmptyObserverIllustration />
                <p className="mt-5 text-sm font-semibold text-text">No observations conducted in this window</p>
                <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-muted">
                  When this teacher observes others, they&apos;ll appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)]">
                {asObserverPreview.map((obs: any) => (
                  <li key={obs.id}>
                    <Link
                      href={`/observe/${obs.id}`}
                      className="group flex items-start gap-3 px-5 py-4 calm-transition hover:bg-[var(--surface-container-low)]/80"
                    >
                      <div className="mt-0.5">
                        <IconCalendarSmall />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text">{formatShortDate(new Date(obs.observedAt))}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          Observee: {obs.observedTeacher?.fullName ?? "—"} · {obs.subject}
                          {obs.yearGroup ? ` · ${formatYearGroup(obs.yearGroup)}` : ""}
                          {obs.classCode ? ` · ${obs.classCode}` : ""}
                        </p>
                        <p className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted">
                          {formatPhaseLabel(obs.phase)}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-2">
                        <span className="rounded-md bg-[color-mix(in_srgb,var(--scale-strong-bar)_18%,var(--surface-container-lowest))] px-2.5 py-1 text-[0.6875rem] font-semibold text-scale-strong-text calm-transition group-hover:bg-[color-mix(in_srgb,var(--scale-strong-bar)_28%,var(--surface-container-lowest))]">
                          Open
                        </span>
                        <IconChevronRight />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {assignedClasses.length > 0 && (
        <section className={OBS_CARD_SHELL}>
          <div className="border-b border-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)] px-5 py-4">
            <h2 className="text-base font-semibold text-text">Assigned classes (timetable)</h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted">
              Distinct classes linked to this teacher from timetable import.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] bg-[var(--surface-container-low)]/50 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Year</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Class</th>
                </tr>
              </thead>
              <tbody>
                {assignedClasses.map((c) => (
                  <tr
                    key={`${c.yearGroup}-${c.subject}-${c.classCode}`}
                    className="border-b border-[color-mix(in_srgb,var(--outline-variant)_08%,transparent)] last:border-0"
                  >
                    <td className="px-5 py-3 text-muted">{formatYearGroup(c.yearGroup)}</td>
                    <td className="px-4 py-3 font-medium text-text">{c.subject}</td>
                    <td className="px-4 py-3 text-muted">{c.classCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Drift on signals */}
        <section className={OBS_CARD_SHELL}>
          <div className="flex gap-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)] px-5 py-4">
            <IconCircle className="bg-[color-mix(in_srgb,var(--risk-urgent-text)_10%,var(--surface-container-high))] text-risk-urgent-text">
              <IconDriftDown />
            </IconCircle>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text">Drift on signals</h2>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">
                Weakening beyond the school drift threshold (Δ &lt; −{driftThreshold.toFixed(2)}).
              </p>
            </div>
          </div>
          {drifting.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              No signals crossed the drift threshold in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] bg-[var(--surface-container-low)]/50 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-5 py-3">Signal</th>
                    <th className="px-4 py-3 text-right">Current</th>
                    <th className="px-4 py-3 text-right">Previous</th>
                    <th className="px-4 py-3 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {drifting.slice(0, 2).map((sig) => (
                    <tr
                      key={sig.signalKey}
                      className="border-b border-[color-mix(in_srgb,var(--outline-variant)_08%,transparent)] last:border-0"
                    >
                      <td className="px-5 py-3 font-medium text-text">{sig.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {sig.currentMean !== null ? sig.currentMean.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {sig.prevMean !== null ? sig.prevMean.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#DC2626]">
                        {sig.delta !== null ? sig.delta.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {drifting.length > 0 && (
            <div className="border-t border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] px-5 py-3 text-center">
              <Link href={fullProfileAnchor} className="text-[0.8125rem] font-semibold text-accent hover:underline">
                View all drifting signals
                <span aria-hidden> →</span>
              </Link>
            </div>
          )}
        </section>

        {/* Success on signals */}
        <section className={OBS_CARD_SHELL}>
          <div className="flex gap-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)] px-5 py-4">
            <IconCircle className="bg-[color-mix(in_srgb,var(--scale-strong-text)_12%,var(--surface-container-high))] text-scale-strong-text">
              <IconTrendUp />
            </IconCircle>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text">Success on signals</h2>
              <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">
                Meaningful improvement (Δ &gt; +{driftThreshold.toFixed(2)}), same threshold as drift.
              </p>
            </div>
          </div>
          {improving.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              No signals showed this level of improvement in the window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] bg-[var(--surface-container-low)]/50 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
                    <th className="px-5 py-3">Signal</th>
                    <th className="px-4 py-3 text-right">Current</th>
                    <th className="px-4 py-3 text-right">Previous</th>
                    <th className="px-4 py-3 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {improving.slice(0, 2).map((sig) => (
                    <tr
                      key={sig.signalKey}
                      className="border-b border-[color-mix(in_srgb,var(--outline-variant)_08%,transparent)] last:border-0"
                    >
                      <td className="px-5 py-3 font-medium text-text">{sig.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {sig.currentMean !== null ? sig.currentMean.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {sig.prevMean !== null ? sig.prevMean.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#15803D]">
                        {sig.delta !== null ? `+${sig.delta.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {improving.length > 0 && (
            <div className="border-t border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] px-5 py-3 text-center">
              <Link href={fullProfileAnchor} className="text-[0.8125rem] font-semibold text-accent hover:underline">
                View all improving signals
                <span aria-hidden> →</span>
              </Link>
            </div>
          )}
        </section>
      </div>

      <section id="teacher-full-signal-profile" className={`${OBS_CARD_SHELL} scroll-mt-20`}>
        <div className="border-b border-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)] px-5 py-4">
          <h2 className="text-base font-semibold text-text">Full signal profile</h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {profile.status === "LOW_COVERAGE"
              ? "Insufficient observations for drift analysis."
              : `Instructional drift score (IDS): ${profile.normalizedIDS.toFixed(1)} · Sorted by change (weakest first)`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_10%,transparent)] bg-[var(--surface-container-low)]/50 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
                <th className="px-5 py-3.5">Signal</th>
                <th className="px-4 py-3.5 text-right">Current</th>
                <th className="px-4 py-3.5 text-right">Previous</th>
                <th className="px-4 py-3.5 text-right">Δ</th>
                <th className="px-4 py-3.5 text-right">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {profile.signals.map((sig) => {
                const isDriver = sig.driftContribution > 0;
                const isHighlighted = highlightSignal === sig.signalKey;
                return (
                  <tr
                    key={sig.signalKey}
                    id={sig.signalKey}
                    className={`border-b border-[color-mix(in_srgb,var(--outline-variant)_06%,transparent)] last:border-0 calm-transition scroll-mt-20 ${
                      isHighlighted
                        ? "ring-2 ring-inset ring-accent/40 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                        : isDriver
                          ? "bg-[color-mix(in_srgb,var(--risk-urgent-bg)_55%,transparent)]"
                          : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 font-medium text-text">{sig.label}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted">
                      {sig.currentMean !== null ? sig.currentMean.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted">
                      {sig.prevMean !== null ? sig.prevMean.toFixed(2) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right tabular-nums font-medium ${
                        sig.delta === null
                          ? "text-muted"
                          : sig.delta < 0
                            ? "text-[#DC2626]"
                            : sig.delta > 0
                              ? "text-[#15803D]"
                              : "text-muted"
                      }`}
                    >
                      {sig.delta !== null ? `${sig.delta > 0 ? "+" : ""}${sig.delta.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right text-muted">{sig.coverageCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap justify-center gap-4 pt-2">
        <Link
          href={historyHref}
          className="text-[0.8125rem] font-semibold text-muted hover:text-text hover:underline"
        >
          Full observation history
          <span aria-hidden> →</span>
        </Link>
      </div>
    </div>
  );
}
