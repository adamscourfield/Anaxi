import Link from "next/link";
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
} from "@/modules/home/hydration";
import { QuickActionButton } from "@/components/dashboard/QuickActionButton";

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


function roleVariant(role: UserRole): "leadership" | "hod" | "teacher" {
  if (role === "ADMIN" || role === "SLT") return "leadership";
  if (role === "HOD") return "hod";
  return "teacher";
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
  quickActionItems: { label: string; href: string; icon: string }[];
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-[28px] font-bold tracking-[-0.03em] text-text">
        Institutional Pulse
      </h1>
      <div className="flex items-center gap-3">
        <WindowSelector windowDays={windowDays} />
        <QuickActionButton items={quickActionItems} />
      </div>
    </div>
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

  // On-call: separate open vs resolved
  const openOnCalls = onCallDetails.filter((r) => r.status === "OPEN" || r.status === "ACKNOWLEDGED");
  const resolvedOnCalls = onCallDetails.filter((r) => r.status === "RESOLVED");

  return (
    <div className="space-y-6">
      {/* ═══ Hero Section 1: On-Call Status + Attendance + Observations ═══ */}
      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* On-Call Live Status (main box) */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tertiary-container)] text-on-primary text-lg">🔔</span>
              <h2 className="text-[1rem] font-bold tracking-[-0.01em] text-text">Anaxi Core: On-Call Status</h2>
            </div>
            {openOnCalls.length > 0 && (
              <StatusPill variant="error" size="sm">LIVE RESPONSE</StatusPill>
            )}
          </div>
          {onCallDetails.length === 0 ? (
            <div className="rounded-xl bg-[var(--surface-container-low)] p-4">
              <MetaText>No recent on-call requests.</MetaText>
            </div>
          ) : (
            <div className="space-y-2">
              {onCallDetails.slice(0, 3).map((oc) => (
                <Link
                  key={oc.id}
                  href={`/on-call/${oc.id}`}
                  className={`flex items-center justify-between rounded-xl p-4 calm-transition hover:bg-[var(--surface-container)] ${
                    oc.status === "OPEN" || oc.status === "ACKNOWLEDGED"
                      ? "bg-[var(--surface-container-low)]"
                      : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={oc.requesterName} size="md" />
                    <div>
                      <p className="text-sm font-medium text-text">{oc.requesterName}</p>
                      <p className="text-xs text-muted">{oc.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    {(oc.status === "OPEN" || oc.status === "ACKNOWLEDGED") ? (
                      <>
                        <span className="text-xs font-medium text-[var(--error)]">Immediate Support Needed</span>
                        <span className="text-xs text-muted">
                          {(() => {
                            const mins = Math.round((Date.now() - new Date(oc.createdAt).getTime()) / 60000);
                            return mins < 60 ? `Triggered ${mins}m ago` : `Triggered ${Math.round(mins / 60)}h ago`;
                          })()}
                        </span>
                        <Link href={`/on-call`} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary">→</Link>
                      </>
                    ) : (
                      <span className="text-xs text-muted">
                        RESOLVED · {new Date(oc.resolvedAt ?? oc.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Right column: Attendance + Observations */}
        <div className="grid gap-4 grid-rows-2">
          {/* Attendance box */}
          <Card className="flex flex-col justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Attendance Mastery</p>
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
                  <span className={attendanceDelta >= 0 ? "text-positive" : "text-negative"}>📈</span>
                  <span className={attendanceDelta >= 0 ? "text-positive" : "text-negative"}>
                    {attendanceDelta >= 0 ? "+" : ""}{attendanceDelta.toFixed(1)}%
                  </span>{" "}
                  from last week
                </p>
              )}
            </div>
          </Card>

          {/* Observations this week box */}
          <Link href="/explorer/observations" className="block">
          <Card className="flex flex-col justify-between calm-transition hover:bg-[var(--surface-container-low)] hover:shadow-md cursor-pointer">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Observations This Week</p>
            <div>
              <p className="mt-1 text-[36px] font-bold leading-none tracking-[-0.02em] text-text">
                {weekObsCount}
              </p>
              <div className="mt-3 flex items-center gap-1">
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

      {/* ═══ Hero Section 2: Leave Governance ═══ */}
      {hasLeaveFeature && (
        <section>
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[1.1rem] font-bold tracking-[-0.01em] text-text">Leave Governance</h2>
                <p className="mt-0.5 text-[13px] text-muted">Pending administrative approvals</p>
              </div>
              <Link href="/leave/pending" className="text-[0.8rem] font-medium text-text underline decoration-text/30 underline-offset-2 calm-transition hover:decoration-text">View All Requests →</Link>
            </div>
            {pendingLeaveDetails.length === 0 ? (
              <MetaText>No pending leave requests.</MetaText>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pendingLeaveDetails.map((leave) => {
                  const reasonUpper = (leave.reasonLabel ?? "PERSONAL").toUpperCase();
                  const isEmergency = reasonUpper.includes("EMERGENCY") || reasonUpper.includes("URGENT");
                  const isCpd = reasonUpper.includes("CPD") || reasonUpper.includes("TRAINING");
                  const pillVariant: PillVariant = isEmergency ? "error" : isCpd ? "accent" : "neutral";
                  return (
                    <Link
                      key={leave.id}
                      href={`/leave/${leave.id}`}
                      className={`block rounded-2xl border p-4 calm-transition hover:shadow-md hover:bg-[var(--surface-container-low)] ${isEmergency ? "border-[var(--pill-error-ring)]" : "border-border/60"}`}
                    >
                      <div className="flex items-center justify-between">
                        <StatusPill variant={pillVariant} size="sm">
                          {leave.reasonLabel?.toUpperCase() ?? "PERSONAL"}
                        </StatusPill>
                        <span className="text-[11px] text-muted">
                          Sub: {new Date(leave.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-text">{leave.requesterName}</p>
                      {leave.notes && (
                        <p className="mt-0.5 text-xs italic text-muted">&ldquo;{leave.notes}&rdquo;</p>
                      )}
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <span>📅</span>
                          {new Date(leave.startDate).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                          {" – "}
                          {new Date(leave.endDate).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                        </div>
                        {isEmergency ? (
                          <Link href="/leave/pending" className="rounded-lg border border-text bg-surface-container-lowest px-3 py-1 text-[11px] font-semibold text-text calm-transition hover:bg-[var(--surface-container-low)]">
                            APPROVE NOW
                          </Link>
                        ) : (
                          <div className="flex gap-2">
                            <Link href="/leave/pending" aria-label={`Deny leave for ${leave.requesterName}`} className="text-[var(--error)] calm-transition hover:opacity-70">✕</Link>
                            <Link href="/leave/pending" aria-label={`Approve leave for ${leave.requesterName}`} className="text-positive calm-transition hover:opacity-70">✓</Link>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </section>
      )}

      {/* ═══ Hero Section 3: Signal Analysis ═══ */}
      <section className="grid gap-4 lg:grid-cols-12">
        {/* CPD Priorities (dark box) */}
        <Card className="space-y-4 !bg-[var(--primary)] !text-on-primary !shadow-lg lg:col-span-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">✦</span>
            <h2 className="text-[1rem] font-bold tracking-[-0.01em]">CPD Priorities</h2>
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
                  <Link key={row.signalKey} href={`/analysis/cpd/${row.signalKey}?window=${windowDays}`} className="block rounded-xl p-2 -mx-2 calm-transition hover:bg-white/10">
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
              <Link href={`/analytics?tab=cpd&window=${windowDays}`} className="mt-2 inline-block text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-on-primary/80 calm-transition hover:text-on-primary">
                Explore CPD Data ↗
              </Link>
            </>
          )}
        </Card>

        {/* Staff Needing Intervention */}
        <Card className="space-y-4 lg:col-span-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-container)] text-sm">⚡</span>
            <div>
              <h2 className="text-[1rem] font-bold tracking-[-0.01em] text-text">Staff Intervention</h2>
              <p className="text-xs text-muted">{interventionStaff.length} staff needing support</p>
            </div>
          </div>
          {interventionStaff.length === 0 ? (
            <MetaText>All staff stable — no intervention needed.</MetaText>
          ) : (
            <ul className="space-y-2">
              {interventionStaff.map((row) => (
                <li key={row.teacherMembershipId}>
                  <Link href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`} className="flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-[var(--surface-container-low)] calm-transition">
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
              <h2 className="text-[1rem] font-bold tracking-[-0.01em] text-text">Observation Coverage</h2>
              <p className="text-xs text-muted">Least observed this window</p>
            </div>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-container)] text-sm">🔍</span>
          </div>
          {leastObserved.length === 0 ? (
            <MetaText>No teacher data available.</MetaText>
          ) : (
            <ul className="space-y-2">
              {leastObserved.map((row) => (
                <li key={row.teacherMembershipId}>
                  <Link href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`} className="flex items-center justify-between gap-2 rounded-xl p-2 hover:bg-[var(--surface-container-low)] calm-transition">
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
        <section>
          <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Attainment · {attainmentSummary.cycleLabel}</p>
              <p className="text-sm text-muted">
                {attainmentSummary.totalAssessments} assessment{attainmentSummary.totalAssessments !== 1 ? "s" : ""} · {attainmentSummary.totalResults.toLocaleString()} results recorded
              </p>
            </div>
            <div className="flex items-center gap-3">
              {attainmentSummary.triangulatedCount > 0 && (
                <Link
                  href="/assessments/triangulation"
                  className="inline-flex items-center gap-1 rounded-lg bg-risk-urgent-bg px-3 py-1.5 text-xs font-medium text-risk-urgent-text hover:opacity-80"
                >
                  {attainmentSummary.triangulatedCount} dual-flagged →
                </Link>
              )}
              <Link href="/assessments" className="text-sm text-accent hover:underline">
                View assessments →
              </Link>
            </div>
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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={`${deptName} observations`}
          value={deptObsCount}
          context={`${deptTeacherRows.length} teacher${deptTeacherRows.length !== 1 ? "s" : ""} · ${windowDays}d window`}
          accent="accent"
        />
        <StatCard
          label={`${deptName} CPD signals`}
          value={deptCpdDrift}
          context={deptCpdDrift > 0 ? `${deptCpdDrift} signal${deptCpdDrift !== 1 ? "s" : ""} weakening` : "All signals stable"}
          accent={deptCpdDrift > 0 ? "warning" : "success"}
        />
      </div>

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

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">Dept CPD priorities</h2>
            <Link href={`/analytics?tab=cpd&window=${windowDays}&department=${deptId}`} className="text-[0.75rem] font-medium text-accent calm-transition hover:text-accentHover">View all →</Link>
          </div>
          {topDeptCpd.length === 0 ? (
            <MetaText>No weakening signals detected in this window.</MetaText>
          ) : (
            <ul className="space-y-1">
              {topDeptCpd.map((row) => (
                <li key={row.signalKey}>
                  <Link href={`/analysis/cpd/${row.signalKey}?window=${windowDays}&department=${deptId}`} className="block rounded-lg p-3 hover:bg-bg/60 calm-transition">
                    <p className="text-sm font-medium text-text">{row.label}</p>
                    <MetaText>{Math.round(row.driftRate * 100)}% drifting · {row.teachersCovered} covered</MetaText>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">Dept teacher priorities</h2>
            <Link href={`/analytics?tab=teachers&window=${windowDays}&department=${deptId}`} className="text-[0.75rem] font-medium text-accent calm-transition hover:text-accentHover">View all →</Link>
          </div>
          {topDeptTeachers.length === 0 ? (
            <MetaText>No observation data for your department in this window.</MetaText>
          ) : (
            <ul className="space-y-1">
              {topDeptTeachers.map((row) => (
                <li key={row.teacherMembershipId}>
                  <Link href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`} className="flex items-center justify-between gap-3 rounded-lg p-3 hover:bg-bg/60 calm-transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={row.teacherName} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{row.teacherName}</p>
                        <MetaText>{row.teacherCoverage} obs</MetaText>
                      </div>
                    </div>
                    <StatusPill variant={RISK_STATUS_PILL[row.status]}>{RISK_STATUS_LABELS[row.status]}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">Your recent observations</h2>
        <Card className="space-y-3">
          {!selfProfile || selfProfile.teacherCoverage === 0 ? (
            <div className="space-y-2">
              <BodyText className="text-muted">No observations captured yet.</BodyText>
              <Link href="/observe/new" className="text-[12px] text-accent hover:underline">Start an observation →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              <MetaText>
                {selfProfile.teacherCoverage} observation{selfProfile.teacherCoverage !== 1 ? "s" : ""} in last {windowDays} days
                {selfProfile.lastObservationAt && (
                  <> · Last: {new Date(selfProfile.lastObservationAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
                )}
              </MetaText>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <MetaText className="font-medium text-text">Strengths</MetaText>
                  <div className="flex flex-wrap gap-1">
                    {selfProfile.signals
                      .filter((s) => s.currentMean !== null)
                      .sort((a, b) => (b.currentMean ?? 0) - (a.currentMean ?? 0))
                      .slice(0, 3)
                      .map((sig) => (
                        <span key={sig.signalKey} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text">{sig.label}</span>
                      ))}
                  </div>
                </div>
                {selfProfile.teacherCoverage >= 3 && (
                  <div className="space-y-1.5">
                    <MetaText className="font-medium text-text">Areas to watch</MetaText>
                    <div className="flex flex-wrap gap-1">
                      {selfProfile.signals
                        .filter((s) => s.delta !== null && s.delta < 0)
                        .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
                        .slice(0, 2)
                        .map((sig) => (
                          <span key={sig.signalKey} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-[var(--warning)]">{sig.label}</span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/analysis/teachers/${userId}?window=${windowDays}`} className="text-[12px] text-accent hover:underline">View your signal profile →</Link>
                <Link href={`/observe/history?teacherId=${userId}&window=${windowDays}`} className="text-[12px] text-accent hover:underline">View observations →</Link>
              </div>
            </div>
          )}
        </Card>
      </section>

      {wholeSchoolTop1 && (
        <Card className="space-y-2">
          <h2 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">Whole-school focus</h2>
          <p className="text-sm text-text">{wholeSchoolTop1.label}</p>
          <MetaText>{Math.round(wholeSchoolTop1.driftRate * 100)}% of covered teachers · {wholeSchoolTop1.teachersCovered} covered</MetaText>
          <Link href={`/analytics?tab=cpd&window=${windowDays}`} className="text-[12px] text-accent hover:underline">See CPD priorities →</Link>
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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Your observations"
          value={obsCount}
          context={obsCount > 0 ? `${windowDays}d window` : "No observations yet"}
          accent="accent"
          href={`/observe/history?teacherId=${userId}&window=${windowDays}`}
        />
        <StatCard
          label="Open actions"
          value={hasMeetingsFeature ? actionCount : "—"}
          context={hasMeetingsFeature ? (actionCount > 0 ? `${actionCount} action${actionCount !== 1 ? "s" : ""} assigned` : "All caught up") : "Meetings not enabled"}
          accent={hasMeetingsFeature && actionCount > 0 ? "warning" : "success"}
          href={hasMeetingsFeature ? "/my-actions" : undefined}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">Your recent observations</h2>
        <Card className="space-y-3">
          {!selfProfile || selfProfile.teacherCoverage === 0 ? (
            <div className="space-y-2">
              <BodyText className="text-muted">No observations captured yet in this window.</BodyText>
              <Link href="/observe/new" className="text-[12px] text-accent hover:underline">Start an observation →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              <MetaText>
                {selfProfile.teacherCoverage} observation{selfProfile.teacherCoverage !== 1 ? "s" : ""} in last {windowDays} days
                {selfProfile.lastObservationAt && (
                  <> · Last: {new Date(selfProfile.lastObservationAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
                )}
              </MetaText>
              <div className="grid gap-4 sm:grid-cols-2">
                {strengthSignals.length > 0 && (
                  <div className="space-y-1.5">
                    <MetaText className="font-medium text-text">Strengths</MetaText>
                    <div className="flex flex-wrap gap-1">
                      {strengthSignals.map((sig) => (
                        <span key={sig.signalKey} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text">{sig.label}</span>
                      ))}
                    </div>
                  </div>
                )}
                {watchSignals.length > 0 && (
                  <div className="space-y-1.5">
                    <MetaText className="font-medium text-text">Areas to watch</MetaText>
                    <div className="flex flex-wrap gap-1">
                      {watchSignals.map((sig) => (
                        <span key={sig.signalKey} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-[var(--warning)]">{sig.label}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href={`/analysis/teachers/${userId}?window=${windowDays}`} className="text-[12px] text-accent hover:underline">View your signal profile →</Link>
                <Link href={`/observe/history?teacherId=${userId}&window=${windowDays}`} className="text-[12px] text-accent hover:underline">View observations →</Link>
              </div>
            </div>
          )}
        </Card>
      </section>

      {hasMeetingsFeature && openActions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">Your actions</h2>
            <Link href="/my-actions" className="text-[0.75rem] font-medium text-accent calm-transition hover:text-accentHover">View all →</Link>
          </div>
          <Card>
            <ul className="space-y-1">
              {openActions.slice(0, 5).map((action) => (
                <li key={action.id}>
                  <Link href="/my-actions" className="flex items-center justify-between gap-2 rounded-lg p-3 hover:bg-bg/60 calm-transition">
                    <span className="text-sm text-text">{action.description}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      {action.dueDate && (
                        <MetaText>Due {new Date(action.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</MetaText>
                      )}
                      <StatusPill variant="neutral">{action.status ?? "Open"}</StatusPill>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {(hasLeaveFeature || hasOnCallFeature) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {hasLeaveFeature && (
            <Card className="space-y-3">
              <h2 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">Leave of absence</h2>
              {loaRequest ? (
                <div className="flex items-center justify-between">
                  <BodyText className="text-sm">
                    {new Date(loaRequest.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {" – "}
                    {new Date(loaRequest.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </BodyText>
                  <StatusPill variant={loaStatusPill[loaRequest.status] ?? "neutral"}>
                    {loaStatusLabel[loaRequest.status] ?? loaRequest.status}
                  </StatusPill>
                </div>
              ) : (
                <MetaText>No recent requests.</MetaText>
              )}
              <div className="flex flex-wrap gap-3">
                <Link href="/leave/request" className="text-[12px] text-accent hover:underline">Request leave →</Link>
                <Link href="/leave" className="text-[12px] text-accent hover:underline">View status →</Link>
              </div>
            </Card>
          )}
          {hasOnCallFeature && (
            <Card className="space-y-3">
              <h2 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">On call</h2>
              {onCallRequests.length === 0 ? (
                <MetaText>No recent on-call requests.</MetaText>
              ) : (
                <ul className="space-y-1">
                  {onCallRequests.slice(0, 3).map((req) => (
                    <li key={req.id} className="flex items-center justify-between rounded-lg p-2">
                      <MetaText>{new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</MetaText>
                      <StatusPill variant={req.status === "OPEN" ? "neutral" : req.status === "APPROVED" ? "success" : "error"}>{req.status}</StatusPill>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3">
                <Link href="/on-call/new" className="text-[12px] text-accent hover:underline">Log on-call →</Link>
                <Link href="/on-call" className="text-[12px] text-accent hover:underline">View requests →</Link>
              </div>
            </Card>
          )}
        </section>
      )}

      {wholeSchoolTop1 && (
        <Card className="space-y-2">
          <h2 className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text">Whole-school focus</h2>
          <p className="text-sm text-text">{wholeSchoolTop1.label}</p>
          <MetaText>School-wide signal movement this window.</MetaText>
          <Link href={`/analytics?tab=cpd&window=${windowDays}`} className="text-[12px] text-accent hover:underline">See CPD priorities →</Link>
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
  const quickActionItems: { label: string; href: string; icon: string }[] = [];
  if (enabledFeatures.has("OBSERVATIONS")) {
    quickActionItems.push({ label: "New Observation", href: "/observe/new", icon: "📝" });
  }
  if (enabledFeatures.has("MEETINGS")) {
    quickActionItems.push({ label: "New Meeting", href: "/meetings/new", icon: "📅" });
  }
  if (enabledFeatures.has("ON_CALL")) {
    quickActionItems.push({ label: "On Call", href: "/on-call/new", icon: "📞" });
  }
  if (enabledFeatures.has("LEAVE")) {
    quickActionItems.push({ label: "Leave of Absence", href: "/leave/request", icon: "🏖️" });
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
      const { cpdRows, teacherRows, cohortRows, studentRows, pendingLeaveCount, openOnCallCount, pendingLeaveDetails, onCallDetails, weekObsCount, weekObsTeachers, attainmentSummary } = await hydrateLeadershipHomeData({ user, windowDays, hasLeaveFeature, hasOnCallFeature, hasAssessmentsFeature });
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
    <div className="space-y-6">
      <PageTitle windowDays={windowDays} quickActionItems={quickActionItems} />
      {content}
    </div>
  );
}
