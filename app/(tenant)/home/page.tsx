import Link from "next/link";
import type { ReactNode } from "react";
import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { BodyText, MetaText } from "@/components/ui/typography";
import { StatusPill, PillVariant } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { CpdPriorityRow } from "@/modules/analysis/cpdPriorities";
import {
  computeTeacherSignalProfile,
  TeacherRiskRow,
  RiskStatus,
} from "@/modules/analysis/teacherRisk";
import { StudentRiskRow } from "@/modules/analysis/studentRisk";
import { CohortPivotRow } from "@/modules/analysis/cohortPivot";
import { UserRole } from "@/lib/types";
import { cookies } from "next/headers";
import { assembleHomeCards } from "@/modules/home/assembler";
import { resolveHomeVariant, showsInsightWindow } from "@/modules/home/roleVariant";
import { homeHeaderCopy } from "@/modules/home/headerCopy";
import { buildLeadershipAttentionItems, buildHodAttentionItems } from "@/modules/home/buildAttention";
import { AttentionStrip } from "@/components/home/AttentionStrip";
import { HomePageTitle } from "@/components/home/HomePageTitle";
import { LeadershipTodayBar, type TodaySummaryChip } from "@/components/home/LeadershipTodayBar";
import { ExplorerPromoBand } from "@/components/home/ExplorerPromoBand";
import {
  AttainmentSummaryCard,
  CohortChangeCard,
  MeetingsTodayCard,
  PositiveMomentumCard,
} from "@/components/home/LeadershipExtras";
import { CoacheePrioritiesCard } from "@/components/home/CoachHomeSections";
import { MeetingsTodayList } from "@/components/home/MeetingsTodayList";
import {
  hydrateLeadershipHomeData,
  hydrateHodHomeData,
  hydrateTeacherHomeData,
  hydrateCoachHomeData,
  hydrateHodAttentionContext,
  fetchBehaviourHeatmapMatrix,
  fetchDashboardAttainmentKPIs,
  PendingLeaveDetail,
  OnCallDetail,
  AttainmentSummary,
  DualFlaggedStudent,
  BehaviourHeatmapData,
} from "@/modules/home/hydration";
import { BehaviourHeatmap } from "@/components/dashboard/BehaviourHeatmap";
import { Button } from "@/components/ui/button";
import {
  HomeCardHeading,
  HomeCardHeadingSm,
  HomeEmptyPanel,
  HomePrimaryLink,
  IconBell,
  IconBolt,
  IconCalendar,
  IconChartBar,
  IconClipboard,
  IconFlagOutline,
  IconPhone,
  IconSparkles,
  IconStar,
  IconTrendDown,
  IconTrendUp,
  IconUmbrella,
  IconUsersTwo,
} from "@/components/home/home-chrome";
import { ppTableBadgeClass, sendTableBadgeClass } from "@/modules/assessments/attainmentColours";

const DEFAULT_WINDOW_DAYS = 21;
const ALLOWED_WINDOW_DAYS = [7, 14, 21, 28];

function studentAnalysisHref(studentId: string, windowDays: number): string {
  const from = encodeURIComponent(`/home`);
  return `/analysis/students/${studentId}?window=${windowDays}&from=${from}`;
}

/** Year-group pill — neutral grey chip (Attainment dual-flagged row) */
const yearGroupPillClass =
  "inline-flex shrink-0 items-center rounded-md bg-[var(--surface-container)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.02em] text-muted";

function DualFlaggedRiskBadge({ band }: { band: string }) {
  if (band === "URGENT") {
    return (
      <StatusPill variant="error" size="sm">
        Urgent
      </StatusPill>
    );
  }
  if (band === "PRIORITY") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-md border border-[#FDBA74] bg-[rgba(255,165,0,0.1)] px-2.5 py-1 text-[11px] font-semibold text-[#92400E]">
        Priority
      </span>
    );
  }
  return (
    <StatusPill variant="neutral" size="sm">
      {band}
    </StatusPill>
  );
}

const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  SIGNIFICANT_DRIFT: "Significant",
  EMERGING_DRIFT: "Emerging",
  STABLE: "Stable",
  LOW_COVERAGE: "Low coverage",
};

const RISK_STATUS_PILL: Record<RiskStatus, PillVariant> = {
  SIGNIFICANT_DRIFT: "error",
  EMERGING_DRIFT: "warning",
  STABLE: "success",
  LOW_COVERAGE: "neutral",
};

type MeetingActionSummary = { id: string; description: string; dueDate: string | null; status: string };
type LoaSummary = { startDate: string; endDate: string; status: string };
type OnCallSummary = { id: string; createdAt: string; status: string };

/** Observation signals use a 1–4 rubric (LIMITED … STRONG); means are averages on that scale. */
const OBS_RUBRIC_MIN = 1;
const OBS_RUBRIC_MAX = 4;
const OBS_RUBRIC_SPAN = OBS_RUBRIC_MAX - OBS_RUBRIC_MIN;

function formatSignalRubricMean(mean: number): string {
  const rounded = Math.round(mean * 10) / 10;
  return `${rounded.toFixed(1)}/4`;
}

function signalRubricMeanBarWidthPct(mean: number): number {
  const pct = ((mean - OBS_RUBRIC_MIN) / OBS_RUBRIC_SPAN) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

function formatSignalRubricDelta(delta: number): string {
  const rounded = Math.round(delta * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)}`;
}

function signalRubricDeltaBarWidthPct(delta: number): number {
  const pct = (Math.abs(delta) / OBS_RUBRIC_SPAN) * 100;
  return Math.round(Math.min(100, pct));
}


const INSIGHT_WINDOW_COOKIE = "anaxi_insight_window";

function leaveGovernanceQuarterLabel(): string {
  const month = new Date().getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter}`;
}

function leaveSubmissionLabel(createdAt: string): string {
  const d = new Date(createdAt);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "Today";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const LEAVE_SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function leaveDateRangeLabel(startDate: string, endDate: string): string {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const same =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const mon = (d: Date) => LEAVE_SHORT_MONTHS[d.getMonth()];
  if (same) return `${mon(s)} ${s.getDate()}`;
  const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
  if (sameMonth) return `${mon(s)} ${s.getDate()} - ${e.getDate()}`;
  return `${mon(s)} ${s.getDate()} - ${mon(e)} ${e.getDate()}`;
}

function LeaveCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function formatRelativeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 120) return `${sec}s ago`;
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}


