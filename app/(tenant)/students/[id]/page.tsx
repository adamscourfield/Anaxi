import Link from "next/link";
import { notFound } from "next/navigation";
import type { GradeFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { H2, MetaText, BodyText } from "@/components/ui/typography";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { displayGrade, hasRecordedGrade } from "@/modules/assessments/gradeNormalizer";
import { canViewStudentAnalysis, canViewTeacherAnalysis } from "@/modules/authz";
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
  const color = value > 0 ? "text-scale-limited-text" : value < 0 ? "text-scale-strong-text" : "text-muted";
  return (
    <span className={`tabular-nums font-medium ${color}`}>
      {value > 0 ? `+${value}` : String(value)}
    </span>
  );
}

const TEACHER_ROW_THEMES = [
  { well: "bg-[rgba(99,102,241,0.14)] text-[#4f46e5]", dot: "bg-[#6366f1]" },
  { well: "bg-[rgba(16,185,129,0.14)] text-[#059669]", dot: "bg-[#059669]" },
  { well: "bg-[rgba(59,130,246,0.14)] text-[#2563eb]", dot: "bg-[#2563eb]" },
  { well: "bg-[rgba(245,158,11,0.16)] text-[#b45309]", dot: "bg-[#d97706]" },
] as const;

function teacherThemeIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % TEACHER_ROW_THEMES.length;
}

type GroupedSubjectTeacher = {
  teacherId: string;
  fullName: string;
  email: string | null;
  subjects: string[];
};

