import Link from "next/link";
import { notFound } from "next/navigation";
import type { GradeFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { H1, H2, MetaText, BodyText } from "@/components/ui/typography";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { displayGrade, hasRecordedGrade } from "@/modules/assessments/gradeNormalizer";
import { canViewStudentAnalysis } from "@/modules/authz";
import { computeStudentRiskProfile, RiskBand, Confidence } from "@/modules/analysis/studentRisk";
import { toggleWatchlist } from "@/app/(tenant)/analysis/students/actions";
import { archiveStudentAction, unarchiveStudentAction } from "../actions";

const WINDOW_OPTIONS = [7, 21, 28] as const;

const BAND_LABELS: Record<RiskBand, string> = {
  URGENT: "Urgent",
  PRIORITY: "Priority",
  WATCH: "Watch",
  STABLE: "Stable",
};

const BAND_PILL: Record<RiskBand, string> = {
  URGENT: "bg-risk-urgent-bg text-risk-urgent-text",
  PRIORITY: "bg-scale-some-light text-scale-some-text",
  WATCH: "bg-risk-watch-bg text-risk-watch-text",
  STABLE: "bg-risk-stable-bg text-risk-stable-text",
};

const CONFIDENCE_PILL: Record<Confidence, string> = {
  HIGH: "bg-divider text-muted",
  LOW: "bg-risk-priority-bg text-risk-priority-text",
};

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function attendanceBarColor(pct: number | null): string {
  if (pct === null) return "bg-surface-container-high";
  if (pct >= 90) return "bg-scale-strong-bar";
  if (pct >= 80) return "bg-scale-some-bar";
  return "bg-scale-limited-bar";
}

/** Loose match for assessment.yearGroup (e.g. "Y13", "13", "Year 13") vs student.yearGroup */
function yearGroupMatches(assessmentYearGroup: string, studentYearGroup: string | null | undefined): boolean {
  if (!studentYearGroup?.trim()) return false;
  const norm = (s: string) =>
    s
      .trim()
      .toUpperCase()
      .replace(/^YEAR\s+/, "")
      .replace(/^Y/, "");
  return norm(assessmentYearGroup) === norm(studentYearGroup);
}

type AttainmentRow = {
  subject: string;
  points: Array<{
    label: string;
    ordinal: number;
    normalizedScore: number | null;
    rawValue: string;
    gradeFormat: GradeFormat;
    maxScore: number | null;
  }>;
};

function DeltaCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted">—</span>;
  const color = value > 0 ? "text-red-600" : value < 0 ? "text-scale-strong-text" : "text-muted";
  return (
    <span className={`tabular-nums font-medium ${color}`}>
      {value > 0 ? `+${value}` : String(value)}
    </span>
  );
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");

  const rawWindow = Number(searchParams?.window ?? "21");
  const windowDays = WINDOW_OPTIONS.includes(rawWindow as (typeof WINDOW_OPTIONS)[number])
    ? (rawWindow as (typeof WINDOW_OPTIONS)[number])
    : 21;

  // Contextual back link — callers can pass ?from=/some/path for context-aware navigation
  const rawFrom = Array.isArray(searchParams?.from) ? searchParams!.from[0] : (searchParams?.from ?? "");
  const backHref = rawFrom && rawFrom.startsWith("/") ? rawFrom : "/students";
  const backLabel = rawFrom && rawFrom.startsWith("/assessments") ? "Back to assessment" : "Back to students";

  const assessmentsFeature = await prisma.tenantFeature.findUnique({
    where: { tenantId_key: { tenantId: user.tenantId, key: "ASSESSMENTS" } },
    select: { enabled: true },
  });

  const student = await (prisma as any).student.findFirst({
    where: { id: params.id, tenantId: user.tenantId },
    include: {
      snapshots: { orderBy: { snapshotDate: "desc" } },
      subjectTeachers: {
        where: { OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] },
        include: { subject: true, teacher: { select: { fullName: true, email: true } } },
        orderBy: { subject: { name: "asc" } },
      },
      changeFlags: { orderBy: { createdAt: "desc" }, take: 50 },
      onCallRequests: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!student) notFound();

  const analysisFeature = await prisma.tenantFeature.findUnique({
    where: { tenantId_key: { tenantId: user.tenantId, key: "ANALYSIS" } },
    select: { enabled: true },
  });
  const canViewAnalysis = canViewStudentAnalysis({
    userId: user.id,
    role: user.role,
    hodDepartmentIds: [],
    coacheeUserIds: [],
  });
  const showAnalysis = analysisFeature?.enabled && canViewAnalysis;

  const analysisProfile = showAnalysis
    ? await computeStudentRiskProfile(user.tenantId, params.id, windowDays, user.id)
    : null;

  const snapshots = student.snapshots as Array<{
    id: string;
    snapshotDate: Date;
    attendancePct: unknown;
    detentionsCount: number;
    onCallsCount: number;
    latenessCount: number;
    internalExclusionsCount: number;
    suspensionsCount: number;
    positivePointsTotal: number;
  }>;
  const latestSnapshot = snapshots[0] ?? null;
  const chronSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime(),
  );

  let activeCycle: { id: string; label: string } | null = null;
  let attainmentBySubject: AttainmentRow[] = [];

  if (assessmentsFeature?.enabled) {
    const activeCycles = await prisma.assessmentCycle.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    });

    if (activeCycles.length > 0) {
      const cycleIds = activeCycles.map((c) => c.id);
      const cyclePickRows = await prisma.assessmentResult.findMany({
        where: {
          tenantId: user.tenantId,
          studentId: params.id,
          status: "PRESENT",
          assessment: { point: { cycleId: { in: cycleIds } } },
        },
        select: {
          rawValue: true,
          assessment: {
            select: {
              gradeFormat: true,
              maxScore: true,
              yearGroup: true,
              point: { select: { cycleId: true } },
            },
          },
        },
      });

      const countByCycle = new Map<string, number>();
      const yearGroupMatchCycle = new Set<string>();
      for (const r of cyclePickRows) {
        if (!hasRecordedGrade(r.rawValue, r.assessment.gradeFormat, r.assessment.maxScore)) continue;
        const cid = r.assessment.point.cycleId;
        countByCycle.set(cid, (countByCycle.get(cid) ?? 0) + 1);
        if (yearGroupMatches(r.assessment.yearGroup, student.yearGroup)) {
          yearGroupMatchCycle.add(cid);
        }
      }

      const bestCount = Math.max(0, ...activeCycles.map((c) => countByCycle.get(c.id) ?? 0));
      let chosenCycleId: string;
      if (bestCount > 0) {
        const tied = activeCycles.filter((c) => (countByCycle.get(c.id) ?? 0) === bestCount);
        const withYg = tied.filter((c) => yearGroupMatchCycle.has(c.id));
        chosenCycleId = (withYg[0] ?? tied[0]).id;
      } else {
        chosenCycleId = activeCycles[0].id;
      }

      activeCycle = activeCycles.find((c) => c.id === chosenCycleId) ?? activeCycles[0];
    }

    if (activeCycle) {
      const results = await prisma.assessmentResult.findMany({
        where: {
          tenantId: user.tenantId,
          studentId: params.id,
          status: "PRESENT",
          assessment: { point: { cycleId: activeCycle.id } },
        },
        include: {
          assessment: {
            include: { point: true },
          },
        },
        orderBy: { assessment: { point: { ordinal: "asc" } } },
      });

      const gradedResults = results.filter((r) =>
        hasRecordedGrade(r.rawValue, r.assessment.gradeFormat, r.assessment.maxScore),
      );

      const subjectMap = new Map<string, AttainmentRow["points"]>();
      for (const r of gradedResults) {
        const subject = r.assessment.subject;
        if (!subjectMap.has(subject)) subjectMap.set(subject, []);
        subjectMap.get(subject)!.push({
          label: r.assessment.point.label,
          ordinal: r.assessment.point.ordinal,
          normalizedScore: r.normalizedScore,
          rawValue: r.rawValue,
          gradeFormat: r.assessment.gradeFormat,
          maxScore: r.assessment.maxScore,
        });
      }

      attainmentBySubject = [...subjectMap.entries()]
        .map(([subject, points]) => ({ subject, points }))
        .sort((a, b) => a.subject.localeCompare(b.subject));
    }
  }

  const attPct = latestSnapshot ? Number(latestSnapshot.attendancePct) : null;
  const attDisplay =
    latestSnapshot && attPct !== null && !Number.isNaN(attPct) ? Math.round(attPct) : null;

  const statusLabel =
    student.status === "ACTIVE" ? "Active" : student.status === "ARCHIVED" ? "Archived" : student.status;

  const computedAtStr = analysisProfile
    ? analysisProfile.computedAt.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-8">
      <Link href={backHref} className="link-muted-accent inline-flex items-center gap-1 text-sm">
        <span aria-hidden>←</span> {backLabel}
      </Link>

      {/* Profile header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high text-base font-bold text-text"
            aria-hidden
          >
            {getInitials(student.fullName)}
          </div>
          <div className="min-w-0">
            <H1 className="break-words">{student.fullName}</H1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {student.yearGroup ? (
                <span className="rounded-md bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  Year {student.yearGroup}
                </span>
              ) : null}
              <span className="rounded-md bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                {statusLabel}
              </span>
              {student.sendFlag ? (
                <span className="rounded-md bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  SEND
                </span>
              ) : null}
              {student.ppFlag ? (
                <span className="rounded-md bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  PP
                </span>
              ) : null}
            </div>
            <MetaText className="mt-2">
              {student.upn ? `UPN ${student.upn}` : "No UPN on record"}
            </MetaText>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {student.status === "ACTIVE" ? (
            <form action={archiveStudentAction}>
              <input type="hidden" name="studentId" value={student.id} />
              <input type="hidden" name="returnTo" value={`/students/${student.id}`} />
              <Button type="submit" variant="secondary">Archive student</Button>
            </form>
          ) : (
            <form action={unarchiveStudentAction}>
              <input type="hidden" name="studentId" value={student.id} />
              <input type="hidden" name="returnTo" value={`/students/${student.id}`} />
              <Button type="submit" variant="secondary">Restore student</Button>
            </form>
          )}
        </div>
      </div>

      {/* Latest behaviour snapshot */}
      {latestSnapshot && attDisplay !== null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card tone="subtle" className="!p-4">
            <MetaText className="mb-2 uppercase tracking-[0.06em]">Attendance</MetaText>
            <div className="flex items-end justify-between gap-3">
              <span className="text-2xl font-bold tabular-nums text-text">{attDisplay}%</span>
              <span className="text-xs text-muted">{fmtDate(latestSnapshot.snapshotDate)}</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div
                className={`h-full rounded-full ${attendanceBarColor(attPct)}`}
                style={{ width: `${Math.min(100, Math.max(0, attPct!))}%` }}
              />
            </div>
          </Card>
          <Card tone="subtle" className="!p-4">
            <MetaText className="mb-2 uppercase tracking-[0.06em]">On calls</MetaText>
            <p className="text-2xl font-bold tabular-nums text-text">{latestSnapshot.onCallsCount}</p>
          </Card>
          <Card tone="subtle" className="!p-4">
            <MetaText className="mb-2 uppercase tracking-[0.06em]">Detentions</MetaText>
            <p className="text-2xl font-bold tabular-nums text-text">{latestSnapshot.detentionsCount}</p>
          </Card>
          <Card tone="subtle" className="!p-4">
            <MetaText className="mb-2 uppercase tracking-[0.06em]">Lateness</MetaText>
            <p className="text-2xl font-bold tabular-nums text-text">{latestSnapshot.latenessCount}</p>
          </Card>
        </div>
      ) : (
        <Card tone="subtle">
          <BodyText className="text-muted">No behaviour snapshot imported yet for this student.</BodyText>
        </Card>
      )}

      {analysisProfile ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <H2>Pastoral risk (analysis)</H2>
              <MetaText>
                Window: {windowDays} days · Risk score: {analysisProfile.riskScore}
                {computedAtStr ? ` · Updated ${computedAtStr}` : ""}
              </MetaText>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BAND_PILL[analysisProfile.band]}`}>
                {BAND_LABELS[analysisProfile.band]}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONFIDENCE_PILL[analysisProfile.confidence]}`}
              >
                Confidence: {analysisProfile.confidence === "HIGH" ? "High" : "Low"}
              </span>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <MetaText className="mr-1">Window:</MetaText>
            <div className="segmented-toggle">
              {WINDOW_OPTIONS.map((w) => (
                <Link
                  key={w}
                  href={`/students/${params.id}?window=${w}`}
                  className={`segmented-toggle-btn ${w === windowDays ? "segmented-toggle-btn-active" : ""}`}
                >
                  {w} days
                </Link>
              ))}
            </div>
          </div>

          <div className="table-shell">
            <p className="sr-only" id="student-profile-metrics-scroll-hint">
              This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
            </p>
            <div className="overflow-x-auto" aria-describedby="student-profile-metrics-scroll-hint">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-surface-container-low">
                  <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                    Metric
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-muted"
                  >
                    <span className="block normal-case font-semibold tracking-[0.06em] text-text">Change</span>
                    <span className="mt-0.5 block font-normal normal-case tracking-normal text-[11px] text-muted">
                      vs start of {windowDays}-day window
                    </span>
                  </th>
                  <th
                    scope="col"
                    className="border-l border-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)] bg-surface-container-low px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-muted"
                  >
                    <span className="block normal-case font-semibold tracking-[0.06em] text-text">Latest snapshot</span>
                    <span className="mt-0.5 block font-normal normal-case tracking-normal text-[11px] text-muted">
                      {analysisProfile.currentSnapshot
                        ? fmtDate(analysisProfile.currentSnapshot.snapshotDate)
                        : "No snapshot in this window"}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="table-row">
                  <td className="px-5 py-3 text-muted">Attendance</td>
                  <td className="px-4 py-3 text-right">
                    {analysisProfile.attendanceDelta !== null ? (
                      <span
                        className={`tabular-nums font-medium ${
                          analysisProfile.attendanceDelta < 0 ? "text-red-600" : "text-scale-strong-text"
                        }`}
                        title="Change in attendance rate (percentage points)"
                      >
                        {analysisProfile.attendanceDelta > 0 ? "+" : ""}
                        {analysisProfile.attendanceDelta.toFixed(1)} pp
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="border-l border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-low)_42%,var(--surface-container-lowest))] px-4 py-3 text-right tabular-nums font-medium text-text">
                    {analysisProfile.currentSnapshot
                      ? `${analysisProfile.currentSnapshot.attendancePct.toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-5 py-3 text-muted">On calls</td>
                  <td className="px-4 py-3 text-right">
                    <DeltaCell value={analysisProfile.onCallsDelta} />
                  </td>
                  <td className="border-l border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-low)_42%,var(--surface-container-lowest))] px-4 py-3 text-right tabular-nums font-medium text-text">
                    {analysisProfile.currentSnapshot ? analysisProfile.currentSnapshot.onCallsCount : "—"}
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-5 py-3 text-muted">Detentions</td>
                  <td className="px-4 py-3 text-right">
                    <DeltaCell value={analysisProfile.detentionsDelta} />
                  </td>
                  <td className="border-l border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-low)_42%,var(--surface-container-lowest))] px-4 py-3 text-right tabular-nums font-medium text-text">
                    {analysisProfile.currentSnapshot ? analysisProfile.currentSnapshot.detentionsCount : "—"}
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-5 py-3 text-muted">Lateness</td>
                  <td className="px-4 py-3 text-right">
                    <DeltaCell value={analysisProfile.latenessDelta} />
                  </td>
                  <td className="border-l border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-low)_42%,var(--surface-container-lowest))] px-4 py-3 text-right tabular-nums font-medium text-text">
                    {analysisProfile.currentSnapshot ? analysisProfile.currentSnapshot.latenessCount : "—"}
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-5 py-3 text-muted">Internal exclusions</td>
                  <td className="px-4 py-3 text-right">
                    <DeltaCell value={analysisProfile.internalExclusionsDelta} />
                  </td>
                  <td className="border-l border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-low)_42%,var(--surface-container-lowest))] px-4 py-3 text-right tabular-nums font-medium text-text">
                    {analysisProfile.currentSnapshot
                      ? analysisProfile.currentSnapshot.internalExclusionsCount
                      : "—"}
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-5 py-3 text-muted">Suspensions</td>
                  <td className="px-4 py-3 text-right">
                    <DeltaCell value={analysisProfile.suspensionsDelta} />
                  </td>
                  <td className="border-l border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-low)_42%,var(--surface-container-lowest))] px-4 py-3 text-right tabular-nums font-medium text-text">
                    {analysisProfile.currentSnapshot ? analysisProfile.currentSnapshot.suspensionsCount : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
          {!analysisProfile.currentSnapshot ? (
            <MetaText className="mt-2">
              No snapshot in this window — the change column may still show movement across the period.
            </MetaText>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <form
              action={async () => {
                "use server";
                await toggleWatchlist(analysisProfile.studentId);
              }}
            >
              <Button variant={analysisProfile.onWatchlist ? "primary" : "secondary"} type="submit">
                {analysisProfile.onWatchlist ? "★ On watchlist" : "Add to watchlist"}
              </Button>
            </form>
            <Link href={`/analytics?tab=students&window=${windowDays}`} className="link-accent text-sm">
              Open student support priorities →
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Teachers */}
        <Card>
          <SectionHeader title="Teachers" subtitle="Current subject assignments" />
          {(student.subjectTeachers as any[]).length === 0 ? (
            <BodyText className="mt-4 text-muted">No subject teachers linked.</BodyText>
          ) : (
            <div className="table-shell mt-4">
              <p className="sr-only" id="student-profile-teachers-scroll-hint">
                This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
              </p>
              <div className="overflow-x-auto" aria-describedby="student-profile-teachers-scroll-hint">
              <table className="w-full min-w-[320px] text-sm">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-4 py-3 text-left font-semibold tracking-[0.08em]">Subject</th>
                    <th className="px-4 py-3 text-left font-semibold tracking-[0.08em]">Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {(student.subjectTeachers as any[]).map((x: any) => (
                    <tr key={x.id} className="table-row calm-transition">
                      <td className="px-4 py-3.5 font-medium text-text">{x.subject?.name ?? "—"}</td>
                      <td className="px-4 py-3.5 text-muted">
                        <span className="text-text">{x.teacher?.fullName ?? "—"}</span>
                        {x.teacher?.email ? (
                          <span className="mt-0.5 block text-xs text-muted">{x.teacher.email}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </Card>

        {/* Assessments */}
        {assessmentsFeature?.enabled ? (
          <Card>
            <SectionHeader
              title="Assessments"
              subtitle={activeCycle ? `Active cycle: ${activeCycle.label}` : "No active assessment cycle"}
              href="/assessments"
              linkLabel="Open assessments"
            />
            {!activeCycle ? (
              <BodyText className="mt-4 text-muted">
                Set an active cycle under Assessments to see results here.
              </BodyText>
            ) : attainmentBySubject.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  mode="embedded"
                  title="No assessment results"
                  description="This student has no marks recorded in the active cycle yet."
                />
              </div>
            ) : (
              <div className="mt-4 table-shell">
                <p className="sr-only" id="student-profile-assessments-scroll-hint">
                  This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
                </p>
                <div className="overflow-x-auto" aria-describedby="student-profile-assessments-scroll-hint">
                <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="table-head-row">
                        <th className="sticky-first-column-header sticky left-0 z-20 px-5 py-3.5 text-left">Subject</th>
                      {attainmentBySubject[0]?.points.map((p, i) => {
                        const label = p.label?.trim() || `Assessment ${i + 1}`;
                        return (
                          <th
                            key={`${p.ordinal}-${label}`}
                            className="px-3 py-3 text-center"
                          >
                            {label}
                          </th>
                        );
                      })}
                      <th className="px-3 py-3 text-center">Overall Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attainmentBySubject.map(({ subject, points }) => {
                      const scores = points.map((p) => p.normalizedScore).filter((s): s is number => s !== null);
                      const first = scores[0] ?? null;
                      const last = scores[scores.length - 1] ?? null;
                      const delta =
                        first !== null && last !== null && scores.length > 1 ? last - first : null;
                      const deltaColour =
                        delta === null
                          ? "text-muted"
                          : delta > 0.05
                            ? "text-scale-strong-text font-medium"
                            : delta < -0.05
                              ? "text-red-600 font-medium"
                              : "text-muted";

                      const cellHover =
                        "transition-colors group-hover/assessment-row:bg-[var(--surface-container-low)]";

                      return (
                        <tr
                          key={subject}
                          className="group/assessment-row table-row calm-transition hover:bg-transparent"
                        >
                          <td
                            className={`sticky-first-column z-[1] px-5 py-3 font-medium text-text shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)] ${cellHover}`}
                          >
                            {subject}
                          </td>
                          {points.map((p, i) => {
                            const prev = i > 0 ? points[i - 1].normalizedScore : null;
                            const curr = p.normalizedScore;
                            const colour =
                              curr === null
                                ? "text-muted"
                                : prev === null
                                  ? "text-text"
                                  : curr - prev > 0.05
                                    ? "text-scale-strong-text"
                                    : curr - prev < -0.05
                                      ? "text-red-600"
                                      : "text-text";
                            const label = p.label?.trim() || `Assessment ${i + 1}`;
                            return (
                              <td
                                key={`${p.ordinal}-${label}`}
                                className={`px-3 py-3 text-center tabular-nums font-semibold ${colour} ${cellHover}`}
                              >
                                {curr !== null ? (
                                  displayGrade(curr, p.gradeFormat, p.maxScore)
                                ) : (
                                  <span className="font-normal text-muted">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td
                            className={`px-3 py-3 text-center text-xs tabular-nums ${deltaColour} ${cellHover}`}
                          >
                            {delta === null
                              ? "—"
                              : `${delta > 0 ? "▲" : delta < 0 ? "▼" : "="} ${Math.abs(Math.round(delta * 100))}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
            {activeCycle && attainmentBySubject.length > 0 ? (
              <div className="mt-4">
                <Link
                  href={`/assessments/${activeCycle.id}`}
                  className="link-accent text-sm font-medium calm-transition"
                >
                  View attainment cycle →
                </Link>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>

      {/* Snapshot history */}
      <Card>
        <SectionHeader title="Snapshot history" subtitle="Imported behaviour and attendance over time" />
        {chronSnapshots.length === 0 ? (
          <BodyText className="mt-4 text-muted">No rows to show.</BodyText>
        ) : (
          <div className="table-shell mt-4">
            <p className="sr-only" id="student-profile-snapshots-scroll-hint">
              This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
            </p>
            <div className="overflow-x-auto" aria-describedby="student-profile-snapshots-scroll-hint">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-4 py-3 text-left font-semibold tracking-[0.08em]">Date</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-[0.08em]">Attendance</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-[0.08em]">On calls</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-[0.08em]">Detentions</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-[0.08em]">Lateness</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-[0.08em]">Int. excl.</th>
                  <th className="px-4 py-3 text-right font-semibold tracking-[0.08em]">Susp.</th>
                </tr>
              </thead>
              <tbody>
                {chronSnapshots.map((s) => {
                  const pct = Number(s.attendancePct);
                  const pctOk = !Number.isNaN(pct);
                  return (
                    <tr key={s.id} className="table-row calm-transition">
                      <td className="px-4 py-3.5 text-muted">{fmtDate(s.snapshotDate)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-medium text-text">
                        {pctOk ? `${pct.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-text">{s.onCallsCount}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-text">{s.detentionsCount}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-text">{s.latenessCount}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-text">
                        {s.internalExclusionsCount}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-text">{s.suspensionsCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Change flags" subtitle="Automated alerts from snapshot deltas" />
          {(student.changeFlags as any[]).length === 0 ? (
            <BodyText className="mt-4 text-muted">No flags recorded.</BodyText>
          ) : (
            <ul className="mt-4 space-y-3">
              {(student.changeFlags as any[]).map((f: any) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3"
                >
                  <span className="font-medium text-text">{f.flagKey}</span>
                  <StatusPill
                    variant={f.severity === "URGENT" ? "error" : f.severity === "PRIORITY" ? "warning" : "neutral"}
                    size="sm"
                  >
                    {f.severity}
                  </StatusPill>
                  <StatusPill variant={f.resolvedAt ? "success" : "info"} size="sm">
                    {f.resolvedAt ? "Resolved" : "Open"}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader title="On-call log" subtitle="Recent requests" />
          {(student.onCallRequests as any[]).length === 0 ? (
            <BodyText className="mt-4 text-muted">No on-call entries.</BodyText>
          ) : (
            <ul className="mt-4 space-y-3">
              {(student.onCallRequests as any[]).map((oc: any) => (
                <li
                  key={oc.id}
                  className="rounded-xl bg-surface-container-low px-4 py-3 text-sm leading-relaxed text-text"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {fmtDate(oc.createdAt)}
                    </span>
                    <span className="font-medium">{oc.requestType}</span>
                    <StatusPill variant="neutral" size="sm">
                      {oc.status}
                    </StatusPill>
                  </div>
                  <MetaText className="mt-1 !text-[13px] !text-muted">
                    {[oc.location, oc.behaviourReasonCategory].filter(Boolean).join(" · ") || "—"}
                  </MetaText>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