function LeadershipHome({
  windowDays,
  cpdRows,
  teacherRows,
  cohortRows,
  studentRows,
  hasLeaveFeature,
  pendingLeaveCount,
  pendingLeaveDetails,
  liveOnCallBanner,
  weekObsCount,
  weekObsTeachers,
  attainmentSummary,
  hasStudentAnalysisFeature,
  watchlistStudents,
  behaviourHeatmap,
  topImproving,
  meetingsTodayCount,
  attainmentKpis,
}: {
  windowDays: number;
  cpdRows: CpdPriorityRow[];
  teacherRows: TeacherRiskRow[];
  cohortRows: CohortPivotRow[];
  studentRows: StudentRiskRow[];
  hasLeaveFeature: boolean;
  pendingLeaveCount: number;
  pendingLeaveDetails: PendingLeaveDetail[];
  liveOnCallBanner: { count: number; latest: OnCallDetail | null };
  weekObsCount: number;
  weekObsTeachers: { id: string; name: string }[];
  attainmentSummary: AttainmentSummary | null;
  hasStudentAnalysisFeature?: boolean;
  watchlistStudents?: StudentRiskRow[];
  behaviourHeatmap: BehaviourHeatmapData | null;
  topImproving: CpdPriorityRow[];
  meetingsTodayCount: number;
  attainmentKpis: Awaited<ReturnType<typeof fetchDashboardAttainmentKPIs>>;
}) {
  const allDriftingCpd = cpdRows.filter((r) => r.teachersDriftingDown > 0);
  const topCpd = allDriftingCpd.slice(0, 3);

  // Attendance: compute school-wide average from cohort data
  const cohortWithAttendance = cohortRows.filter((r) => r.attendanceMean !== null);
  const attendancePct =
    cohortWithAttendance.length > 0
      ? cohortWithAttendance.reduce((sum, r) => sum + (r.attendanceMean ?? 0), 0) / cohortWithAttendance.length
      : null;
  const attendanceDelta =
    cohortWithAttendance.length > 0
      ? cohortWithAttendance.reduce((sum, r) => sum + (r.attendanceDelta ?? 0), 0) / cohortWithAttendance.length
      : null;

  // Staff needing intervention (SIGNIFICANT_DRIFT or EMERGING_DRIFT)
  const allInterventionStaff = teacherRows.filter(
    (r) => r.status === "SIGNIFICANT_DRIFT" || r.status === "EMERGING_DRIFT"
  );
  const interventionStaff = allInterventionStaff.slice(0, 3);
  const interventionBannerDetail = allInterventionStaff.some((r) => r.status === "SIGNIFICANT_DRIFT")
    ? "Significant negative drift"
    : "Emerging support signals";

  // Watchlist students (prefer explicitly-provided watchlist rows, otherwise derive from student rows)
  const bandOrder: Record<string, number> = { URGENT: 0, PRIORITY: 1, WATCH: 2, STABLE: 3 };
  const derivedWatchlistStudents = studentRows
    .filter((r) => r.onWatchlist)
    .sort((a, b) => (bandOrder[a.band] ?? 9) - (bandOrder[b.band] ?? 9));
  const effectiveWatchlistStudents = watchlistStudents ?? derivedWatchlistStudents;

  const attentionItems = buildLeadershipAttentionItems({
    liveOnCallCount: liveOnCallBanner.count,
    latestLiveOnCall: liveOnCallBanner.latest,
    interventionCount: allInterventionStaff.length,
    interventionDetailLabel: interventionBannerDetail,
    attendanceDelta,
    pendingLeaveCount,
    windowDays,
  });

  const todayChips: TodaySummaryChip[] = [
    ...(liveOnCallBanner.count > 0
      ? [{ label: "On-call", value: liveOnCallBanner.count, href: "/on-call", tone: "critical" as const }]
      : []),
    ...(allInterventionStaff.length > 0
      ? [{
          label: "Intervention",
          value: allInterventionStaff.length,
          href: `/analytics?tab=teachers&window=${windowDays}`,
          tone: "critical" as const,
        }]
      : []),
    ...(pendingLeaveCount > 0
      ? [{ label: "Leave", value: pendingLeaveCount, href: "/leave#pending-requests", tone: "warning" as const }]
      : []),
    { label: "Obs this week", value: weekObsCount, href: "/explorer/observations" },
    ...(meetingsTodayCount > 0 ? [{ label: "Meetings", value: meetingsTodayCount, href: "/meetings" }] : []),
  ];

  return (
    <div className="w-full min-w-0 space-y-8">
      <LeadershipTodayBar chips={todayChips} />
      <AttentionStrip items={attentionItems} />
      <ExplorerPromoBand windowDays={windowDays} />

      {/* ═══ Staff Signals + Operations ═══ */}
      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.6fr)] lg:items-start">
        {/* Left: Staff signals — CPD priorities + intervention combined */}
        <Card className="flex min-h-0 flex-col gap-6 rounded-sm !p-6 shadow-none">
          <HomeCardHeading
            icon={<IconUsersTwo />}
            iconTileClassName="bg-[var(--tertiary-container)] text-[var(--on-primary)] shadow-none [&_svg]:text-[var(--on-primary)]"
            title="Staff signals"
            subtitle={`CPD drift and intervention — ${windowDays}-day window`}
            end={
              <Link href={`/analytics?tab=teachers&window=${windowDays}`} className="link-accent shrink-0 text-xs font-semibold">
                Full analytics →
              </Link>
            }
          />
          {topCpd.length === 0 && allInterventionStaff.length === 0 ? (
            <MetaText>All signals stable — no CPD drift or intervention needs detected this window.</MetaText>
          ) : (
            <div className="space-y-6">
              {topCpd.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">CPD priorities</p>
                  <div className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)]">
                    {topCpd.map((row) => (
                      <Link
                        key={row.signalKey}
                        href={`/analysis/cpd/${row.signalKey}?window=${windowDays}`}
                        className="home-row-link flex items-center gap-4 py-3 first:pt-0"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="text-sm font-medium text-text">{row.label}</p>
                          <div className="h-1 w-full overflow-hidden rounded-sm bg-[var(--surface-container)]">
                            <div
                              className="home-stat-bar-fill h-full rounded-sm bg-[var(--coral)]"
                              style={{ width: `${Math.min(Math.round(row.driftRate * 100), 100)}%` }}
                            />
                          </div>
                        </div>
                        <span className="shrink-0 tabular-nums text-sm font-bold text-text">
                          {Math.round(row.driftRate * 100)}%
                        </span>
                      </Link>
                    ))}
                  </div>
                  <Link
                    href={`/analytics?tab=cpd&window=${windowDays}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted calm-transition hover:text-text"
                  >
                    View full CPD breakdown →
                  </Link>
                </div>
              )}
              {topCpd.length > 0 && allInterventionStaff.length > 0 && (
                <div className="h-px bg-[color-mix(in_srgb,var(--outline-variant)_50%,transparent)]" aria-hidden />
              )}
              {allInterventionStaff.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Intervention needed</p>
                  <ul className="space-y-1">
                    {interventionStaff.map((row) => (
                      <li key={row.teacherMembershipId}>
                        <Link
                          href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                          className="home-row-link flex items-center justify-between gap-2 p-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={row.teacherName} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-text truncate">{row.teacherName}</p>
                              <p className="text-[11px] text-muted">{row.departmentNames.join(", ") || "No dept"}</p>
                            </div>
                          </div>
                          <StatusPill variant={RISK_STATUS_PILL[row.status]} size="sm">
                            {RISK_STATUS_LABELS[row.status]}
                          </StatusPill>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {allInterventionStaff.length > 3 && (
                    <Link
                      href={`/analytics?tab=teachers&window=${windowDays}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-muted calm-transition hover:text-text"
                    >
                      +{allInterventionStaff.length - 3} more →
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Right: Operations column */}
        <div className="flex flex-col gap-4">
          {/* Attendance */}
          <Card className="flex flex-col gap-3 rounded-sm !p-5 shadow-none">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Attendance</p>
              <Link
                href={`/analytics?tab=students&window=${windowDays}`}
                className="text-xs font-semibold text-[var(--primary)] calm-transition hover:opacity-80"
              >
                Report →
              </Link>
            </div>
            <p className="text-[2.25rem] font-bold leading-none tracking-[-0.04em] text-text tabular-nums">
              {attendancePct !== null ? `${attendancePct.toFixed(1)}%` : "—"}
            </p>
            {attendancePct !== null && (
              <div className="h-1.5 w-full overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--surface-container)_88%,transparent)]">
                <div
                  className="home-stat-bar-fill h-full rounded-sm bg-[var(--success)]"
                  style={{ width: `${Math.min(attendancePct, 100)}%` }}
                />
              </div>
            )}
            {attendanceDelta !== null && (
              <p className="flex flex-wrap items-center gap-1 text-[13px]">
                <span className={attendanceDelta >= 0 ? "text-positive" : "text-negative"}>
                  {attendanceDelta >= 0 ? <IconTrendUp className="inline h-3.5 w-3.5" /> : <IconTrendDown className="inline h-3.5 w-3.5" />}
                </span>
                <span className={`font-medium tabular-nums ${attendanceDelta >= 0 ? "text-positive" : "text-negative"}`}>
                  {attendanceDelta >= 0 ? "+" : ""}{attendanceDelta.toFixed(1)}%
                </span>
                <span className="text-muted">from last week</span>
              </p>
            )}
          </Card>

          {/* Observations this week */}
          <Card className="flex flex-col gap-3 rounded-sm !p-5 shadow-none">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Observations this week</p>
              <Link
                href="/explorer/observations"
                className="text-xs font-semibold text-[var(--primary)] calm-transition hover:opacity-80"
              >
                View all →
              </Link>
            </div>
            <p className="text-[2.25rem] font-bold leading-none tracking-[-0.04em] text-text tabular-nums">
              {weekObsCount}
            </p>
            {weekObsTeachers.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {weekObsTeachers.slice(0, 4).map((t) => (
                  <Avatar key={t.id} name={t.name} size="sm" />
                ))}
                {weekObsTeachers.length > 4 && (
                  <span className="inline-flex h-7 w-auto min-w-[28px] items-center justify-center rounded-md bg-[var(--primary)] px-1.5 text-[10px] font-semibold text-on-primary shadow-sm">
                    +{weekObsTeachers.length - 4}
                  </span>
                )}
              </div>
            )}
          </Card>

          <MeetingsTodayCard count={meetingsTodayCount} />

          {/* Live on-call — only rendered when there are active escalations */}
          {liveOnCallBanner.count > 0 && (
            <Link href="/on-call" className="block">
              <div className="flex items-center gap-3 rounded-sm border border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[color-mix(in_srgb,var(--error)_04%,var(--surface-container-lowest))] px-4 py-3.5 calm-transition hover:bg-[color-mix(in_srgb,var(--error)_07%,var(--surface-container-lowest))]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--error)]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--error)]">
                    {liveOnCallBanner.count} live escalation{liveOnCallBanner.count === 1 ? "" : "s"}
                  </p>
                  {liveOnCallBanner.latest && (
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {liveOnCallBanner.latest.requesterName} · {formatRelativeShort(liveOnCallBanner.latest.createdAt)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs font-semibold text-[var(--error)]" aria-hidden>→</span>
              </div>
            </Link>
          )}

          {/* Pending leave — only rendered when approvals are waiting */}
          {hasLeaveFeature && pendingLeaveCount > 0 && (
            <Link href="/leave#pending-requests" className="block">
              <div className="flex items-center gap-3 rounded-sm border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-low)] px-4 py-3.5 calm-transition hover:bg-[var(--surface-container)]">
                <IconUmbrella className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">
                    {pendingLeaveCount} leave approval{pendingLeaveCount === 1 ? "" : "s"} pending
                  </p>
                  <p className="text-xs text-muted">Cover decisions waiting</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted" aria-hidden>→</span>
              </div>
            </Link>
          )}
        </div>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-2">
        <CohortChangeCard cohortRows={cohortRows} windowDays={windowDays} />
        <PositiveMomentumCard topImproving={topImproving} windowDays={windowDays} />
      </section>

      <AttainmentSummaryCard rows={attainmentKpis} windowDays={windowDays} />

      {/* ═══ Behaviour Heatmap ═══ */}
      {behaviourHeatmap && (
        <section className="grid min-w-0 gap-5 lg:grid-cols-1 lg:items-stretch">
          <Card className="rounded-sm !p-6 shadow-none">
            <BehaviourHeatmap
              yearGroups={behaviourHeatmap.yearGroups}
              columnLabels={behaviourHeatmap.columnLabels}
              matrix={behaviourHeatmap.matrix}
              incidents={behaviourHeatmap.incidents}
              ctaHref={`/explorer/analysis?windowDays=${windowDays}#behaviour-heatmap`}
              ctaLabel="View full map"
            />
          </Card>
        </section>
      )}

      {/* ═══ Watchlist ═══ */}
      {hasStudentAnalysisFeature && effectiveWatchlistStudents.length > 0 && (
        <Card className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-container)] text-scale-some-text [&_svg]:h-4 [&_svg]:w-4">
                <IconStar />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-[-0.01em] text-text">Your watchlist</h2>
                <p className="text-xs text-muted">
                  {effectiveWatchlistStudents.length} student{effectiveWatchlistStudents.length !== 1 ? "s" : ""} being monitored
                </p>
              </div>
            </div>
            <Link href="/analytics?watchlist=1" className="link-accent shrink-0 text-sm">
              View all →
            </Link>
          </div>

          {/* Horizontal scroll track */}
          <div className="-mx-5 px-5">
            <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {effectiveWatchlistStudents.map((s) => {
                const bandCfg = {
                  URGENT: {
                    bar: "bg-[var(--error)]",
                    tint: "bg-status-denied-light/70",
                    badge: "text-status-denied-text bg-status-denied-light/80",
                    label: "Urgent",
                  },
                  PRIORITY: {
                    bar: "bg-[var(--warning)]",
                    tint: "bg-scale-some-light/60",
                    badge: "text-scale-some-text bg-scale-some-light/80",
                    label: "Priority",
                  },
                  WATCH: {
                    bar: "bg-[var(--accent)]",
                    tint: "bg-cat-indigo-bg/50",
                    badge: "text-[var(--accent)] bg-cat-indigo-bg/70",
                    label: "Watch",
                  },
                  STABLE: {
                    bar: "bg-[var(--success)]",
                    tint: "bg-status-approved-light/50",
                    badge: "text-status-approved-text bg-status-approved-light/70",
                    label: "Stable",
                  },
                }[s.band] ?? {
                  bar: "bg-[var(--accent)]",
                  tint: "bg-cat-indigo-bg/50",
                  badge: "text-[var(--accent)] bg-cat-indigo-bg/70",
                  label: s.band,
                };

                return (
                  <Link
                    key={s.studentId}
                    href={`/analysis/students/${s.studentId}?window=${windowDays}`}
                    className={`home-card-tile group flex min-w-[176px] max-w-[196px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] ${bandCfg.tint}`}
                  >
                    {/* Risk band colour bar */}
                    <div className={`h-1.5 w-full ${bandCfg.bar}`} />

                    <div className="flex flex-1 flex-col gap-2.5 p-3.5">
                      {/* Name + band badge */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug text-text">{s.studentName}</p>
                        <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${bandCfg.badge}`}>
                          {bandCfg.label}
                        </span>
                      </div>

                      {/* Year + flags */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.yearGroup && <span className="text-[11px] text-muted">{s.yearGroup}</span>}
                        {s.ppFlag && <span className={ppTableBadgeClass}>PP</span>}
                        {s.sendFlag && <span className={sendTableBadgeClass}>SEND</span>}
                      </div>

                      {/* Attendance stat */}
                      {s.attendancePct !== null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted">Attendance</span>
                          <span
                            className={`text-[11px] font-bold ${
                              s.attendancePct < 85
                                ? "text-[var(--error)]"
                                : s.attendancePct < 90
                                ? "text-scale-some-text"
                                : "text-[var(--success)]"
                            }`}
                          >
                            {s.attendancePct.toFixed(1)}%
                          </span>
                        </div>
                      )}

                      {/* Driver chips */}
                      {s.drivers.length > 0 ? (
                        <div className="mt-auto flex flex-wrap gap-1 pt-0.5">
                          {s.drivers.slice(0, 3).map((d) => (
                            <span
                              key={d.metric}
                              className="rounded-md bg-white/70 px-2 py-0.5 text-[10px] font-medium text-text/70 ring-1 ring-inset ring-black/[0.06]"
                            >
                              {d.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-auto pt-0.5 text-[11px] text-muted/60">No active signals</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ═══ Dual-flagged students ═══ */}
      {attainmentSummary && attainmentSummary.topDualFlagged.length > 0 && (
        <Card className="space-y-4 rounded-sm !p-6 shadow-none">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <HomeCardHeadingSm
              icon={<IconFlagOutline className="text-[var(--error)]" />}
              title="Dual-flagged students"
              subtitle={`${attainmentSummary.triangulatedCount} with overlapping attainment and behavioural concerns${attainmentSummary.urgentCount > 0 ? ` · ${attainmentSummary.urgentCount} urgent` : ""}`}
            />
            <Link href="/assessments/triangulation" className="link-accent shrink-0 text-sm font-semibold">
              View all →
            </Link>
          </div>
          <ul className="space-y-1">
            {attainmentSummary.topDualFlagged.map((s: DualFlaggedStudent) => (
              <li key={s.studentId}>
                <Link
                  href={studentAnalysisHref(s.studentId, windowDays)}
                  className="home-row-link flex items-center gap-3 rounded-lg px-3 py-3"
                >
                  <Avatar name={s.studentName} size="md" tone="muted" />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-text">{s.studentName}</span>
                      {s.yearGroup ? <span className={yearGroupPillClass}>{s.yearGroup}</span> : null}
                      {s.ppFlag && <span className={ppTableBadgeClass}>PP</span>}
                      {s.sendFlag && <span className={sendTableBadgeClass}>SEND</span>}
                    </div>
                    <p className="mt-1 truncate text-[12px] leading-snug text-muted">
                      Lowest: {s.worstSubject} — {s.worstGrade}
                      {s.worstNormalizedScore !== null && ` (${Math.round(s.worstNormalizedScore * 100)}%)`}
                    </p>
                  </div>
                  <DualFlaggedRiskBadge band={s.behaviouralBand} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ═══ Leave governance — only shown when approvals are waiting ═══ */}
      {hasLeaveFeature && pendingLeaveDetails.length > 0 && (
        <section className="grid min-w-0 gap-5 lg:grid-cols-1 lg:items-stretch">
          <Card className="flex h-full min-h-0 flex-col gap-5 rounded-sm !p-6 shadow-none">
              <HomeCardHeading
                icon={<IconUmbrella />}
                title="Leave governance"
                subtitle={`Pending administrative approvals for ${leaveGovernanceQuarterLabel()}`}
                end={
                  <Link href="/leave#pending-requests" className="link-accent shrink-0 text-sm font-semibold">
                    View all →
                  </Link>
                }
              />

              <div className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_40%,transparent)] rounded-lg border border-[color-mix(in_srgb,var(--outline-variant)_28%,transparent)] bg-[var(--surface-container-lowest)]">
                  {pendingLeaveDetails.map((leave) => {
                    const reasonUpper = (leave.reasonLabel ?? "Personal").toUpperCase();
                    const isEmergency = reasonUpper.includes("EMERGENCY") || reasonUpper.includes("URGENT");
                    const isCpd = reasonUpper.includes("CPD") || reasonUpper.includes("TRAINING");
                    const pillVariant: PillVariant = isEmergency ? "error" : isCpd ? "accent" : "neutral";
                    const reasonDisplay = leave.reasonLabel?.trim() || (isEmergency ? "Emergency" : isCpd ? "CPD" : "Personal");
                    const rangeLabel = leaveDateRangeLabel(leave.startDate, leave.endDate);
                    return (
                      <div
                        key={leave.id}
                        className={`flex min-w-0 flex-col gap-3 p-4 calm-transition first:rounded-t-[13px] last:rounded-b-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4 ${
                          isEmergency ? "bg-[color-mix(in_srgb,var(--pill-error-bg)_40%,transparent)]" : ""
                        }`}
                      >
                        <Link
                          href={`/leave/${leave.id}`}
                          className="home-row-link flex min-w-0 flex-1 items-start gap-3 sm:items-center"
                        >
                          <Avatar name={leave.requesterName} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold tracking-[-0.01em] text-text">{leave.requesterName}</p>
                              <StatusPill variant={pillVariant} size="sm">{reasonDisplay}</StatusPill>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                              <span className="inline-flex items-center gap-1">
                                <IconCalendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {rangeLabel}
                              </span>
                              <span className="text-muted/80">Submitted {leaveSubmissionLabel(leave.createdAt)}</span>
                            </div>
                            {leave.notes ? (
                              <p className="mt-1.5 line-clamp-2 text-xs text-muted">&ldquo;{leave.notes}&rdquo;</p>
                            ) : null}
                          </div>
                        </Link>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
                          <Button variant="primary" asChild className="min-h-0 rounded-md px-4 py-2 text-xs">
                            <Link href={`/leave/${leave.id}`}>Review request</Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              <Link
                href="/leave"
                className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] calm-transition hover:opacity-80"
              >
                Go to leave calendar →
              </Link>
          </Card>
        </section>
      )}

    </div>
  );
}

function HodHome({
  windowDays,
  deptCpdRows,
  deptTeacherRows,
  deptName,
  deptId,
  selfProfile,
  wholeSchoolTop1,
  userId,
  allDepts,
  activeDeptId,
  attentionItems,
}: {
  windowDays: number;
  deptCpdRows: CpdPriorityRow[];
  deptTeacherRows: TeacherRiskRow[];
  deptName: string;
  deptId: string;
  selfProfile: Awaited<ReturnType<typeof computeTeacherSignalProfile>>;
  wholeSchoolTop1: CpdPriorityRow | null;
  userId: string;
  allDepts: { id: string; name: string }[];
  activeDeptId: string;
  attentionItems: import("@/modules/home/attentionItems").AttentionItem[];
}) {
  const allDeptDriftingCpd = deptCpdRows.filter((r) => r.teachersDriftingDown > 0);
  const topDeptCpd = allDeptDriftingCpd.slice(0, 2);
  const topDeptTeachers = deptTeacherRows
    .filter((r) => r.status === "SIGNIFICANT_DRIFT" || r.status === "EMERGING_DRIFT")
    .slice(0, 5);
  const deptObsCount = deptTeacherRows.reduce((sum, r) => sum + r.teacherCoverage, 0);

  return (
    <div className="w-full min-w-0 space-y-8">
      <AttentionStrip items={attentionItems} />
      <ExplorerPromoBand windowDays={windowDays} />
      {/* Dept switcher — navigation control, sits at top */}
      {allDepts.length > 1 && (
        <div className="segmented-toggle">
          {allDepts.map((d) => (
            <Link
              key={d.id}
              href={`/home?dept=${d.id}&window=${windowDays}`}
              className={`segmented-toggle-btn ${d.id === activeDeptId ? "segmented-toggle-btn-active" : ""}`}
            >
              {d.name}
            </Link>
          ))}
        </div>
      )}

      {/* ═══ Dept staff signals ═══ */}
      <Card className="flex min-h-0 flex-col gap-6 rounded-sm !p-6 shadow-none">
        <HomeCardHeading
          icon={<IconSparkles />}
          iconTileClassName="bg-[var(--tertiary-container)] text-[var(--on-primary)] shadow-none [&_svg]:text-[var(--on-primary)]"
          title={`${deptName} staff signals`}
          subtitle={`${windowDays}-day window · ${deptTeacherRows.length} teacher${deptTeacherRows.length !== 1 ? "s" : ""} · ${deptObsCount} observations`}
          end={
            <Link href={`/analytics?tab=teachers&window=${windowDays}&department=${deptId}`} className="link-accent shrink-0 text-xs font-semibold">
              Full analytics →
            </Link>
          }
        />

        {topDeptCpd.length === 0 && topDeptTeachers.length === 0 ? (
          <MetaText>No observation data for your department in this window.</MetaText>
        ) : (
          <div className="space-y-6">
            {topDeptCpd.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">CPD priorities</p>
                <div className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)]">
                  {topDeptCpd.map((row) => (
                    <Link
                      key={row.signalKey}
                      href={`/analysis/cpd/${row.signalKey}?window=${windowDays}&department=${deptId}`}
                      className="home-row-link flex items-center gap-4 py-3 first:pt-0"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-sm font-medium text-text">{row.label}</p>
                        <div className="h-1 w-full overflow-hidden rounded-sm bg-[var(--surface-container)]">
                          <div
                            className="home-stat-bar-fill h-full rounded-sm bg-[var(--coral)]"
                            style={{ width: `${Math.min(Math.round(row.driftRate * 100), 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 tabular-nums text-sm font-bold text-text">
                        {Math.round(row.driftRate * 100)}%
                      </span>
                    </Link>
                  ))}
                </div>
                <Link
                  href={`/analytics?tab=cpd&window=${windowDays}&department=${deptId}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-muted calm-transition hover:text-text"
                >
                  View full CPD breakdown →
                </Link>
              </div>
            )}

            {topDeptCpd.length > 0 && topDeptTeachers.length > 0 && (
              <div className="h-px bg-[color-mix(in_srgb,var(--outline-variant)_50%,transparent)]" aria-hidden />
            )}

            {topDeptTeachers.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Teacher priorities</p>
                <ul className="space-y-1">
                  {topDeptTeachers.map((row) => (
                    <li key={row.teacherMembershipId}>
                      <Link
                        href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                        className="home-row-link flex items-center justify-between gap-3 p-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={row.teacherName} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text truncate">{row.teacherName}</p>
                            <p className="text-[11px] text-muted">{row.teacherCoverage} obs</p>
                          </div>
                        </div>
                        <StatusPill variant={RISK_STATUS_PILL[row.status]} size="sm">
                          {RISK_STATUS_LABELS[row.status]}
                        </StatusPill>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ═══ Your observations ═══ */}
      <Card className="space-y-4 rounded-sm !p-6 shadow-none">
        <HomeCardHeadingSm
          icon={<IconChartBar className="text-[var(--info)]" />}
          title="Your recent observations"
          subtitle={
            selfProfile && selfProfile.teacherCoverage > 0
              ? `${selfProfile.teacherCoverage} observation${selfProfile.teacherCoverage !== 1 ? "s" : ""} in last ${windowDays} days${
                  selfProfile.lastObservationAt
                    ? ` · Last: ${new Date(selfProfile.lastObservationAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                    : ""
                }`
              : undefined
          }
          end={selfProfile && selfProfile.teacherCoverage > 0 ? <StatusPill variant="accent" size="sm">{selfProfile.teacherCoverage} obs</StatusPill> : null}
        />
        {!selfProfile || selfProfile.teacherCoverage === 0 ? (
          <HomeEmptyPanel
            icon={<IconClipboard className="text-muted" />}
            title="No observations yet"
            description="Start an observation to see your signal profile and trends here."
            action={<HomePrimaryLink href="/observe/new">Start an observation</HomePrimaryLink>}
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-sm bg-[var(--surface-container-low)] p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-status-approved-light text-[10px] text-status-approved-text">✓</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text">Strengths</span>
                </div>
                <div className="space-y-2.5">
                  {selfProfile.signals
                    .filter((s) => s.currentMean !== null)
                    .sort((a, b) => (b.currentMean ?? 0) - (a.currentMean ?? 0))
                    .slice(0, 3)
                    .map((sig) => (
                      <div key={sig.signalKey} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-medium text-text">{sig.label}</span>
                          <span className="text-[11px] font-bold text-scale-strong-text tabular-nums">
                            {sig.currentMean !== null ? formatSignalRubricMean(sig.currentMean) : "—"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-status-approved-light">
                          <div
                            className="home-stat-bar-fill h-full rounded-sm bg-scale-strong calm-transition"
                            style={{ width: sig.currentMean !== null ? `${signalRubricMeanBarWidthPct(sig.currentMean)}%` : "0%" }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              {selfProfile.teacherCoverage >= 3 && selfProfile.signals.some((s) => s.delta !== null && s.delta < 0) && (() => {
                const hodWatchSignals = selfProfile.signals
                  .filter((s) => s.delta !== null && s.delta < 0)
                  .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
                  .slice(0, 2);
                return (
                  <div className="rounded-sm bg-[var(--surface-container-low)] p-4 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-scale-some-light text-[10px] text-scale-some-text">⚠</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text">Areas to watch</span>
                    </div>
                    <div className="space-y-2.5">
                      {hodWatchSignals.map((sig) => (
                        <div key={sig.signalKey} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-medium text-text">{sig.label}</span>
                            <span className="text-[11px] font-bold text-[var(--warning)] tabular-nums">
                              {sig.delta !== null ? `${formatSignalRubricDelta(sig.delta)} vs prior` : "—"}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-sm bg-scale-some-light">
                            <div
                              className="h-full rounded-sm bg-scale-some-bar calm-transition"
                              style={{ width: sig.delta !== null ? `${signalRubricDeltaBarWidthPct(sig.delta)}%` : "0%" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/analysis/teachers/${userId}?window=${windowDays}`} className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                View your signal profile →
              </Link>
              <Link href={`/observe/history?teacherId=${userId}&window=${windowDays}`} className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                View observations →
              </Link>
            </div>
          </>
        )}
      </Card>

      {/* ═══ Whole-school focus ═══ */}
      {wholeSchoolTop1 && (
        <Card className="home-cpd-hero space-y-4 !p-6 !text-on-primary rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="text-[var(--on-primary)] [&_svg]:h-5 [&_svg]:w-5">
              <IconSparkles />
            </span>
            <h2 className="text-base font-bold tracking-[-0.01em]">Whole-school focus</h2>
          </div>
          <p className="text-sm font-medium">{wholeSchoolTop1.label}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-primary/70">{wholeSchoolTop1.teachersCovered} teachers covered</span>
              <span className="text-sm font-bold">{Math.round(wholeSchoolTop1.driftRate * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-white/20">
              <div
                className="home-cpd-bar-fill h-full rounded-sm"
                style={{ width: `${Math.min(Math.round(wholeSchoolTop1.driftRate * 100), 100)}%` }}
              />
            </div>
          </div>
          <Link href={`/analytics?tab=cpd&window=${windowDays}`} className="mt-2 inline-block text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-on-primary/80 calm-transition hover:text-on-primary">
            See CPD priorities ↗
          </Link>
        </Card>
      )}
    </div>
  );
}

function CoachHome({
  windowDays,
  coacheeRows,
  coacheeCount,
  teacherHomeProps,
}: {
  windowDays: number;
  coacheeRows: TeacherRiskRow[];
  coacheeCount: number;
  teacherHomeProps: Omit<
    Parameters<typeof TeacherHome>[0],
    "showWholeSchoolFocus" | "wholeSchoolTop1"
  >;
}) {
  return (
    <div className="w-full min-w-0 space-y-8">
      <CoacheePrioritiesCard coacheeRows={coacheeRows} windowDays={windowDays} coacheeCount={coacheeCount} />
      <TeacherHome {...teacherHomeProps} showWholeSchoolFocus={false} wholeSchoolTop1={null} />
    </div>
  );
}

function TeacherHome({
  windowDays,
  selfProfile,
  openActions,
  loaRequest,
  onCallRequests,
  wholeSchoolTop1,
  userId,
  hasMeetingsFeature,
  hasLeaveFeature,
  hasOnCallFeature,
  meetingsToday,
  showWholeSchoolFocus = true,
}: {
  windowDays: number;
  selfProfile: Awaited<ReturnType<typeof computeTeacherSignalProfile>>;
  openActions: MeetingActionSummary[];
  loaRequest: LoaSummary | null;
  onCallRequests: OnCallSummary[];
  wholeSchoolTop1: CpdPriorityRow | null;
  userId: string;
  hasMeetingsFeature: boolean;
  hasLeaveFeature: boolean;
  hasOnCallFeature: boolean;
  meetingsToday: { id: string; title: string; startDateTime: Date; location: string | null }[];
  showWholeSchoolFocus?: boolean;
}) {
  const signalsWithData = selfProfile?.signals.filter((s) => s.currentMean !== null) ?? [];
  const strengthSignals = [...signalsWithData]
    .sort((a, b) => (b.currentMean ?? 0) - (a.currentMean ?? 0))
    .slice(0, 3);
  const watchSignals = [...signalsWithData]
    .filter((s) => s.delta !== null && s.delta < 0 && (selfProfile?.teacherCoverage ?? 0) >= 3)
    .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
    .slice(0, 2);

  const obsCount = selfProfile?.teacherCoverage ?? 0;
  const actionCount = openActions.length;

  const loaStatusLabel: Record<string, string> = {
    PENDING: "Pending review",
    APPROVED: "Approved",
    APPROVED_WITH_PAY: "Approved with pay",
    APPROVED_WITHOUT_PAY: "Approved without pay",
    DENIED: "Not approved",
    CANCELLED: "Cancelled",
  };
  const loaStatusPill: Record<string, PillVariant> = {
    PENDING: "neutral",
    APPROVED: "success",
    APPROVED_WITH_PAY: "success",
    APPROVED_WITHOUT_PAY: "warning",
    DENIED: "error",
    CANCELLED: "neutral",
  };

  return (
    <div className="w-full min-w-0 space-y-8">
      {/* ═══ Your recent observations ═══ */}
      <Card className="flex min-h-0 flex-col gap-5 rounded-sm !p-6 shadow-none">
        <HomeCardHeading
          icon={<IconChartBar className="text-[var(--info)]" />}
          title="Your recent observations"
          subtitle={`${windowDays}-day window`}
          end={obsCount > 0 ? <StatusPill variant="accent" size="sm">{obsCount} observation{obsCount !== 1 ? "s" : ""}</StatusPill> : null}
        />

        {!selfProfile || selfProfile.teacherCoverage === 0 ? (
          <HomeEmptyPanel
            icon={<IconClipboard className="text-muted" />}
            title="No observations in this window"
            description="Capture an observation to see strengths and areas to watch."
            action={<HomePrimaryLink href="/observe/new">Start an observation</HomePrimaryLink>}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <MetaText>
              {selfProfile.teacherCoverage} observation{selfProfile.teacherCoverage !== 1 ? "s" : ""} in last {windowDays} days
              {selfProfile.lastObservationAt && (
                <> · Last: {new Date(selfProfile.lastObservationAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
              )}
            </MetaText>
            <div className="grid gap-4 sm:grid-cols-2">
              {strengthSignals.length > 0 && (
                <div className="rounded-sm bg-[var(--surface-container-low)] p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-status-approved-light text-[10px] text-status-approved-text">✓</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text">Strengths</span>
                  </div>
                  <div className="space-y-2.5">
                    {strengthSignals.map((sig) => (
                      <div key={sig.signalKey} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-medium text-text">{sig.label}</span>
                          <span className="text-[11px] font-bold text-scale-strong-text tabular-nums">
                            {sig.currentMean !== null ? formatSignalRubricMean(sig.currentMean) : "—"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-status-approved-light">
                          <div
                            className="h-full rounded-sm bg-scale-strong calm-transition"
                            style={{ width: sig.currentMean !== null ? `${signalRubricMeanBarWidthPct(sig.currentMean)}%` : "0%" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {watchSignals.length > 0 && (
                <div className="rounded-sm bg-[var(--surface-container-low)] p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-scale-some-light text-[10px] text-scale-some-text">⚠</span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text">Areas to watch</span>
                  </div>
                  <div className="space-y-2.5">
                    {watchSignals.map((sig) => (
                      <div key={sig.signalKey} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-medium text-text">{sig.label}</span>
                          <span className="text-[11px] font-bold text-[var(--warning)] tabular-nums">
                            {sig.delta !== null ? `${formatSignalRubricDelta(sig.delta)} vs prior` : "—"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-sm bg-scale-some-light">
                          <div
                            className="h-full rounded-sm bg-scale-some-bar calm-transition"
                            style={{ width: sig.delta !== null ? `${signalRubricDeltaBarWidthPct(sig.delta)}%` : "0%" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/analysis/teachers/${userId}?window=${windowDays}`} className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                View your signal profile →
              </Link>
              <Link href={`/observe/history?teacherId=${userId}&window=${windowDays}`} className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                View observations →
              </Link>
            </div>
          </div>
        )}
      </Card>

      {/* ═══ Actions — only when there are open items ═══ */}
      {hasMeetingsFeature && openActions.length > 0 && (
        <Card className="space-y-4 rounded-sm !p-6 shadow-none">
          <div className="flex items-center justify-between">
            <HomeCardHeadingSm
              icon={<IconBolt className="text-scale-some-text" />}
              title="Your actions"
              subtitle={`${openActions.length} open action${openActions.length !== 1 ? "s" : ""}`}
            />
            <Link href="/my-actions" className="link-accent shrink-0 text-sm">
              View all →
            </Link>
          </div>
          <ul className="space-y-1">
            {openActions.slice(0, 5).map((action) => (
              <li key={action.id}>
                <Link href="/my-actions" className="home-row-link flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[var(--surface-container-low)] text-muted">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                    </span>
                    <span className="text-sm font-medium text-text truncate">{action.description}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {action.dueDate && (
                      <MetaText>Due {new Date(action.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</MetaText>
                    )}
                    <StatusPill variant="neutral" size="sm">{action.status ?? "Open"}</StatusPill>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasMeetingsFeature && <MeetingsTodayList meetings={meetingsToday} />}

      {/* ═══ Leave & On-Call — compact when no active request ═══ */}
      {hasLeaveFeature && !loaRequest && (
        <p className="text-sm text-muted">
          No active leave request.{" "}
          <Link href="/leave/request" className="font-semibold text-[var(--primary)] hover:opacity-80">
            Request leave →
          </Link>
        </p>
      )}

      {((hasLeaveFeature && loaRequest) || (hasOnCallFeature && onCallRequests.length > 0)) ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {hasLeaveFeature && loaRequest ? (
            <Card className="space-y-4 rounded-sm !p-5 shadow-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[var(--surface-container)] text-muted">
                    <LeaveCalendarIcon />
                  </span>
                  <h2 className="text-base font-bold tracking-[-0.01em] text-text">Leave of absence</h2>
                </div>
                {loaRequest && (
                  <StatusPill variant={loaStatusPill[loaRequest.status] ?? "neutral"} size="sm">
                    {loaStatusLabel[loaRequest.status] ?? loaRequest.status}
                  </StatusPill>
                )}
              </div>
              {loaRequest && (
                <div className="rounded-sm bg-[var(--surface-container-low)] p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-text">
                    <LeaveCalendarIcon className="shrink-0 text-muted" />
                    <span>
                      {new Date(loaRequest.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" – "}
                      {new Date(loaRequest.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href="/leave/request" className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  Request leave →
                </Link>
                <Link href="/leave" className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  View status →
                </Link>
              </div>
            </Card>
          ) : null}
          {hasOnCallFeature && onCallRequests.length > 0 ? (
            <Card className="space-y-4 rounded-sm !p-5 shadow-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[var(--tertiary-container)] text-[var(--on-primary)] [&_svg]:h-4 [&_svg]:w-4">
                    <IconBell />
                  </span>
                  <h2 className="text-base font-bold tracking-[-0.01em] text-text">On call</h2>
                </div>
                {onCallRequests.some((r) => r.status === "OPEN") && (
                  <StatusPill variant="error" size="sm">Open</StatusPill>
                )}
              </div>
              <ul className="space-y-1.5">
                {onCallRequests.slice(0, 3).map((req) => (
                  <li key={req.id} className="flex items-center justify-between rounded-sm bg-[var(--surface-container-low)] p-3 calm-transition hover:bg-[var(--surface-container)]">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-[var(--surface-container)] text-muted [&_svg]:h-3 [&_svg]:w-3">
                        <IconBell />
                      </span>
                      <span className="text-sm font-medium text-text">{new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                    </div>
                    <StatusPill variant={req.status === "OPEN" ? "error" : req.status === "APPROVED" ? "success" : "neutral"} size="sm">{req.status}</StatusPill>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Link href="/on-call/new" className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  Log on-call →
                </Link>
                <Link href="/on-call" className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  View requests →
                </Link>
              </div>
            </Card>
          ) : null}
        </section>
      ) : null}

      {/* ═══ Whole-school focus ═══ */}
      {showWholeSchoolFocus && wholeSchoolTop1 && (
        <Card className="home-cpd-hero space-y-4 !p-6 !text-on-primary rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="text-[var(--on-primary)] [&_svg]:h-5 [&_svg]:w-5">
              <IconSparkles />
            </span>
            <h2 className="text-base font-bold tracking-[-0.01em]">Whole-school focus</h2>
          </div>
          <p className="text-sm font-medium">{wholeSchoolTop1.label}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-primary/70">School-wide signal movement</span>
              <span className="text-sm font-bold">{Math.round(wholeSchoolTop1.driftRate * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-white/20">
              <div
                className="home-cpd-bar-fill h-full rounded-sm"
                style={{ width: `${Math.min(Math.round(wholeSchoolTop1.driftRate * 100), 100)}%` }}
              />
            </div>
          </div>
          <Link href={`/analytics?tab=cpd&window=${windowDays}`} className="mt-2 inline-block text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-on-primary/80 calm-transition hover:text-on-primary">
            See CPD priorities ↗
          </Link>
        </Card>
      )}
    </div>
  );
}

type PrismaWithExtras = typeof prisma & {
  tenantSettings: { findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null> };
  tenantFeature: { findMany: (args: Record<string, unknown>) => Promise<{ key: string }[]> };
};
const db = prisma as PrismaWithExtras;

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const user = await getSessionUserOrThrow();

  const coachAssignments =
    user.role === "LEADER"
      ? await (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } })
      : [];
  const coacheeCount = coachAssignments.length;
  const variant = resolveHomeVariant(user.role, coacheeCount);
  const headerCopy = homeHeaderCopy(variant);

  const settings = await db.tenantSettings.findUnique({
    where: { tenantId: user.tenantId },
  });
  const cookieStore = cookies();
  const cookieWindow = parseInt(cookieStore.get(INSIGHT_WINDOW_COOKIE)?.value ?? "", 10);
  const rawWindow = typeof searchParams?.window === "string" ? parseInt(searchParams.window, 10) : NaN;
  const windowDays: number = ALLOWED_WINDOW_DAYS.includes(rawWindow)
    ? rawWindow
    : ALLOWED_WINDOW_DAYS.includes(cookieWindow)
      ? cookieWindow
      : ((settings?.defaultInsightWindowDays as number) ?? DEFAULT_WINDOW_DAYS);

  const features = await db.tenantFeature.findMany({
    where: { tenantId: user.tenantId, enabled: true },
  });
  const enabledFeatures = new Set<string>(features.map((f) => f.key));
  const hasAnalysisFeature = enabledFeatures.has("ANALYSIS");

  const homeAssembly = assembleHomeCards({
    role: user.role,
    enabledFeatures: Array.from(enabledFeatures),
  });


  // Build quick action items based on enabled features
  const quickActionItems: { label: string; href: string; icon: ReactNode }[] = [];
  if (enabledFeatures.has("OBSERVATIONS")) {
    quickActionItems.push({ label: "New observation", href: "/observe/new", icon: <IconClipboard className="text-muted" /> });
  }
  if (enabledFeatures.has("MEETINGS")) {
    quickActionItems.push({ label: "New meeting", href: "/meetings/new", icon: <IconCalendar className="text-[var(--info)]" /> });
  }
  if (enabledFeatures.has("ON_CALL")) {
    quickActionItems.push({ label: "On call", href: "/on-call/new", icon: <IconPhone className="text-muted" /> });
  }
  if (enabledFeatures.has("LEAVE")) {
    quickActionItems.push({ label: "Leave of absence", href: "/leave/request", icon: <IconUmbrella className="text-[var(--info)]" /> });
  }

  const pageContent = async () => {
    if (variant === "leadership") {
      if (!hasAnalysisFeature) {
        return (
          <Card>
            <BodyText className="text-muted">Analysis features are not yet enabled.</BodyText>
          </Card>
        );
      }
      const hasLeaveFeature = homeAssembly.has("operations.leave-approvals");
      const hasOnCallFeature = enabledFeatures.has("ON_CALL");
      const hasAssessmentsFeature = enabledFeatures.has("ASSESSMENTS");
      const hasStudentAnalysisFeature = enabledFeatures.has("STUDENT_ANALYSIS");

      const [leadershipData, behaviourHeatmap] = await Promise.all([
        hydrateLeadershipHomeData({ user, windowDays, hasLeaveFeature, hasOnCallFeature, hasAssessmentsFeature, hasStudentAnalysisFeature }),
        hasOnCallFeature ? fetchBehaviourHeatmapMatrix(user.tenantId, windowDays) : Promise.resolve(null),
      ]);

      return (
        <LeadershipHome
          windowDays={windowDays}
          cpdRows={leadershipData.cpdRows}
          teacherRows={leadershipData.teacherRows}
          cohortRows={leadershipData.cohortRows}
          studentRows={leadershipData.studentRows}
          hasLeaveFeature={hasLeaveFeature}
          pendingLeaveCount={leadershipData.pendingLeaveCount}
          pendingLeaveDetails={leadershipData.pendingLeaveDetails}
          liveOnCallBanner={leadershipData.liveOnCallBanner}
          weekObsCount={leadershipData.weekObsCount}
          weekObsTeachers={leadershipData.weekObsTeachers}
          attainmentSummary={leadershipData.attainmentSummary ?? null}
          hasStudentAnalysisFeature={hasStudentAnalysisFeature}
          watchlistStudents={leadershipData.watchlistStudents}
          behaviourHeatmap={behaviourHeatmap}
          topImproving={leadershipData.topImproving}
          meetingsTodayCount={leadershipData.meetingsTodayCount}
          attainmentKpis={leadershipData.attainmentKpis}
        />
      );
    }

    if (variant === "hod") {
      const rawDept = typeof searchParams?.dept === "string" ? searchParams.dept : null;
      const { allDepts, activeDeptId, deptName, deptCpdRows, filteredTeacherRows, selfProfile, wholeSchoolTop1 } = await hydrateHodHomeData({ user, windowDays, searchDeptId: rawDept });

      if (!hasAnalysisFeature || !activeDeptId) {
        return (
          <Card>
            <BodyText className="text-muted">
              {!activeDeptId ? "No department head assignment found. Contact your administrator." : "Analysis features are not yet enabled."}
            </BodyText>
          </Card>
        );
      }

      const hasLeaveFeature = homeAssembly.has("operations.leave-approvals");
      const hodAttention = await hydrateHodAttentionContext({
        user,
        deptId: activeDeptId,
        windowDays,
        hasLeaveFeature,
        hasOnCallFeature: enabledFeatures.has("ON_CALL"),
        hasStudentAnalysisFeature: enabledFeatures.has("STUDENT_ANALYSIS"),
      });

      const deptInterventionCount = filteredTeacherRows.filter(
        (r) => r.status === "SIGNIFICANT_DRIFT" || r.status === "EMERGING_DRIFT"
      ).length;

      const attentionItems = buildHodAttentionItems({
        ...hodAttention,
        interventionCount: deptInterventionCount,
        windowDays,
        deptId: activeDeptId,
      });

      return (
        <HodHome
          windowDays={windowDays}
          deptCpdRows={deptCpdRows}
          deptTeacherRows={filteredTeacherRows}
          deptName={deptName}
          deptId={activeDeptId}
          selfProfile={selfProfile}
          wholeSchoolTop1={wholeSchoolTop1}
          userId={user.id}
          allDepts={allDepts}
          activeDeptId={activeDeptId}
          attentionItems={attentionItems}
        />
      );
    }

    if (variant === "coach") {
      const coachData = await hydrateCoachHomeData({ user, windowDays, assembly: homeAssembly });
      const teacherProps = {
        windowDays,
        selfProfile: coachData.selfProfile,
        openActions: coachData.openActionsData as MeetingActionSummary[],
        loaRequest: coachData.loaData as LoaSummary | null,
        onCallRequests: coachData.onCallData as OnCallSummary[],
        userId: user.id,
        hasMeetingsFeature: homeAssembly.has("operations.meetings-today") || homeAssembly.has("operations.my-open-actions"),
        hasLeaveFeature: homeAssembly.has("operations.my-leave-status"),
        hasOnCallFeature: homeAssembly.has("culture.my-oncall-status"),
        meetingsToday: coachData.meetingsToday,
      };
      return (
        <CoachHome
          windowDays={windowDays}
          coacheeRows={coachData.coacheeRows}
          coacheeCount={coachData.coacheeIds.length}
          teacherHomeProps={teacherProps}
        />
      );
    }

    const teacherData = await hydrateTeacherHomeData({ user, windowDays, hasAnalysisFeature, assembly: homeAssembly });

    return (
      <TeacherHome
        windowDays={windowDays}
        selfProfile={teacherData.selfProfile}
        openActions={teacherData.openActionsData as MeetingActionSummary[]}
        loaRequest={teacherData.loaData as LoaSummary | null}
        onCallRequests={teacherData.onCallData as OnCallSummary[]}
        wholeSchoolTop1={teacherData.wholeSchoolTop1}
        userId={user.id}
        hasMeetingsFeature={homeAssembly.has("operations.meetings-today") || homeAssembly.has("operations.my-open-actions")}
        hasLeaveFeature={homeAssembly.has("operations.my-leave-status")}
        hasOnCallFeature={homeAssembly.has("culture.my-oncall-status")}
        meetingsToday={teacherData.meetingsToday}
      />
    );
  };

  const content = await pageContent();
  const rawDeptQuery = typeof searchParams?.dept === "string" ? `dept=${searchParams.dept}` : undefined;

  return (
    <div className="w-full min-w-0 space-y-10">
      <HomePageTitle
        copy={headerCopy}
        windowDays={windowDays}
        showWindowSelector={showsInsightWindow(variant)}
        windowExtraQuery={rawDeptQuery}
        quickActionItems={quickActionItems}
        role={user.role}
      />
      {content}
    </div>
  );
}