function groupSubjectTeachers(rows: any[]): GroupedSubjectTeacher[] {
  const map = new Map<string, { fullName: string; email: string | null; subjects: Set<string> }>();
  for (const x of rows) {
    const tid = x.teacher?.id ?? "";
    if (!tid) continue;
    const name = x.teacher?.fullName ?? "Unknown";
    const email = (x.teacher?.email as string | null) ?? null;
    if (!map.has(tid)) {
      map.set(tid, { fullName: name, email, subjects: new Set() });
    }
    const entry = map.get(tid)!;
    if (email && !entry.email) entry.email = email;
    const subj = x.subject?.name;
    if (subj) entry.subjects.add(subj);
  }
  return [...map.entries()]
    .map(([teacherId, v]) => ({
      teacherId,
      fullName: v.fullName,
      email: v.email,
      subjects: [...v.subjects].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));
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
        include: { subject: true, teacher: { select: { id: true, fullName: true, email: true } } },
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

  const groupedTeachers = groupSubjectTeachers(student.subjectTeachers as any[]);

  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
      select: { departmentId: true },
    }),
    (prisma as any).coachAssignment.findMany({
      where: { coachUserId: user.id },
      select: { coacheeUserId: true },
    }),
  ]);
  const hodDepartmentIds = (hodMemberships as { departmentId: string }[]).map((m) => m.departmentId);
  const coacheeUserIds = (coachAssignments as { coacheeUserId: string }[]).map((a) => a.coacheeUserId);
  const viewerContext = {
    userId: user.id,
    role: user.role,
    hodDepartmentIds,
    coacheeUserIds,
  };

  const teacherIdsForProfile = groupedTeachers.map((t) => t.teacherId);
  const teacherDeptRows =
    teacherIdsForProfile.length > 0
      ? await (prisma as any).departmentMembership.findMany({
          where: { userId: { in: teacherIdsForProfile } },
          select: { userId: true, departmentId: true },
        })
      : [];
  const teacherDepartmentIdsByUser = new Map<string, string[]>();
  for (const r of teacherDeptRows as { userId: string; departmentId: string }[]) {
    if (!teacherDepartmentIdsByUser.has(r.userId)) teacherDepartmentIdsByUser.set(r.userId, []);
    teacherDepartmentIdsByUser.get(r.userId)!.push(r.departmentId);
  }

  return (
    <div className="space-y-8">
      <Link href={backHref} className="anx-link-back calm-transition">
        <span aria-hidden>←</span> {backLabel}
      </Link>

      <header className="anx-page-header-shell">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-container-high)] text-base font-bold tracking-tight text-text ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)]"
              aria-hidden
            >
              {getInitials(student.fullName)}
            </div>
            <div className="min-w-0">
              <h1 className="anx-page-title break-words">{student.fullName}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {student.yearGroup ? (
                  <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Year {student.yearGroup}
                  </span>
                ) : null}
                <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {statusLabel}
                </span>
                {student.sendFlag ? (
                  <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    SEND
                  </span>
                ) : null}
                {student.ppFlag ? (
                  <span className="rounded-full bg-[var(--surface-container-high)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                    PP
                  </span>
                ) : null}
              </div>
              <p className="anx-page-subtitle mt-2 !text-[13px] !leading-relaxed">
                {student.upn ? `UPN ${student.upn}` : "No UPN on record"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {student.status === "ACTIVE" ? (
              <form action={archiveStudentAction}>
                <input type="hidden" name="studentId" value={student.id} />
                <input type="hidden" name="returnTo" value={`/students/${student.id}`} />
                <Button type="submit" variant="secondary" className="rounded-full border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--secondary-container)] px-5 shadow-sm hover:bg-[var(--surface-container-high)]">
                  Archive student
                </Button>
              </form>
            ) : (
              <form action={unarchiveStudentAction}>
                <input type="hidden" name="studentId" value={student.id} />
                <input type="hidden" name="returnTo" value={`/students/${student.id}`} />
                <Button type="submit" variant="secondary" className="rounded-full border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--secondary-container)] px-5 shadow-sm hover:bg-[var(--surface-container-high)]">
                  Restore student
                </Button>
              </form>
            )}
          </div>
        </div>
      </header>

      {/* Latest behaviour snapshot */}
      {latestSnapshot && attDisplay !== null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="home-hero-glass rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] p-5 shadow-[var(--anx-elevated-shadow)] sm:p-6">
            <p className="anx-label-micro">Attendance</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="text-2xl font-bold tabular-nums tracking-[-0.03em] text-text">{attDisplay}%</span>
              <span className="text-xs font-medium text-muted">{fmtDate(latestSnapshot.snapshotDate)}</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-container-high)]">
              <div
                className={`h-full rounded-full ${attendanceBarColor(attPct)} home-stat-bar-fill`}
                style={{ width: `${Math.min(100, Math.max(0, attPct!))}%` }}
              />
            </div>
          </div>
          <div className="home-hero-glass rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] p-5 shadow-[var(--anx-elevated-shadow)] sm:p-6">
            <p className="anx-label-micro">On calls</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-[-0.03em] text-text">{latestSnapshot.onCallsCount}</p>
          </div>
          <div className="home-hero-glass rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] p-5 shadow-[var(--anx-elevated-shadow)] sm:p-6">
            <p className="anx-label-micro">Detentions</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-[-0.03em] text-text">{latestSnapshot.detentionsCount}</p>
          </div>
          <div className="home-hero-glass rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] p-5 shadow-[var(--anx-elevated-shadow)] sm:p-6">
            <p className="anx-label-micro">Lateness</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-[-0.03em] text-text">{latestSnapshot.latenessCount}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[var(--anx-elevated-shadow)]">
          <BodyText className="text-muted">No behaviour snapshot imported yet for this student.</BodyText>
        </div>
      )}

      {analysisProfile ? (
        <div className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[var(--anx-elevated-shadow)] sm:p-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] pb-4">
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
                          analysisProfile.attendanceDelta < 0 ? "text-scale-limited-text" : "text-scale-strong-text"
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
              <Button variant={analysisProfile.onWatchlist ? "primary" : "secondary"} type="submit" className="rounded-full px-5">
                {analysisProfile.onWatchlist ? "★ On watchlist" : "Add to watchlist"}
              </Button>
            </form>
            <Link href={`/analytics?tab=students&window=${windowDays}`} className="link-accent text-sm">
              Open student support priorities →
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Teachers */}
        <div className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[var(--anx-elevated-shadow)] sm:p-8">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">Teachers</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">Current subject assignments</p>
          </div>

          {groupedTeachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] bg-[var(--surface-container-low)]/40 px-6 py-14 text-center">
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-container-high)] text-muted ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]"
                aria-hidden
              >
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-text">No subject teachers linked.</p>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
                When teachers are assigned to subjects, they&apos;ll appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] bg-[var(--surface-container-lowest)]">
              {groupedTeachers.map((row) => {
                const theme = TEACHER_ROW_THEMES[teacherThemeIndex(row.teacherId)];
                const subjectLine = row.subjects.join(", ");
                const teacherDepartmentIds = teacherDepartmentIdsByUser.get(row.teacherId) ?? [];
                const canOpenStaffProfile =
                  analysisFeature?.enabled &&
                  canViewTeacherAnalysis(viewerContext, {
                    teacherUserId: row.teacherId,
                    teacherDepartmentIds,
                  });
                const profileHref = `/analysis/teachers/${row.teacherId}?window=${windowDays}`;
                const rowClass =
                  "flex items-center gap-4 px-4 py-4 calm-transition hover:bg-[color-mix(in_srgb,var(--surface-container-low)_55%,transparent)] sm:px-5";
                const inner = (
                  <>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${theme.well}`}>
                      {getInitials(row.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tracking-[-0.01em] text-text">{row.fullName}</p>
                      <p className="mt-1 flex items-start gap-2 text-xs leading-snug text-muted">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${theme.dot}`} aria-hidden />
                        <span>{subjectLine}</span>
                      </p>
                      {row.email ? (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          <svg className="h-3.5 w-3.5 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                          </svg>
                          <span className="truncate">{row.email}</span>
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-muted/40" aria-hidden>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </>
                );
                return canOpenStaffProfile ? (
                  <Link
                    key={row.teacherId}
                    href={profileHref}
                    aria-label={`Open staff profile for ${row.fullName}`}
                    className={`${rowClass} outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_30%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-container-lowest)]`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={row.teacherId} className={rowClass}>
                    {inner}
                  </div>
                );
              })}
            </div>
          )}

          <Link
            href="/students/import-subject-teachers"
            className="mt-5 flex items-start gap-3 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] bg-[var(--surface-container-low)]/50 p-4 calm-transition hover:border-[color-mix(in_srgb,var(--outline-variant)_65%,transparent)] hover:bg-[var(--surface-container-low)]/80 sm:p-5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-lowest)] text-muted">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-sm font-semibold text-text">Assign teachers to more subjects</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                Link teachers to additional subjects via CSV import to see their impact.
              </span>
            </span>
          </Link>
        </div>

        {/* Assessments */}
        {assessmentsFeature?.enabled ? (
          <div className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-[var(--anx-elevated-shadow)] sm:p-8">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">Assessments</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {activeCycle ? `Active cycle: ${activeCycle.label}` : "No active assessment cycle"}
                </p>
              </div>
              <Link href="/assessments" className="shrink-0 text-sm font-semibold text-accent underline underline-offset-2 calm-transition hover:text-accentHover">
                Open assessments →
              </Link>
            </div>

            {!activeCycle ? (
              <BodyText className="text-muted">Set an active cycle under Assessments to see results here.</BodyText>
            ) : attainmentBySubject.length === 0 ? (
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] bg-[var(--surface-container-low)]/35 p-8">
                <EmptyState
                  mode="embedded"
                  title="No assessment results"
                  description="This student has no marks recorded in the active cycle yet."
                />
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)]">
                  <p className="sr-only" id="student-profile-assessments-scroll-hint">
                    This table scrolls horizontally on small screens. Use touch or trackpad to see all columns.
                  </p>
                  <div className="overflow-x-auto" aria-describedby="student-profile-assessments-scroll-hint">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] bg-[var(--surface-container-low)]">
                          <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Subject</th>
                          {attainmentBySubject[0]?.points.map((p, i) => {
                            const label = p.label?.trim() || `Assessment ${i + 1}`;
                            return (
                              <th key={`${p.ordinal}-${label}`} className="px-3 py-3.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                                {label}
                              </th>
                            );
                          })}
                          <th className="px-3 py-3.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Overall Δ</th>
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
                                ? "text-[var(--success)] font-semibold"
                                : delta < -0.05
                                  ? "text-scale-limited-text font-semibold"
                                  : "text-text font-medium";

                          return (
                            <tr
                              key={subject}
                              className="border-b border-[color-mix(in_srgb,var(--outline-variant)_12%,transparent)] last:border-b-0 calm-transition hover:bg-[color-mix(in_srgb,var(--surface-container-low)_35%,transparent)]"
                            >
                              <td className="px-5 py-3.5 font-medium text-text">{subject}</td>
                              {points.map((p, i) => {
                                const prev = i > 0 ? points[i - 1].normalizedScore : null;
                                const curr = p.normalizedScore;
                                const colour =
                                  curr === null
                                    ? "text-muted"
                                    : prev === null
                                      ? "text-text"
                                      : curr - prev > 0.05
                                        ? "text-[var(--success)] font-semibold"
                                        : curr - prev < -0.05
                                          ? "text-scale-limited-text font-semibold"
                                          : "text-text font-medium";
                                const label = p.label?.trim() || `Assessment ${i + 1}`;
                                return (
                                  <td key={`${p.ordinal}-${label}`} className={`px-3 py-3.5 text-center tabular-nums ${colour}`}>
                                    {curr !== null ? (
                                      displayGrade(curr, p.gradeFormat, p.maxScore)
                                    ) : (
                                      <span className="font-normal text-muted">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className={`px-3 py-3.5 text-center text-xs tabular-nums ${deltaColour}`}>
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
                <div className="mt-5">
                  <Link
                    href={`/assessments/${activeCycle.id}`}
                    className="text-sm font-semibold text-accent underline underline-offset-2 calm-transition hover:text-accentHover"
                  >
                    View attainment cycle →
                  </Link>
                </div>
              </>
            )}
          </div>
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
