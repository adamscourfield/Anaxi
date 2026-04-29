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
import {
  HomeCardHeading,
  HomeCardHeadingSm,
  HomeEmptyPanel,
  HomePageHeader,
  HomePrimaryLink,
  HomeSectionHeader,
  IconBell,
  IconBolt,
  IconCalendar,
  IconChartBar,
  IconClipboard,
  IconPhone,
  IconSearch,
  IconSparkles,
  IconStar,
  IconTrendDown,
  IconTrendUp,
  IconUmbrella,
} from "@/components/home/home-chrome";
import { ppTableBadgeClass, sendTableBadgeClass } from "@/modules/assessments/attainmentColours";

const DEFAULT_WINDOW_DAYS = 21;
const ALLOWED_WINDOW_DAYS = [7, 14, 21, 28];

function studentAnalysisHref(studentId: string, windowDays: number): string {
  return `/analysis/students/${studentId}?window=${windowDays}`;
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

function LeaveCloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function LeaveCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function WindowSelector({ windowDays }: { windowDays: number }) {
  return (
    <div className="segmented-toggle">
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
  quickActionItems,
}: {
  windowDays: number;
  quickActionItems: { label: string; href: string; icon: ReactNode }[];
}) {
  return (
    <HomePageHeader
      eyebrow="Dashboard"
      title="Institutional Pulse"
      subtitle="Coverage, signals, and operational status for your school — tuned to the selected window."
      actions={
        <>
          <div className="min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch] pb-0.5 sm:pb-0">
            <WindowSelector windowDays={windowDays} />
          </div>
          {quickActionItems.length > 0 ? <QuickActionButton items={quickActionItems} /> : null}
        </>
      }
    />
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
  openOnCallCount,
  pendingLeaveDetails,
  onCallDetails,
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
  openOnCallCount: number;
  pendingLeaveDetails: PendingLeaveDetail[];
  onCallDetails: OnCallDetail[];
  weekObsCount: number;
  weekObsTeachers: { id: string; name: string }[];
  attainmentSummary: AttainmentSummary | null;
  hasStudentAnalysisFeature?: boolean;
  watchlistStudents?: StudentRiskRow[];
}) {
  const allDriftingCpd = cpdRows.filter((r) => r.teachersDriftingDown > 0);
  const topCpd = allDriftingCpd.slice(0, 3);
  const topTeachers = teacherRows.slice(0, 3);
  const totalObs = teacherRows.reduce((sum, r) => sum + r.teacherCoverage, 0);

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

  // Least observed teachers (sorted ascending by coverage)
  const leastObserved = [...teacherRows]
    .sort((a, b) => a.teacherCoverage - b.teacherCoverage)
    .slice(0, 3);

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

  // On-call: separate open vs resolved
  const openOnCalls = onCallDetails.filter((r) => r.status === "OPEN" || r.status === "ACKNOWLEDGED");
  const resolvedOnCalls = onCallDetails.filter((r) => r.status === "RESOLVED");

  const topOnCallRows = onCallDetails.slice(0, 3);
  const firstImmediateSupportIdx = topOnCallRows.findIndex(
    (oc) => oc.status === "OPEN" || oc.status === "ACKNOWLEDGED"
  );

  return (
    <div className="w-full min-w-0 space-y-8">
      {/* ═══ Hero Section 1: On-Call Status + Attendance + Observations ═══ */}
      <section className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-stretch">
        {/* On-Call Live Status (main box) */}
        <Card
          id="on-call-status-card"
          className="scroll-mt-20 flex min-h-0 min-w-0 flex-1 flex-col gap-4"
        >
          <HomeCardHeading
            icon={<IconBell />}
            title="On-call status"
            subtitle="Anaxi core response"
            end={openOnCalls.length > 0 ? <StatusPill variant="error" size="sm">LIVE RESPONSE</StatusPill> : null}
          />
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
                  className={`flex min-w-0 flex-col gap-2 rounded-xl p-3 calm-transition sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4 ${
                    i === firstImmediateSupportIdx ? "scroll-mt-20" : ""
                  } ${
                    oc.status === "OPEN" || oc.status === "ACKNOWLEDGED"
                      ? "bg-[var(--surface-container-low)]"
                      : "bg-[var(--surface-container-lowest)]"
                  }`}
                >
                  <Link
                    href={`/on-call/${oc.id}`}
                    className="home-row-link flex min-w-0 flex-1 items-center gap-2 sm:min-w-0 sm:gap-3"
                  >
                    <Avatar name={oc.requesterName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{oc.requesterName}</p>
                      <p className="truncate text-xs text-muted">{oc.location}</p>
                    </div>
                  </Link>
                  <div className="flex min-w-0 shrink-0 flex-row flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right sm:flex-nowrap">
                    {(oc.status === "OPEN" || oc.status === "ACKNOWLEDGED") ? (
                      <>
                        <div className="hidden max-w-[140px] flex-col items-end gap-0.5 sm:flex sm:max-w-none">
                          <span className="text-xs font-medium text-[var(--error)]">Immediate Support Needed</span>
                          <span className="text-xs text-muted">
                            {(() => {
                              const mins = Math.round((Date.now() - new Date(oc.createdAt).getTime()) / 60000);
                              return mins < 60 ? `Triggered ${mins}m ago` : `Triggered ${Math.round(mins / 60)}h ago`;
                            })()}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-[var(--error)] sm:hidden">Live</span>
                        <Link
                          href="/on-call"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-on-primary calm-transition hover:bg-primaryBtnHover sm:h-8 sm:w-8"
                          aria-label="Open on-call inbox"
                        >
                          →
                        </Link>
                      </>
                    ) : (
                      <span className="min-w-0 max-w-full truncate text-[10px] text-muted sm:max-w-none sm:overflow-visible sm:whitespace-normal sm:text-xs">
                        RESOLVED · {new Date(oc.resolvedAt ?? oc.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right column: Attendance + Observations */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px]">
          {/* Attendance box */}
          <Card className="flex min-h-0 flex-1 flex-col gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Attendance</p>
            <div>
              <p className="mt-1 text-[36px] font-bold leading-none tracking-[-0.02em] text-text">
                {attendancePct !== null ? `${attendancePct.toFixed(1)}%` : "—"}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-container)]">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.min(attendancePct ?? 0, 100)}%` }}
                />
              </div>
              {attendanceDelta !== null && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                  <span className={attendanceDelta >= 0 ? "text-positive" : "text-negative"}>
                    {attendanceDelta >= 0 ? <IconTrendUp className="inline h-3.5 w-3.5" /> : <IconTrendDown className="inline h-3.5 w-3.5" />}
                  </span>
                  <span className={attendanceDelta >= 0 ? "text-positive" : "text-negative"}>
                    {attendanceDelta >= 0 ? "+" : ""}{attendanceDelta.toFixed(1)}%
                  </span>{" "}
                  from last week
                </p>
              )}
              {attendancePct !== null && (
                <p className="mt-2 text-xs text-muted">
                  School-wide mean across cohorts with attendance data ({windowDays}-day window).
                </p>
              )}
            </div>
          </Card>

          {/* Observations this week box — avoid min-h-0 so flex stretch cannot clip avatars; extra bottom pad clears rounded edge */}
          <Link href="/explorer/observations" className="flex flex-1 flex-col">
            <Card className="home-pressable-card flex min-h-min flex-1 cursor-pointer flex-col gap-4 pb-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Observations This Week</p>
              <div>
                <p className="mt-1 text-[36px] font-bold leading-none tracking-[-0.02em] text-text">
                  {weekObsCount}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  {weekObsTeachers.slice(0, 3).map((t) => (
                    <Avatar key={t.id} name={t.name} size="sm" />
                  ))}
                  {weekObsTeachers.length > 3 && (
                    <span className="inline-flex h-7 w-auto min-w-[28px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[10px] font-semibold text-on-primary">
                      +{weekObsTeachers.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </Link>
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
                        <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${bandCfg.badge}`}>
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
                              className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-text/70 ring-1 ring-inset ring-black/[0.06]"
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

      {/* ═══ Hero Section 2: Leave Governance ═══ */}
      {hasLeaveFeature && (
        <section className="rounded-xl border-0 bg-[color-mix(in_srgb,var(--surface-container-low)_65%,transparent)] p-4 outline-none ring-0 sm:p-6 md:p-8">
          <HomeSectionHeader
            eyebrow="Operations"
            title="Leave governance"
            description={`Pending administrative approvals for ${leaveGovernanceQuarterLabel()}`}
            action={
              <Link
                href="/leave/pending"
                className="link-accent shrink-0 text-sm font-semibold"
              >
                View all →
              </Link>
            }
          />

          {pendingLeaveDetails.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] bg-[var(--surface-container-lowest)] px-5 py-10 text-center">
              <MetaText>No pending leave requests.</MetaText>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pendingLeaveDetails.map((leave) => {
                const reasonUpper = (leave.reasonLabel ?? "PERSONAL").toUpperCase();
                const isEmergency = reasonUpper.includes("EMERGENCY") || reasonUpper.includes("URGENT");
                const isCpd = reasonUpper.includes("CPD") || reasonUpper.includes("TRAINING");
                const pillVariant: PillVariant = isEmergency ? "error" : isCpd ? "accent" : "neutral";
                const rangeLabel = leaveDateRangeLabel(leave.startDate, leave.endDate);
                return (
                  <article
                    key={leave.id}
                    className={`flex flex-col rounded-xl bg-surface-container-lowest p-5 shadow-ambient transition-shadow hover:shadow-lg ${
                      isEmergency
                        ? "border border-[var(--outline-variant)]/15 border-l-4 border-l-[#6b1619]"
                        : "border border-[var(--outline-variant)]/15"
                    }`}
                  >
                    <Link href={`/leave/${leave.id}`} className="block min-w-0 flex-1 calm-transition">
                      <div className="flex items-start justify-between gap-2">
                        {isEmergency ? (
                          <span className="inline-flex items-center rounded-full bg-[#3d060b] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#fecdd3]">
                            {leave.reasonLabel?.toUpperCase() ?? "EMERGENCY"}
                          </span>
                        ) : isCpd ? (
                          <span className="inline-flex items-center rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant ring-1 ring-inset ring-border/40">
                            {leave.reasonLabel?.toUpperCase() ?? "CPD TRAINING"}
                          </span>
                        ) : (
                          <StatusPill variant={pillVariant} size="sm" className="!rounded-full !text-[10px] !font-bold !uppercase !tracking-wide">
                            {leave.reasonLabel?.toUpperCase() ?? "PERSONAL"}
                          </StatusPill>
                        )}
                        <span className="shrink-0 text-[10px] font-medium text-muted">
                          Sub: {leaveSubmissionLabel(leave.createdAt)}
                        </span>
                      </div>
                      <p className="mt-4 text-sm font-bold text-text">{leave.requesterName}</p>
                      {leave.notes ? (
                        <p className="mt-1 text-xs italic text-muted">&ldquo;{leave.notes}&rdquo;</p>
                      ) : (
                        <p className="mt-1 text-xs italic text-muted opacity-60">No reason provided.</p>
                      )}
                    </Link>
                    <div className="mt-4 flex items-center justify-between border-t border-[var(--outline-variant)]/15 pt-4">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <LeaveCalendarIcon className="shrink-0 text-muted" />
                        <span className={isEmergency ? "text-[#c06c6c]" : "text-muted"}>{rangeLabel}</span>
                      </div>
                      {isEmergency ? (
                        <Link
                          href="/leave/pending"
                          className="shrink-0 rounded bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-on-primary calm-transition hover:bg-[var(--accent-hover)]"
                        >
                          APPROVE NOW
                        </Link>
                      ) : (
                        <div className="flex shrink-0 gap-1">
                          <Link
                            href="/leave/pending"
                            aria-label={`Deny leave for ${leave.requesterName}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[#c06c6c] calm-transition hover:bg-status-denied-light"
                          >
                            <LeaveCloseIcon />
                          </Link>
                          <Link
                            href="/leave/pending"
                            aria-label={`Approve leave for ${leave.requesterName}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-positive calm-transition hover:bg-status-approved-light"
                          >
                            <LeaveCheckIcon />
                          </Link>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ═══ Hero Section 3: Signal Analysis ═══ */}
      <section className="grid gap-4 lg:grid-cols-12">
        {/* CPD Priorities (dark box) */}
        <Card className="space-y-4 !bg-[var(--primary)] !text-on-primary !shadow-ambient lg:col-span-5">
          <div className="flex items-center gap-2">
            <span className="text-[var(--on-primary)] [&_svg]:h-5 [&_svg]:w-5">
              <IconSparkles />
            </span>
            <h2 className="text-base font-bold tracking-[-0.01em]">CPD priorities</h2>
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
                    <div className="mt-1 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                      <div className="h-full rounded-full bg-surface-container-lowest/80" style={{ width: `${Math.min(Math.round(row.driftRate * 100), 100)}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
              <Link href={`/analytics?tab=cpd&window=${windowDays}`} className="mt-2 inline-block shrink-0 text-sm font-semibold text-on-primary/90 underline decoration-white/25 underline-offset-2 calm-transition hover:text-on-primary">
                View all →
              </Link>
            </>
          )}
        </Card>

        {/* Staff Needing Intervention */}
        <Card className="space-y-4 lg:col-span-4">
          <HomeCardHeadingSm
            icon={<IconBolt className="text-scale-some-text" />}
            title="Staff intervention"
            subtitle={`${interventionStaff.length} staff needing support`}
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
        </Card>

        {/* Least Observed Teachers */}
        <Card tone="inset" className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold tracking-[-0.01em] text-text">Observation coverage</h2>
              <p className="text-xs text-muted">Least observed this window</p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-container)] text-muted [&_svg]:h-4 [&_svg]:w-4">
              <IconSearch />
            </span>
          </div>
          {leastObserved.length === 0 ? (
            <MetaText>No teacher data available.</MetaText>
          ) : (
            <ul className="space-y-2">
              {leastObserved.map((row) => (
                <li key={row.teacherMembershipId}>
                  <Link href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`} className="home-row-link flex items-center justify-between gap-2 p-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={row.teacherName} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{row.teacherName}</p>
                        <p className="text-[11px] text-muted">{row.departmentNames.join(", ") || "No dept"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-container)] text-[10px] font-bold text-text">
                        {row.teacherCoverage}
                      </span>
                      <span className="text-[11px] text-muted">obs</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ═══ Attainment Summary ═══ */}
      {attainmentSummary && (
        <Card className="space-y-4">
          <HomeCardHeadingSm
            icon={<IconChartBar className="text-[var(--info)]" />}
            title="Attainment"
            subtitle={
              attainmentSummary.latestPointLabel
                ? `${attainmentSummary.cycleLabel} · ${attainmentSummary.latestPointLabel}`
                : attainmentSummary.cycleLabel
            }
            end={
              <Link href="/assessments" className="link-accent shrink-0 text-sm">
                View all →
              </Link>
            }
          />

          {/* Stat row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Subjects assessed"
              value={attainmentSummary.subjectCount}
              context={`${attainmentSummary.totalResults.toLocaleString()} results recorded`}
              accent="accent"
              accentPlacement="top"
              tone="glass"
            />
            <StatCard
              label="Students assessed"
              value={attainmentSummary.studentCount}
              context={attainmentSummary.latestPointLabel ?? "Latest point"}
              accent="info"
              accentPlacement="top"
              tone="glass"
            />
            <StatCard
              label="Dual-flagged"
              value={attainmentSummary.triangulatedCount}
              context={
                attainmentSummary.triangulatedCount > 0
                  ? `${attainmentSummary.urgentCount} urgent · ${attainmentSummary.priorityCount} priority`
                  : "No students dual-flagged"
              }
              accent={attainmentSummary.triangulatedCount > 0 ? "error" : "success"}
              href={attainmentSummary.triangulatedCount > 0 ? "/assessments/triangulation" : undefined}
              accentPlacement="top"
              tone="glass"
            />
          </div>

          {/* Dual-flagged student list */}
          {attainmentSummary.topDualFlagged.length > 0 && (
            <Card tone="inset" className="space-y-3 !p-4 sm:!p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Dual-flagged students — attainment + pastoral risk
                </p>
                <Link href="/assessments/triangulation" className="link-accent shrink-0 text-xs">
                  View all →
                </Link>
              </div>
              <ul className="space-y-1">
                {attainmentSummary.topDualFlagged.map((s: DualFlaggedStudent) => (
                  <li key={s.studentId}>
                    <Link
                      href={studentAnalysisHref(s.studentId, windowDays)}
                      className="home-row-link flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-text">{s.studentName}</span>
                          {s.yearGroup && <span className="text-[11px] text-muted">{s.yearGroup}</span>}
                          {s.ppFlag && <span className={ppTableBadgeClass}>PP</span>}
                          {s.sendFlag && <span className={sendTableBadgeClass}>SEND</span>}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted">
                          Lowest: {s.worstSubject} — {s.worstGrade}
                          {s.worstNormalizedScore !== null && ` (${Math.round(s.worstNormalizedScore * 100)}%)`}
                        </p>
                      </div>
                      <StatusPill
                        variant={s.behaviouralBand === "URGENT" ? "error" : s.behaviouralBand === "PRIORITY" ? "warning" : "neutral"}
                        size="sm"
                      >
                        {s.behaviouralBand === "URGENT" ? "Urgent" : s.behaviouralBand === "PRIORITY" ? "Priority" : s.behaviouralBand}
                      </StatusPill>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </Card>
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
            <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-container)]">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(deptObsCount * 5, 100)}%` }} />
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
        <Card className="space-y-4 !bg-[var(--primary)] !text-on-primary !shadow-ambient lg:col-span-5">
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
                    <div className="mt-1 h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                      <div className="h-full rounded-full bg-surface-container-lowest/80" style={{ width: `${Math.min(Math.round(row.driftRate * 100), 100)}%` }} />
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
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-status-approved-light">
                          <div
                            className="h-full rounded-full bg-scale-strong calm-transition"
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
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-scale-some-light">
                            <div
                              className="h-full rounded-full bg-scale-some-bar calm-transition"
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
        <Card className="space-y-4 !bg-[var(--primary)] !text-on-primary !shadow-ambient">
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
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-surface-container-lowest/80" style={{ width: `${Math.min(Math.round(wholeSchoolTop1.driftRate * 100), 100)}%` }} />
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
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-status-approved-light">
                            <div
                              className="h-full rounded-full bg-scale-strong calm-transition"
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
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-scale-some-light">
                            <div
                              className="h-full rounded-full bg-scale-some-bar calm-transition"
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
              <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--surface-container)]">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(obsCount * 10, 100)}%` }} />
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
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container-low)] text-muted">
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
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-container)] text-muted [&_svg]:h-3 [&_svg]:w-3">
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
        <Card className="space-y-4 !bg-[var(--primary)] !text-on-primary !shadow-ambient">
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
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-surface-container-lowest/80" style={{ width: `${Math.min(Math.round(wholeSchoolTop1.driftRate * 100), 100)}%` }} />
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
      const { cpdRows, teacherRows, cohortRows, studentRows, pendingLeaveCount, openOnCallCount, pendingLeaveDetails, onCallDetails, weekObsCount, weekObsTeachers, attainmentSummary, watchlistStudents } = await hydrateLeadershipHomeData({ user, windowDays, hasLeaveFeature, hasOnCallFeature, hasAssessmentsFeature, hasStudentAnalysisFeature });
      return (
        <LeadershipHome
          windowDays={windowDays}
          cpdRows={cpdRows}
          teacherRows={teacherRows}
          cohortRows={cohortRows}
          studentRows={studentRows}
          hasLeaveFeature={hasLeaveFeature}
          pendingLeaveCount={pendingLeaveCount}
          openOnCallCount={openOnCallCount}
          pendingLeaveDetails={pendingLeaveDetails}
          onCallDetails={onCallDetails}
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
      <PageTitle windowDays={windowDays} quickActionItems={quickActionItems} />
      {content}
    </div>
  );
}
