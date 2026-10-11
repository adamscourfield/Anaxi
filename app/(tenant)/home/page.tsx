import { LeaderBriefing } from "@/components/home/LeaderBriefing";
import { fetchLeaderWork } from "@/modules/home/leaderWork";
import { getTenantVocab } from "@/lib/vocab";
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
import { UserRole } from "@/lib/types";
import { cookies } from "next/headers";
import { assembleHomeCards } from "@/modules/home/assembler";
import { resolveHomeVariant, showsInsightWindow } from "@/modules/home/roleVariant";
import { homeHeaderCopy } from "@/modules/home/headerCopy";
import { buildHodAttentionItems } from "@/modules/home/buildAttention";
import { AttentionStrip } from "@/components/home/AttentionStrip";
import { HomePageTitle } from "@/components/home/HomePageTitle";
import { LeadershipTodayBar } from "@/components/home/LeadershipTodayBar";
import { ExplorerPromoBand } from "@/components/home/ExplorerPromoBand";
import { CoacheePrioritiesCard } from "@/components/home/CoachHomeSections";
import { MeetingsTodayList } from "@/components/home/MeetingsTodayList";
import {
  hydrateLeadershipHomeData,
  hydrateHodHomeData,
  hydrateTeacherHomeData,
  hydrateCoachHomeData,
  hydrateHodAttentionContext,
} from "@/modules/home/hydration";
import { DepartmentSwitcher } from "@/components/home/department-switcher";
import {
  HomeCardHeading,
  HomeCardHeadingSm,
  HomeEmptyPanel,
  HomePrimaryLink,
  IconBell,
  IconBolt,
  IconCalendar,
  IconClipboard,
  IconChartBar,
  IconPhone,
  IconSparkles,
  IconUmbrella,
  IconUsersTwo,
} from "@/components/home/home-chrome";
import { avatarUrlFor } from "@/lib/avatarUpload";

const DEFAULT_WINDOW_DAYS = 21;
const ALLOWED_WINDOW_DAYS = [7, 14, 21, 28];

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

function LeaveCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
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
    <div key={`${windowDays}-${activeDeptId}`} className="w-full min-w-0 space-y-8 motion-safe:animate-page-enter">
      <AttentionStrip items={attentionItems} />
      <ExplorerPromoBand windowDays={windowDays} />
      {/* Dept switcher — navigation control, sits at top */}
      {allDepts.length > 1 && (
        <DepartmentSwitcher depts={allDepts} activeDeptId={activeDeptId} windowDays={windowDays} />
      )}

      {/* ═══ Dept staff signals ═══ */}
      <Card className="flex min-h-0 flex-col gap-6 rounded-sm !p-6 shadow-none">
        <HomeCardHeading
          icon={<IconSparkles />}
          iconTileClassName="bg-[var(--tertiary-container)] text-[var(--on-primary)] shadow-none [&_svg]:text-[var(--on-primary)]"
          title={`${deptName} staff signals`}
          subtitle={`${windowDays}-day window · ${deptTeacherRows.length} teacher${deptTeacherRows.length !== 1 ? "s" : ""} · ${deptObsCount} observations`}
          end={
            <Link href={`/insights/teaching?view=teachers&windowDays=${windowDays}&department=${deptId}`} className="link-accent shrink-0 text-xs font-semibold">
              Teaching insights →
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
                  href={`/insights/teaching?view=cpd&windowDays=${windowDays}&department=${deptId}`}
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
                          <Avatar name={row.teacherName} avatarUrl={avatarUrlFor(row.teacherMembershipId, row.avatarUpdatedAt)} />
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
          <Link href={`/insights/teaching?view=cpd&windowDays=${windowDays}`} className="mt-2 inline-block text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-on-primary/80 calm-transition hover:text-on-primary">
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
    <div key={windowDays} className="w-full min-w-0 space-y-8 motion-safe:animate-page-enter">
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
          <Link href={`/insights/teaching?view=cpd&windowDays=${windowDays}`} className="mt-2 inline-block text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-on-primary/80 calm-transition hover:text-on-primary">
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
  searchParams?: Promise<Record<string, string | string[]>>;
}) {
  const user = await getSessionUserOrThrow();
  const resolvedSearchParams = (await searchParams) ?? {};

  const coachAssignments =
    user.role === "LEADER"
      ? await (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } })
      : [];
  const coacheeCount = coachAssignments.length;
  const variant = resolveHomeVariant(user.role, coacheeCount);
  const headerCopy = homeHeaderCopy(variant);
  const allowedWindows = variant === "leadership" ? [7,21,28] : ALLOWED_WINDOW_DAYS;

  const settings = await db.tenantSettings.findUnique({
    where: { tenantId: user.tenantId },
  });
  const cookieStore = await cookies();
  const cookieWindow = parseInt(cookieStore.get(INSIGHT_WINDOW_COOKIE)?.value ?? "", 10);
  const rawWindow = typeof resolvedSearchParams.window === "string" ? parseInt(resolvedSearchParams.window, 10) : NaN;
  // The tenant's "Default insight window" setting is meant to be the school-wide
  // default, so it must win over a user's older cookie once an admin changes it --
  // otherwise anyone who has ever clicked a window toggle is permanently stuck on
  // whatever was the default at that time, no matter what the admin sets later.
  // An explicit `?window=` (clicking a toggle just now) still applies immediately.
  const windowDays: number = allowedWindows.includes(rawWindow)
    ? rawWindow
    : allowedWindows.includes(settings?.defaultInsightWindowDays as number)
      ? (settings!.defaultInsightWindowDays as number)
      : allowedWindows.includes(cookieWindow)
        ? cookieWindow
        : DEFAULT_WINDOW_DAYS;

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
  // On Call logging is never gated behind the tenant feature flag -- see
  // app/(tenant)/on-call/page.tsx. Only the reporting widgets below stay
  // conditional on it.
  quickActionItems.push({ label: "On call", href: "/on-call/new", icon: <IconPhone className="text-muted" /> });
  if (enabledFeatures.has("LEAVE")) {
    quickActionItems.push({ label: "Leave of absence", href: "/leave/request", icon: <IconUmbrella className="text-[var(--info)]" /> });
  }

  const pageContent = async () => {
    if (variant === "leadership") {
      const hasLeaveFeature = homeAssembly.has("operations.leave-approvals");
      const hasOnCallFeature = enabledFeatures.has("ON_CALL");
      const hasAssessmentsFeature = enabledFeatures.has("ASSESSMENTS");
      const hasStudentAnalysisFeature = hasAnalysisFeature && enabledFeatures.has("STUDENTS");

      const [leadershipData, work, vocab] = await Promise.all([
        hydrateLeadershipHomeData({ user, windowDays, hasAnalysisFeature, hasLeaveFeature, hasOnCallFeature, hasAssessmentsFeature, hasStudentAnalysisFeature }),
        fetchLeaderWork(user, enabledFeatures.has("MEETINGS")),
        getTenantVocab(user.tenantId),
      ]);
      return <LeaderBriefing data={leadershipData} work={work} windowDays={windowDays}
        features={{analysis:hasAnalysisFeature, students:hasAnalysisFeature && hasStudentAnalysisFeature && enabledFeatures.has("STUDENTS"), assessments:hasAssessmentsFeature, leave:hasLeaveFeature, onCall:hasOnCallFeature, observations:enabledFeatures.has("OBSERVATIONS")}}
        reasons={{attendance:"Attendance has fallen", detentions:vocab.detentions.plural+" have increased", onCalls:vocab.on_calls.plural+" have increased", suspensions:vocab.suspensions.plural+" have increased", internalExclusions:vocab.internal_exclusions.plural+" have increased", lateness:"Lateness has increased"}} />;

    }

    if (variant === "hod") {
      const rawDept = typeof resolvedSearchParams.dept === "string" ? resolvedSearchParams.dept : null;
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
  const rawDeptQuery = typeof resolvedSearchParams.dept === "string" ? `dept=${resolvedSearchParams.dept}` : undefined;

  return (
    <div className={variant === "leadership" ? "w-full min-w-0 space-y-6" : "w-full min-w-0 space-y-10"}>
      <HomePageTitle
        copy={headerCopy}
        windowDays={windowDays}
        showWindowSelector={variant !== "leadership" && showsInsightWindow(variant)}
        windowExtraQuery={rawDeptQuery}
        quickActionItems={quickActionItems}
        role={user.role}
      />
      {content}
    </div>
  );
}
