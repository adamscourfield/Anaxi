import Link from "next/link";
import type { ReactNode } from "react";
import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { BodyText, MetaText } from "@/components/ui/typography";
import { StatusPill, PillVariant } from "@/components/ui/status-pill";
import { StatCard } from "@/components/ui/stat-card";
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
import { assembleHomeCards } from "@/modules/home/assembler";
import {
  hydrateLeadershipHomeData,
  hydrateHodHomeData,
  hydrateTeacherHomeData,
  PendingLeaveDetail,
  OnCallDetail,
  AttainmentSummary,
  DualFlaggedStudent,
} from "@/modules/home/hydration";
import { QuickActionButton } from "@/components/dashboard/QuickActionButton";
import { Button } from "@/components/ui/button";
import {
  HomeCardHeading,
  HomeCardHeadingSm,
  HomeEmptyPanel,
  HomePageHeader,
  HomePrimaryLink,
  IconBell,
  IconBolt,
  IconBookOpen,
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
  return `/analysis/students/${studentId}?window=${windowDays}`;
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

function roleVariant(role: UserRole): "leadership" | "hod" | "teacher" {
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "SLT") return "leadership";
  if (role === "HOD") return "hod";
  return "teacher";
}

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

function WindowSelector({ windowDays }: { windowDays: number }) {
  return (
    <div className="segmented-toggle home-pulse-window-toggle">
      {[7, 14, 21, 28].map((w) => (
        <Link
          key={w}
          href={`/home?window=${w}`}
          className={`segmented-toggle-btn ${windowDays === w ? "segmented-toggle-btn-active" : ""}`}
        >
          {w}d
        </Link>
      ))}
    </div>
  );
}

function PageTitle({
  windowDays,
  minCoverage,
  quickActionItems,
}: {
  windowDays: number;
  minCoverage: number;
  quickActionItems: { label: string; href: string; icon: ReactNode }[];
}) {
  const updatedAt = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <HomePageHeader
      eyebrow="Dashboard"
      title="Institutional Pulse"
      subtitle="Coverage, signals, and operational status for your school — tuned to the selected window."
      metaBelowActions
      actions={
        <>
          <div className="min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch] pb-0.5 sm:pb-0">
            <WindowSelector windowDays={windowDays} />
          </div>
          {quickActionItems.length > 0 ? <QuickActionButton items={quickActionItems} /> : null}
        </>
      }
      meta={
        <>
          <HomeMetaChip icon={<IconCalendar />} label={`Window: last ${windowDays} days`} />
          <HomeMetaChip
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label={`Updated ${updatedAt}`}
          />
          <HomeMetaChip
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            }
            label={`Coverage threshold: ${minCoverage} obs`}
          />
        </>
      }
    />
  );
}

function HomeMetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted">
      <span className="text-muted/70 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      {label}
    </span>
  );
}

