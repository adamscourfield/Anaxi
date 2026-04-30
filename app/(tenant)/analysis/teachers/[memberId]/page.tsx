import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { H1, H2, H3, MetaText, BodyText } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
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
  EMERGING_DRIFT: "bg-scale-some-light text-scale-some-text",
  STABLE: "bg-risk-stable-bg text-risk-stable-text",
  LOW_COVERAGE: "bg-divider text-muted",
};

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

  return (
    <div className="space-y-6">
      <Link href={backHref} className="link-muted-accent text-sm">
        {backLabel}
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <H1>{profile.teacherName}</H1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[profile.status]}`}>
            {STATUS_LABELS[profile.status]}
          </span>
        </div>
        {departmentNames.length > 0 && (
          <BodyText className="text-muted">{departmentNames.join(", ")}</BodyText>
        )}
        <MetaText>
          Coverage: {profile.teacherCoverage} observation{profile.teacherCoverage !== 1 ? "s" : ""} in last{" "}
          {windowDays} days
          {profile.lastObservationAt
            ? ` · Last observed ${formatShortDate(new Date(profile.lastObservationAt))}`
            : ""}
          {" · "}Updated {computedAt}
        </MetaText>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MetaText className="mr-1">Window:</MetaText>
        <div className="segmented-toggle">
          {WINDOW_OPTIONS.map((w) => (
            <Link
              key={w}
              href={buildWindowHref(teacherId, w, refSource)}
              className={`segmented-toggle-btn ${w === windowDays ? "segmented-toggle-btn-active" : ""}`}
            >
              {w} days
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <H2>Observed (observee)</H2>
            <MetaText>Observations where this teacher was observed in the window.</MetaText>
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {asObservee.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No observations in this window.</p>
            ) : (
              <ul className="divide-y divide-border">
                {asObservee.map((obs: any) => (
                  <li key={obs.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text">{formatShortDate(new Date(obs.observedAt))}</p>
                        <p className="text-xs text-muted">
                          Observer: {obs.observer?.fullName ?? "—"} · {obs.subject}
                          {obs.yearGroup ? ` · ${formatYearGroup(obs.yearGroup)}` : ""}
                          {obs.classCode ? ` · ${obs.classCode}` : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">{formatPhaseLabel(obs.phase)}</p>
                      </div>
                      <Link
                        href={`/observe/${obs.id}`}
                        className="shrink-0 text-xs font-medium text-accent hover:underline"
                      >
                        Open
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <H2>Observations conducted (observer)</H2>
            <MetaText>Lessons this teacher observed for others in the window.</MetaText>
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {asObserver.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No observations conducted in this window.</p>
            ) : (
              <ul className="divide-y divide-border">
                {asObserver.map((obs: any) => (
                  <li key={obs.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text">{formatShortDate(new Date(obs.observedAt))}</p>
                        <p className="text-xs text-muted">
                          Observee: {obs.observedTeacher?.fullName ?? "—"} · {obs.subject}
                          {obs.yearGroup ? ` · ${formatYearGroup(obs.yearGroup)}` : ""}
                          {obs.classCode ? ` · ${obs.classCode}` : ""}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">{formatPhaseLabel(obs.phase)}</p>
                      </div>
                      <Link
                        href={`/observe/${obs.id}`}
                        className="shrink-0 text-xs font-medium text-accent hover:underline"
                      >
                        Open
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {assignedClasses.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <H2>Assigned classes (timetable)</H2>
            <MetaText>Distinct classes linked to this teacher from timetable import.</MetaText>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-5 py-3">Year</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Class</th>
                </tr>
              </thead>
              <tbody>
                {assignedClasses.map((c) => (
                  <tr key={`${c.yearGroup}-${c.subject}-${c.classCode}`} className="table-row">
                    <td className="px-5 py-3 text-muted">{formatYearGroup(c.yearGroup)}</td>
                    <td className="px-4 py-3 font-medium text-text">{c.subject}</td>
                    <td className="px-4 py-3 text-muted">{c.classCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <H3>Drift on signals</H3>
            <MetaText>
              Weakening beyond the school drift threshold (Δ &lt; −{driftThreshold.toFixed(2)}).
            </MetaText>
          </div>
          {drifting.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">No signals crossed the drift threshold in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-5 py-3">Signal</th>
                    <th className="px-4 py-3 text-right">Current</th>
                    <th className="px-4 py-3 text-right">Previous</th>
                    <th className="px-4 py-3 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {drifting.map((sig) => (
                    <tr key={sig.signalKey} className="table-row table-row-highlight">
                      <td className="px-5 py-3 font-medium text-text">{sig.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {sig.currentMean !== null ? sig.currentMean.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {sig.prevMean !== null ? sig.prevMean.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-scale-some-text">
                        {sig.delta !== null ? sig.delta.toFixed(2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <H3>Success on signals</H3>
            <MetaText>
              Meaningful improvement (Δ &gt; +{driftThreshold.toFixed(2)}), same threshold as drift.
            </MetaText>
          </div>
          {improving.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">No signals showed this level of improvement in the window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-5 py-3">Signal</th>
                    <th className="px-4 py-3 text-right">Current</th>
                    <th className="px-4 py-3 text-right">Previous</th>
                    <th className="px-4 py-3 text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {improving.map((sig) => (
                    <tr key={sig.signalKey} className="table-row">
                      <td className="px-5 py-3 font-medium text-text">{sig.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {sig.currentMean !== null ? sig.currentMean.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {sig.prevMean !== null ? sig.prevMean.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-scale-strong-text">
                        {sig.delta !== null ? `+${sig.delta.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <H2>Full signal profile</H2>
          <MetaText>
            {profile.status === "LOW_COVERAGE"
              ? "Insufficient observations for drift analysis."
              : `Instructional drift score (IDS): ${profile.normalizedIDS.toFixed(1)} · Sorted by change (weakest first)`}
          </MetaText>
        </div>
        <div className="table-shell border-0 rounded-none shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head-row">
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
                  return (
                    <tr
                      key={sig.signalKey}
                      className={`table-row calm-transition ${isDriver ? "table-row-highlight" : ""}`}
                    >
                      <td className="px-5 py-4 font-medium text-text">{sig.label}</td>
                      <td className="px-4 py-4 text-right tabular-nums text-muted">
                        {sig.currentMean !== null ? sig.currentMean.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums text-muted">
                        {sig.prevMean !== null ? sig.prevMean.toFixed(2) : "—"}
                      </td>
                      <td
                        className={`px-4 py-4 text-right tabular-nums font-medium ${
                          sig.delta === null
                            ? "text-muted"
                            : sig.delta < 0
                              ? "text-scale-some-text"
                              : sig.delta > 0
                                ? "text-scale-strong-text"
                                : "text-muted"
                        }`}
                      >
                        {sig.delta !== null ? `${sig.delta > 0 ? "+" : ""}${sig.delta.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-4 text-right text-muted">{sig.coverageCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/observe/history?teacherId=${teacherId}&window=${windowDays}`} passHref>
          <Button variant="secondary">Full observation history</Button>
        </Link>
      </div>
    </div>
  );
}