function LeadershipAttentionStrip({
  openOnCalls,
  interventionStaff,
  attendanceDelta,
  pendingLeaveCount,
  windowDays,
}: {
  openOnCalls: OnCallDetail[];
  interventionStaff: TeacherRiskRow[];
  attendanceDelta: number | null;
  pendingLeaveCount: number;
  windowDays: number;
}) {
  const primaryOnCall = openOnCalls[0];
  const items = [
    ...(primaryOnCall
      ? [{
          title: `${openOnCalls.length} on-call escalation${openOnCalls.length === 1 ? "" : "s"}`,
          detail: `${primaryOnCall.requesterName} • ${formatRelativeShort(primaryOnCall.createdAt)}`,
          href: `/on-call/${primaryOnCall.id}`,
          tone: "critical" as const,
        }]
      : []),
    ...(interventionStaff.length > 0
      ? [{
          title: `${interventionStaff.length} teacher${interventionStaff.length === 1 ? "" : "s"} require intervention`,
          detail: interventionStaff[0]?.status === "SIGNIFICANT_DRIFT" ? "Significant negative drift" : "Emerging support signals",
          href: `/analytics?tab=teachers&window=${windowDays}`,
          tone: "critical" as const,
        }]
      : []),
    ...(attendanceDelta !== null && attendanceDelta < 0
      ? [{
          title: "Attendance down",
          detail: `${attendanceDelta.toFixed(1)}% from last week`,
          href: `/analytics?tab=students&window=${windowDays}`,
          tone: "critical" as const,
        }]
      : []),
    ...(pendingLeaveCount > 0
      ? [{
          title: `${pendingLeaveCount} leave approval${pendingLeaveCount === 1 ? "" : "s"} pending`,
          detail: "Cover decisions waiting",
          href: "/leave#pending-requests",
          tone: "warning" as const,
        }]
      : []),
  ];

  const visibleItems = items.length > 0
    ? items
    : [{
        title: "No immediate escalations",
        detail: "Operational signals are currently within expected ranges",
        href: "/my-actions",
        tone: "success" as const,
      }];

  const hasCritical = visibleItems.some((item) => item.tone === "critical");
  const bandClass = hasCritical
    ? "border-[color-mix(in_srgb,var(--error)_28%,transparent)] bg-[#FEF2F2]"
    : visibleItems.some((item) => item.tone === "warning")
      ? "border-[color-mix(in_srgb,var(--warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--pill-warning-bg)_70%,var(--surface-container-lowest))]"
      : "border-[color-mix(in_srgb,var(--success)_14%,transparent)] bg-[color-mix(in_srgb,var(--pill-success-bg)_72%,var(--surface-container-lowest))]";

  const itemDivideX = hasCritical
    ? "sm:divide-[color-mix(in_srgb,var(--error)_18%,transparent)]"
    : "sm:divide-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)]";

  return (
    <section className={`rounded-xl border px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:px-5 sm:py-4 ${bandClass}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
          <div className="flex shrink-0 items-center gap-3 lg:max-w-[220px] lg:flex-col lg:items-start lg:gap-2">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base font-bold leading-none text-white shadow-sm ${
                  hasCritical ? "bg-[var(--error)]" : "bg-[var(--success)]"
                }`}
              >
                {hasCritical ? "!" : "✓"}
              </span>
              {hasCritical ? (
                <p className="text-sm font-bold text-[var(--error)]">Immediate attention</p>
              ) : (
                <p className="text-sm font-bold text-[var(--success)]">Operating within range</p>
              )}
            </div>
          </div>

          <div
            className={`grid min-w-0 flex-1 grid-cols-1 gap-3 divide-y divide-solid sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-y-0 ${itemDivideX} max-sm:divide-[color-mix(in_srgb,var(--outline-variant)_40%,transparent)]`}
          >
            {visibleItems.slice(0, 3).map((item, idx) => (
              <Link
                key={`${item.title}-${item.href}`}
                href={item.href}
                className={`group min-w-0 px-1 py-1 calm-transition sm:px-4 sm:py-0 ${idx === 0 ? "sm:pl-0" : ""} ${idx === 2 ? "sm:pr-0" : ""} rounded-lg hover:bg-white/60`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      item.tone === "critical" ? "bg-[var(--error)]" : item.tone === "warning" ? "bg-[var(--warning)]" : "bg-[var(--success)]"
                    }`}
                  />
                  <p className="truncate text-sm font-semibold tracking-[-0.01em] text-text">{item.title}</p>
                </div>
                <p className="mt-1 truncate pl-4 text-xs text-muted">{item.detail}</p>
              </Link>
            ))}
          </div>
        </div>
        <Link
          href={visibleItems[0]?.href ?? "/my-actions"}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm calm-transition ${
            hasCritical
              ? "bg-white text-[var(--error)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--error)_35%,transparent)] hover:bg-white"
              : "bg-white/90 text-text ring-1 ring-inset ring-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] hover:bg-white"
          }`}
        >
          View all actions
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
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
  onCallDetails,
  onCallStats,
  weekObsCount,
  weekObsTeachers,
  attainmentSummary,
  hasStudentAnalysisFeature,
  watchlistStudents,
}: {
  windowDays: number;
  cpdRows: CpdPriorityRow[];
  teacherRows: TeacherRiskRow[];
  cohortRows: CohortPivotRow[];
  studentRows: StudentRiskRow[];
  hasLeaveFeature: boolean;
  pendingLeaveCount: number;
  pendingLeaveDetails: PendingLeaveDetail[];
  onCallDetails: OnCallDetail[];
  onCallStats: { resolved: number; active: number; escalation: number };
  weekObsCount: number;
  weekObsTeachers: { id: string; name: string }[];
  attainmentSummary: AttainmentSummary | null;
  hasStudentAnalysisFeature?: boolean;
  watchlistStudents?: StudentRiskRow[];
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
  const interventionStaff = teacherRows
    .filter((r) => r.status === "SIGNIFICANT_DRIFT" || r.status === "EMERGING_DRIFT")
    .slice(0, 3);

  // Watchlist students (prefer explicitly-provided watchlist rows, otherwise derive from student rows)
  const bandOrder: Record<string, number> = { URGENT: 0, PRIORITY: 1, WATCH: 2, STABLE: 3 };
  const derivedWatchlistStudents = studentRows
    .filter((r) => r.onWatchlist)
    .sort((a, b) => (bandOrder[a.band] ?? 9) - (bandOrder[b.band] ?? 9));
  const effectiveWatchlistStudents = watchlistStudents ?? derivedWatchlistStudents;

  // On-call: separate open vs acknowledged (live queue)
  const openOnCalls = onCallDetails.filter((r) => r.status === "OPEN" || r.status === "ACKNOWLEDGED");

  const topOnCallRows = onCallDetails.slice(0, 3);
  const firstImmediateSupportIdx = topOnCallRows.findIndex(
    (oc) => oc.status === "OPEN" || oc.status === "ACKNOWLEDGED"
  );

  return (
    <div className="w-full min-w-0 space-y-8">
      <LeadershipAttentionStrip
        openOnCalls={openOnCalls}
        interventionStaff={interventionStaff}
        attendanceDelta={attendanceDelta}
        pendingLeaveCount={pendingLeaveCount}
        windowDays={windowDays}
      />

      {/* ═══ Hero Section 1: On-Call Status + Attendance + Observations ═══ */}
      <section className="grid min-w-0 gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(320px,1.35fr)_minmax(260px,0.82fr)_minmax(260px,0.82fr)_minmax(220px,0.56fr)] xl:items-stretch">
        {/* On-Call Live Status (main box) */}
        <Card
          id="on-call-status-card"
          className="scroll-mt-20 flex min-h-0 min-w-0 flex-col gap-5 rounded-2xl !p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.08)]"
        >
          <HomeCardHeading
            icon={<IconBell />}
            iconTileClassName="bg-[#0F172A] text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] [&_svg]:text-white"
            title="On-call status"
            subtitle="Anaxi core response"
            end={
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <Link
                  href="/on-call"
                  className="text-xs font-semibold text-[var(--primary)] calm-transition hover:opacity-80"
                >
                  View all →
                </Link>
                {openOnCalls.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--error)_35%,transparent)] bg-white px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--error)]">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--error)]" aria-hidden />
                    Live
                  </span>
                ) : null}
              </div>
            }
          />
          {onCallDetails.length > 0 ? (
            <div className="grid grid-cols-3 gap-0 divide-x divide-[color-mix(in_srgb,var(--outline-variant)_28%,transparent)] rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[var(--surface-container-low)]/85 px-2 py-3 text-center sm:px-4">
              <div className="flex flex-col items-center gap-1 px-1 sm:items-start">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[var(--success)]" aria-hidden>
                    <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Resolved
                </span>
                <span className="text-lg font-bold tabular-nums tracking-tight text-text">{onCallStats.resolved}</span>
              </div>
              <div className="flex flex-col items-center gap-1 px-1 sm:items-start">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <span className="h-2 w-2 rounded-full bg-[#FBBF24]" aria-hidden />
                  Active
                </span>
                <span className="text-lg font-bold tabular-nums tracking-tight text-text">{onCallStats.active}</span>
              </div>
              <div className="flex flex-col items-center gap-1 px-1 sm:items-start">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[var(--error)]" aria-hidden>
                    <path d="M12 5 4 19h16L12 5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
                  </svg>
                  Escalation
                </span>
                <span className="text-lg font-bold tabular-nums tracking-tight text-text">{onCallStats.escalation}</span>
              </div>
            </div>
          ) : null}
          {onCallDetails.length === 0 ? (
            <div
              id="immediate-support-needed"
              className="scroll-mt-20 flex min-h-0 flex-1 flex-col"
            >
              <HomeEmptyPanel
                icon={<IconBell className="text-muted" />}
                title="No recent on-call activity"
                description="When staff raise an on-call, it will appear here for triage."
              />
            </div>
          ) : (
            <div
              className={`flex min-h-0 flex-1 flex-col space-y-2 ${firstImmediateSupportIdx === -1 ? "scroll-mt-20" : ""}`}
              id={firstImmediateSupportIdx === -1 ? "immediate-support-needed" : undefined}
            >
              {topOnCallRows.map((oc, i) => (
                <div
                  key={oc.id}
                  id={i === firstImmediateSupportIdx ? "immediate-support-needed" : undefined}
                  className={`group flex min-w-0 flex-col gap-2 rounded-[14px] border border-transparent p-3.5 calm-transition sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4 ${
                    i === firstImmediateSupportIdx ? "scroll-mt-20" : ""
                  } ${
                    oc.status === "OPEN" || oc.status === "ACKNOWLEDGED"
                      ? "border-[color-mix(in_srgb,var(--error)_12%,transparent)] bg-[color-mix(in_srgb,var(--pill-error-bg)_55%,var(--surface-container-lowest))] group-hover:bg-[color-mix(in_srgb,var(--pill-error-bg)_65%,var(--surface-container-low))] focus-within:bg-[color-mix(in_srgb,var(--pill-error-bg)_65%,var(--surface-container-low))]"
                      : "bg-[var(--surface-container-low)]/80 group-hover:bg-[var(--surface-container-low)] focus-within:bg-[var(--surface-container-low)]"
                  }`}
                >
                  <Link
                    href={`/on-call/${oc.id}`}
                    className="home-row-link flex min-w-0 flex-1 items-center gap-3 sm:min-w-0"
                  >
                    <Avatar name={oc.requesterName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-[-0.01em] text-text">{oc.requesterName}</p>
                      <p className="truncate text-xs text-muted">{oc.location}</p>
                    </div>
                  </Link>
                  <div className="flex min-w-0 shrink-0 flex-row flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right sm:flex-nowrap">
                    {(oc.status === "OPEN" || oc.status === "ACKNOWLEDGED") ? (
                      <>
                        <div className="hidden max-w-[140px] flex-col items-end gap-0.5 sm:flex sm:max-w-none">
                          <span className="text-xs font-semibold text-[var(--error)]">Immediate support needed</span>
                          <span className="text-xs font-medium text-[var(--error)]">
                            Triggered {formatRelativeShort(oc.createdAt)}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-[var(--error)] sm:hidden">Live</span>
                        <Link
                          href="/on-call"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-medium text-on-primary shadow-sm calm-transition hover:bg-primaryBtnHover sm:h-9 sm:w-9"
                          aria-label="Open on-call inbox"
                        >
                          →
                        </Link>
                      </>
                    ) : (
                      <div className="flex min-w-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <StatusPill variant="success" size="sm">RESOLVED</StatusPill>
                        <span className="tabular-nums text-[11px] text-muted">
                          {new Date(oc.resolvedAt ?? oc.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* CPD Priorities (dark box) */}
        <Card className="home-cpd-hero flex min-h-[280px] flex-col space-y-4 !p-6 !text-on-primary rounded-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[var(--on-primary)] [&_svg]:h-5 [&_svg]:w-5">
                <IconSparkles />
              </span>
              <h2 className="text-base font-bold tracking-[-0.01em]">CPD priorities</h2>
            </div>
            <Link href={`/analytics?tab=cpd&window=${windowDays}`} className="text-xs font-semibold text-on-primary/75 calm-transition hover:text-on-primary">
              View all
            </Link>
          </div>
          {topCpd.length === 0 ? (
            <p className="text-sm text-on-primary/60">No weakening signals detected in this window.</p>
          ) : (
            <>
              <p className="text-sm text-on-primary/70">
                {topCpd.length} signal{topCpd.length !== 1 ? "s" : ""} weakening across {teacherRows.length} teachers in the {windowDays}-day window.
              </p>
              <div className="space-y-3">
                {topCpd.map((row) => (
                  <Link key={row.signalKey} href={`/analysis/cpd/${row.signalKey}?window=${windowDays}`} className="home-row-link-on-dark -mx-2 block rounded-xl p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{row.label}</span>
                      <span className="text-sm font-bold">{Math.round(row.driftRate * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-white/20">
                      <div
                        className="home-cpd-bar-fill h-full rounded-sm bg-surface-container-lowest/80"
                        style={{ width: `${Math.min(Math.round(row.driftRate * 100), 100)}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
              <Link href={`/analytics?tab=cpd&window=${windowDays}`} className="mt-auto inline-block shrink-0 text-sm font-semibold text-on-primary/90 underline decoration-white/25 underline-offset-2 calm-transition hover:text-on-primary">
                View full breakdown →
              </Link>
            </>
          )}
        </Card>

        {/* Staff Needing Intervention */}
        <Card className="flex min-h-[280px] flex-col space-y-4 rounded-2xl !p-6">
          <HomeCardHeadingSm
            icon={<IconUsersTwo className="text-[var(--primary)]" />}
            title="Staff intervention"
            subtitle={`${interventionStaff.length} staff needing support`}
            end={
              <Link href={`/analytics?tab=teachers&window=${windowDays}`} className="link-accent shrink-0 text-xs font-semibold">
                View all
              </Link>
            }
          />
          {interventionStaff.length === 0 ? (
            <MetaText>All staff stable — no intervention needed.</MetaText>
          ) : (
            <ul className="space-y-2">
              {interventionStaff.map((row) => (
                <li key={row.teacherMembershipId}>
                  <Link href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`} className="home-row-link flex items-center justify-between gap-2 p-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={row.teacherName} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{row.teacherName}</p>
                        <p className="text-[11px] text-muted">{row.departmentNames.join(", ") || "No dept"}</p>
                      </div>
                    </div>
                    <StatusPill variant={RISK_STATUS_PILL[row.status]} size="sm">{RISK_STATUS_LABELS[row.status]}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/analytics?tab=teachers&window=${windowDays}`} className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-text calm-transition hover:text-muted">
            Go to interventions →
          </Link>
        </Card>

        {/* Right column: Attendance + Observations */}
        <div className="flex w-full min-w-0 flex-col gap-5">
          {/* Attendance box */}
          <Card className="home-hero-glass flex min-h-0 flex-1 flex-col gap-4 rounded-2xl !p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Attendance</p>
              <Link
                href={`/analytics?tab=students&window=${windowDays}`}
                className="shrink-0 text-xs font-semibold text-[var(--primary)] calm-transition hover:opacity-80"
              >
                View report
              </Link>
            </div>
            <div>
              <p className="mt-0.5 text-[2.5rem] font-bold leading-none tracking-[-0.04em] text-text tabular-nums sm:text-[2.625rem]">
                {attendancePct !== null ? `${attendancePct.toFixed(1)}%` : "—"}
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--surface-container)_88%,transparent)]">
                <div
                  className="home-stat-bar-fill h-full rounded-sm bg-[var(--success)]"
                  style={{ width: `${Math.min(attendancePct ?? 0, 100)}%` }}
                />
              </div>
              {attendanceDelta !== null && (
                <p className="mt-3 flex flex-wrap items-center gap-1 text-[13px]">
                  <span className={attendanceDelta >= 0 ? "text-positive" : "text-negative"}>
                    {attendanceDelta >= 0 ? <IconTrendUp className="inline h-3.5 w-3.5" /> : <IconTrendDown className="inline h-3.5 w-3.5" />}
                  </span>
                  <span className={`font-medium tabular-nums ${attendanceDelta >= 0 ? "text-positive" : "text-negative"}`}>
                    {attendanceDelta >= 0 ? "+" : ""}{attendanceDelta.toFixed(1)}%
                  </span>
                  <span className="text-muted">from last week</span>
                </p>
              )}
              {attendancePct !== null && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  School-wide mean across cohorts ({windowDays}-day window).
                </p>
              )}
            </div>
          </Card>

          {/* Observations this week */}
          <Card className="home-hero-glass flex min-h-min flex-1 flex-col gap-4 rounded-2xl !p-6 pb-7">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Observations this week</p>
              <Link
                href="/explorer/observations"
                className="shrink-0 text-xs font-semibold text-[var(--primary)] calm-transition hover:opacity-80"
              >
                View all
              </Link>
            </div>
            <Link href="/explorer/observations" className="home-row-link group block cursor-pointer">
              <div>
                <p className="mt-0.5 text-[2.5rem] font-bold leading-none tracking-[-0.04em] text-text tabular-nums sm:text-[2.625rem]">
                  {weekObsCount}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {weekObsTeachers.slice(0, 3).map((t) => (
                    <Avatar key={t.id} name={t.name} size="sm" />
                  ))}
                  {weekObsTeachers.length > 3 && (
                    <span className="inline-flex h-7 w-auto min-w-[28px] items-center justify-center rounded-md bg-[var(--primary)] px-1.5 text-[10px] font-semibold text-on-primary shadow-sm">
                      +{weekObsTeachers.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </Card>
        </div>
      </section>

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

      {/* ═══ Attainment + Leave (design bottom row) ═══ */}
      {(attainmentSummary || hasLeaveFeature) && (
        <section
          className={`grid min-w-0 gap-5 lg:items-stretch ${
            attainmentSummary && hasLeaveFeature ? "lg:grid-cols-2" : "lg:grid-cols-1"
          }`}
        >
          {attainmentSummary ? (
            <Card className="flex h-full min-h-0 flex-col space-y-5 rounded-2xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.08)] sm:p-7">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--tertiary-container)] text-[var(--on-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.06)] [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]">
                    <IconChartBar />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold tracking-[-0.01em] text-text">Attainment</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {attainmentSummary.latestPointLabel
                        ? `${attainmentSummary.cycleLabel} • ${attainmentSummary.latestPointLabel}`
                        : attainmentSummary.cycleLabel}
                    </p>
                  </div>
                </div>
                <Link href="/assessments" className="link-muted-accent shrink-0 text-sm font-medium">
                  View all →
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  layout="kpi"
                  showChevron={false}
                  label="Subjects assessed"
                  value={attainmentSummary.subjectCount}
                  context={`${attainmentSummary.totalResults.toLocaleString()} results recorded`}
                  tone="glass"
                  icon={<IconBookOpen />}
                  iconTileClassName="rounded-md bg-[var(--surface-container)] text-muted"
                />
                <StatCard
                  layout="kpi"
                  showChevron={false}
                  label="Students assessed"
                  value={attainmentSummary.studentCount}
                  context={attainmentSummary.latestPointLabel ?? "Latest point"}
                  tone="glass"
                  icon={<IconUsersTwo />}
                  iconTileClassName="rounded-md bg-[var(--surface-container)] text-muted"
                />
                <StatCard
                  layout="kpi"
                  showChevron={false}
                  label="Dual-flagged"
                  value={attainmentSummary.triangulatedCount}
                  context={
                    attainmentSummary.triangulatedCount > 0
                      ? `${attainmentSummary.urgentCount} urgent • ${attainmentSummary.priorityCount} priority`
                      : "No students dual-flagged"
                  }
                  tone="glass"
                  icon={<IconFlagOutline />}
                  iconTileClassName="rounded-md bg-[var(--surface-container)] text-muted"
                  href={attainmentSummary.triangulatedCount > 0 ? "/assessments/triangulation" : undefined}
                />
              </div>

              {attainmentSummary.topDualFlagged.length > 0 && (
                <div className="space-y-3 rounded-xl bg-[var(--surface-container-low)] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Dual-flagged students — attainment + pastoral risk
                    </p>
                    <Link href="/assessments/triangulation" className="link-muted-accent shrink-0 text-xs font-medium">
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
                </div>
              )}
            </Card>
          ) : null}

          {hasLeaveFeature ? (
            <Card className="flex h-full min-h-0 flex-col gap-5 rounded-2xl !p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.08)]">
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

              {pendingLeaveDetails.length === 0 ? (
                <HomeEmptyPanel
                  icon={<IconUmbrella className="text-muted" />}
                  title="No pending leave requests"
                  description="When staff submit leave for approval, the newest requests will appear here."
                />
              ) : (
                <div className="divide-y divide-[color-mix(in_srgb,var(--outline-variant)_40%,transparent)] rounded-[14px] border border-[color-mix(in_srgb,var(--outline-variant)_28%,transparent)] bg-[var(--surface-container-lowest)]">
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
                          {isEmergency ? (
                            <Button variant="primary" asChild className="min-h-0 rounded-md px-4 py-2 text-xs">
                              <Link href="/leave#pending-requests">Review in queue</Link>
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" asChild className="min-h-0 rounded-md px-3 py-2 text-xs font-medium text-[var(--pill-error-text)] hover:bg-status-denied-light">
                                <Link href="/leave#pending-requests" aria-label={`Decline or review leave for ${leave.requesterName}`}>
                                  Decline
                                </Link>
                              </Button>
                              <Button
                                variant="secondary"
                                asChild
                                className="min-h-0 rounded-md border-0 bg-[color-mix(in_srgb,var(--success)_14%,white)] px-4 py-2 text-xs font-semibold text-[#065F46] shadow-none hover:bg-[color-mix(in_srgb,var(--success)_22%,white)]"
                              >
                                <Link href="/leave#pending-requests" aria-label={`Approve leave for ${leave.requesterName}`}>
                                  Approve
                                </Link>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link
                href="/leave"
                className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] calm-transition hover:opacity-80"
              >
                Go to leave calendar →
              </Link>
            </Card>
          ) : null}
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
}) {
  const allDeptDriftingCpd = deptCpdRows.filter((r) => r.teachersDriftingDown > 0);
  const topDeptCpd = allDeptDriftingCpd.slice(0, 2);
  const topDeptTeachers = deptTeacherRows.slice(0, 5);
  const deptObsCount = deptTeacherRows.reduce((sum, r) => sum + r.teacherCoverage, 0);
  const deptCpdDrift = allDeptDriftingCpd.length;

  return (
    <div className="w-full min-w-0 space-y-8">
      {/* ═══ Hero: Department KPI row ═══ */}
      <section className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-stretch">
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{deptName} Observations</p>
          <div>
            <p className="mt-1 text-[36px] font-bold leading-none tracking-[-0.02em] text-text">{deptObsCount}</p>
            <div className="mt-2 h-1.5 w-full rounded-sm bg-[var(--surface-container)]">
              <div className="h-full rounded-md bg-accent" style={{ width: `${Math.min(deptObsCount * 5, 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">{deptTeacherRows.length} teacher{deptTeacherRows.length !== 1 ? "s" : ""} · {windowDays}d window</p>
          </div>
        </Card>
        <Card className={`flex min-h-0 min-w-0 flex-1 flex-col gap-4 ${deptCpdDrift > 0 ? "!bg-[var(--surface-container)]" : ""}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{deptName} CPD Signals</p>
          <div>
            <p className={`mt-1 text-[36px] font-bold leading-none tracking-[-0.02em] ${deptCpdDrift > 0 ? "text-[var(--warning)]" : "text-text"}`}>
              {deptCpdDrift}
            </p>
            <p className="mt-2 text-xs text-muted">
              {deptCpdDrift > 0 ? `${deptCpdDrift} signal${deptCpdDrift !== 1 ? "s" : ""} weakening` : "All signals stable ✓"}
            </p>
          </div>
        </Card>
      </section>

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

      {/* ═══ Department Analysis Grid ═══ */}
      <section className="grid gap-4 lg:grid-cols-12">
        <Card className="home-cpd-hero space-y-4 !p-6 !text-on-primary lg:col-span-5 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="text-[var(--on-primary)] [&_svg]:h-5 [&_svg]:w-5">
              <IconSparkles />
            </span>
            <h2 className="text-base font-bold tracking-[-0.01em]">Dept CPD priorities</h2>
          </div>
          {topDeptCpd.length === 0 ? (
            <p className="text-sm text-on-primary/60">No weakening signals detected in this window.</p>
          ) : (
            <>
              <div className="space-y-3">
                {topDeptCpd.map((row) => (
                  <Link key={row.signalKey} href={`/analysis/cpd/${row.signalKey}?window=${windowDays}&department=${deptId}`} className="home-row-link-on-dark -mx-2 block rounded-xl p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{row.label}</span>
                      <span className="text-sm font-bold">{Math.round(row.driftRate * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-white/20">
                      <div
                        className="home-cpd-bar-fill h-full rounded-sm bg-surface-container-lowest/80"
                        style={{ width: `${Math.min(Math.round(row.driftRate * 100), 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-on-primary/60">{row.teachersCovered} covered</p>
                  </Link>
                ))}
              </div>
              <Link href={`/analytics?tab=cpd&window=${windowDays}&department=${deptId}`} className="mt-2 inline-block shrink-0 text-sm font-semibold text-on-primary/90 underline decoration-white/25 underline-offset-2 calm-transition hover:text-on-primary">
                View all →
              </Link>
            </>
          )}
        </Card>

        <Card className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <HomeCardHeadingSm
              icon={<IconBolt className="text-scale-some-text" />}
              title="Dept teacher priorities"
              subtitle={`${topDeptTeachers.length} teacher${topDeptTeachers.length !== 1 ? "s" : ""} in view`}
            />
            <Link href={`/analytics?tab=teachers&window=${windowDays}&department=${deptId}`} className="link-accent shrink-0 text-sm">
              View all →
            </Link>
          </div>
          {topDeptTeachers.length === 0 ? (
            <MetaText>No observation data for your department in this window.</MetaText>
          ) : (
            <ul className="space-y-1">
              {topDeptTeachers.map((row) => (
                <li key={row.teacherMembershipId}>
                  <Link href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`} className="home-row-link flex items-center justify-between gap-3 p-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={row.teacherName} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{row.teacherName}</p>
                        <p className="text-[11px] text-muted">{row.teacherCoverage} obs</p>
                      </div>
                    </div>
                    <StatusPill variant={RISK_STATUS_PILL[row.status]} size="sm">{RISK_STATUS_LABELS[row.status]}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ═══ Your Observations ═══ */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
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
        </div>
        {!selfProfile || selfProfile.teacherCoverage === 0 ? (
          <HomeEmptyPanel
            icon={<IconClipboard className="text-muted" />}
            title="No observations yet"
            description="Start an observation to see your signal profile and trends here."
            action={
              <HomePrimaryLink href="/observe/new">Start an observation</HomePrimaryLink>
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--surface-container-low)] p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-status-approved-light text-[10px] text-status-approved-text">✓</span>
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
                            className="h-full rounded-md bg-scale-strong calm-transition"
                            style={{
                              width:
                                sig.currentMean !== null
                                  ? `${signalRubricMeanBarWidthPct(sig.currentMean)}%`
                                  : "0%",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              {selfProfile.teacherCoverage >= 3 && (() => {
                const hodWatchSignals = selfProfile.signals
                  .filter((s) => s.delta !== null && s.delta < 0)
                  .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
                  .slice(0, 2);
                return hodWatchSignals.length > 0 ? (
                  <div className="rounded-xl bg-[var(--surface-container-low)] p-4 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-scale-some-light text-[10px] text-scale-some-text">⚠</span>
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
                              className="h-full rounded-md bg-scale-some-bar calm-transition"
                              style={{
                                width:
                                  sig.delta !== null ? `${signalRubricDeltaBarWidthPct(sig.delta)}%` : "0%",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/analysis/teachers/${userId}?window=${windowDays}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                View your signal profile →
              </Link>
              <Link href={`/observe/history?teacherId=${userId}&window=${windowDays}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                View observations →
              </Link>
            </div>
          </>
        )}
      </Card>

      {/* ═══ Whole-school focus (dark card) ═══ */}
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
                className="home-cpd-bar-fill h-full rounded-sm bg-surface-container-lowest/80"
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
    DENIED: "Not approved",
    CANCELLED: "Cancelled",
  };
  const loaStatusPill: Record<string, PillVariant> = {
    PENDING: "neutral",
    APPROVED: "success",
    DENIED: "error",
    CANCELLED: "neutral",
  };

  return (
    <div className="w-full min-w-0 space-y-8">
      {/* ═══ Hero Section: Observations + KPI Tiles ═══ */}
      <section className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-stretch">
        <Card className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
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
                  <div className="rounded-xl bg-[var(--surface-container-low)] p-4 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-status-approved-light text-[10px] text-status-approved-text">✓</span>
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
                              className="h-full rounded-md bg-scale-strong calm-transition"
                              style={{
                                width:
                                  sig.currentMean !== null
                                    ? `${signalRubricMeanBarWidthPct(sig.currentMean)}%`
                                    : "0%",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {watchSignals.length > 0 && (
                  <div className="rounded-xl bg-[var(--surface-container-low)] p-4 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-scale-some-light text-[10px] text-scale-some-text">⚠</span>
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
                              className="h-full rounded-md bg-scale-some-bar calm-transition"
                              style={{
                                width:
                                  sig.delta !== null ? `${signalRubricDeltaBarWidthPct(sig.delta)}%` : "0%",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href={`/analysis/teachers/${userId}?window=${windowDays}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  View your signal profile →
                </Link>
                <Link href={`/observe/history?teacherId=${userId}&window=${windowDays}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  View observations →
                </Link>
              </div>
            </div>
          )}
        </Card>

        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px]">
          <Card className="flex min-h-0 flex-1 flex-col gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Observations</p>
            <div>
              <p className="mt-1 text-[36px] font-bold leading-none tracking-[-0.02em] text-text">{obsCount}</p>
              <div className="mt-2 h-1.5 w-full rounded-sm bg-[var(--surface-container)]">
                <div className="h-full rounded-md bg-accent" style={{ width: `${Math.min(obsCount * 10, 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {obsCount > 0 ? `in the last ${windowDays} days` : "No observations yet"}
              </p>
            </div>
          </Card>

          {hasMeetingsFeature && (
            <Link href="/my-actions" className="flex min-h-0 flex-1 flex-col">
              <Card className="home-pressable-card flex min-h-0 flex-1 cursor-pointer flex-col gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Open Actions</p>
                <div>
                  <p className={`mt-1 text-[36px] font-bold leading-none tracking-[-0.02em] ${actionCount > 0 ? "text-[var(--warning)]" : "text-text"}`}>
                    {actionCount}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {actionCount > 0 ? `${actionCount} action${actionCount !== 1 ? "s" : ""} assigned` : "All caught up ✓"}
                  </p>
                </div>
              </Card>
            </Link>
          )}
        </div>
      </section>

      {/* ═══ Actions List ═══ */}
      {hasMeetingsFeature && openActions.length > 0 && (
        <Card className="space-y-4">
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
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted">
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

      {/* ═══ Leave & On-Call ═══ */}
      {(hasLeaveFeature || hasOnCallFeature) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {hasLeaveFeature && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-container)] text-muted">
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
              {loaRequest ? (
                <div className="rounded-xl bg-[var(--surface-container-low)] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-text">
                    <LeaveCalendarIcon className="shrink-0 text-muted" />
                    <span>
                      {new Date(loaRequest.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      {" – "}
                      {new Date(loaRequest.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-[var(--surface-container-low)] p-4">
                  <MetaText>No recent requests.</MetaText>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href="/leave/request" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  Request leave →
                </Link>
                <Link href="/leave" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  View status →
                </Link>
              </div>
            </Card>
          )}
          {hasOnCallFeature && (
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--tertiary-container)] text-[var(--on-primary)] [&_svg]:h-5 [&_svg]:w-5">
                    <IconBell />
                  </span>
                  <h2 className="text-base font-bold tracking-[-0.01em] text-text">On call</h2>
                </div>
                {onCallRequests.filter((r) => r.status === "OPEN").length > 0 && (
                  <StatusPill variant="error" size="sm">OPEN</StatusPill>
                )}
              </div>
              {onCallRequests.length === 0 ? (
                <div className="rounded-xl bg-[var(--surface-container-low)] p-4">
                  <MetaText>No recent on-call requests.</MetaText>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {onCallRequests.slice(0, 3).map((req) => (
                    <li key={req.id} className="flex items-center justify-between rounded-xl bg-[var(--surface-container-low)] p-3 calm-transition hover:bg-[var(--surface-container)]">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[var(--surface-container)] text-muted [&_svg]:h-3 [&_svg]:w-3">
                          <IconBell />
                        </span>
                        <span className="text-sm font-medium text-text">{new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </div>
                      <StatusPill variant={req.status === "OPEN" ? "error" : req.status === "APPROVED" ? "success" : "neutral"} size="sm">{req.status}</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Link href="/on-call/new" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  Log on-call →
                </Link>
                <Link href="/on-call" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-[12px] font-medium text-text calm-transition hover:bg-[var(--surface-container)] anx-hover-elevate">
                  View requests →
                </Link>
              </div>
            </Card>
          )}
        </section>
      )}

      {/* ═══ Whole-school focus (dark card) ═══ */}
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
              <span className="text-sm text-on-primary/70">School-wide signal movement</span>
              <span className="text-sm font-bold">{Math.round(wholeSchoolTop1.driftRate * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-white/20">
              <div
                className="home-cpd-bar-fill h-full rounded-sm bg-surface-container-lowest/80"
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
  const variant = roleVariant(user.role);

  const settings = await db.tenantSettings.findUnique({
    where: { tenantId: user.tenantId },
  });
  const rawWindow = typeof searchParams?.window === "string" ? parseInt(searchParams.window, 10) : NaN;
  const windowDays: number = ALLOWED_WINDOW_DAYS.includes(rawWindow)
    ? rawWindow
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
      const { cpdRows, teacherRows, cohortRows, studentRows, pendingLeaveCount, pendingLeaveDetails, onCallDetails, onCallStats, weekObsCount, weekObsTeachers, attainmentSummary, watchlistStudents } = await hydrateLeadershipHomeData({ user, windowDays, hasLeaveFeature, hasOnCallFeature, hasAssessmentsFeature, hasStudentAnalysisFeature });
      return (
        <LeadershipHome
          windowDays={windowDays}
          cpdRows={cpdRows}
          teacherRows={teacherRows}
          cohortRows={cohortRows}
          studentRows={studentRows}
          hasLeaveFeature={hasLeaveFeature}
          pendingLeaveCount={pendingLeaveCount}
          pendingLeaveDetails={pendingLeaveDetails}
          onCallDetails={onCallDetails}
          onCallStats={onCallStats}
          weekObsCount={weekObsCount}
          weekObsTeachers={weekObsTeachers}
          attainmentSummary={attainmentSummary ?? null}
          hasStudentAnalysisFeature={hasStudentAnalysisFeature}
          watchlistStudents={watchlistStudents}
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
        />
      );
    }

    const { selfProfile, wholeSchoolTop1, loaData, onCallData, openActionsData } = await hydrateTeacherHomeData({ user, windowDays, hasAnalysisFeature, assembly: homeAssembly });

    return (
      <TeacherHome
        windowDays={windowDays}
        selfProfile={selfProfile}
        openActions={openActionsData as MeetingActionSummary[]}
        loaRequest={loaData as LoaSummary | null}
        onCallRequests={onCallData as OnCallSummary[]}
        wholeSchoolTop1={wholeSchoolTop1}
        userId={user.id}
        hasMeetingsFeature={homeAssembly.has("operations.my-open-actions") || homeAssembly.has("operations.meetings-today")}
        hasLeaveFeature={homeAssembly.has("operations.my-leave-status")}
        hasOnCallFeature={homeAssembly.has("culture.my-oncall-status")}
      />
    );
  };

  const content = await pageContent();

  return (
    <div className="w-full min-w-0 space-y-10">
      <PageTitle
        windowDays={windowDays}
        minCoverage={(settings?.minObservationCount as number | undefined) ?? 6}
        quickActionItems={quickActionItems}
      />
      {content}
    </div>
  );
}
