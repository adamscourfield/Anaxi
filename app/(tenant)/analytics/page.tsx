import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { H1, H2, MetaText, BodyText } from "@/components/ui/typography";
import { computeTeacherRiskIndex, RiskStatus } from "@/modules/analysis/teacherRisk";
import { canViewTeacherAnalysis, canViewStudentAnalysis } from "@/modules/authz";
import {
  computeCpdPriorities,
  getTopImprovingSignals,
} from "@/modules/analysis/cpdPriorities";
import { computeStudentRiskIndex, RiskBand, Confidence, BAND_ORDER } from "@/modules/analysis/studentRisk";

const TABS = ["teachers", "cpd", "students"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  teachers: "Teacher priorities",
  cpd: "CPD priorities",
  students: "Student priorities",
};

const WINDOW_OPTIONS = [7, 21, 28] as const;

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

function TabBar({
  activeTab,
  windowDays,
}: {
  activeTab: Tab;
  windowDays: number;
}) {
  return (
    <div className="segmented-toggle">
      {TABS.map((tab) => {
        const params = new URLSearchParams();
        params.set("tab", tab);
        params.set("window", String(windowDays));
        return (
          <Link
            key={tab}
            href={`/analytics?${params.toString()}`}
            className={`segmented-toggle-btn ${tab === activeTab ? "segmented-toggle-btn-active" : ""}`}
          >
            {TAB_LABELS[tab]}
          </Link>
        );
      })}
    </div>
  );
}

function WindowSelector({
  windowDays,
  activeTab,
  extraParams,
}: {
  windowDays: number;
  activeTab: Tab;
  extraParams?: Record<string, string>;
}) {
  return (
    <div className="flex items-center gap-2">
      <MetaText className="mr-1">Window:</MetaText>
      <div className="segmented-toggle">
        {WINDOW_OPTIONS.map((w) => {
          const params = new URLSearchParams();
          params.set("tab", activeTab);
          params.set("window", String(w));
          if (extraParams) {
            for (const [k, v] of Object.entries(extraParams)) {
              if (v) params.set(k, v);
            }
          }
          return (
            <Link
              key={w}
              href={`/analytics?${params.toString()}`}
              className={`segmented-toggle-btn ${w === windowDays ? "segmented-toggle-btn-active" : ""}`}
            >
              {w} days
            </Link>
          );
        })}
      </div>
    </div>
  );
}

async function TeachersTab({
  user,
  windowDays,
}: {
  user: { id: string; tenantId: string; role: UserRole };
  windowDays: number;
}) {
  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);
  const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

  const allRows = await computeTeacherRiskIndex(user.tenantId, windowDays);

  const deptMemberships = await (prisma as any).departmentMembership.findMany({
    where: { tenantId: user.tenantId },
  });
  const teacherDepts = new Map<string, string[]>();
  for (const m of deptMemberships as any[]) {
    if (!teacherDepts.has(m.userId)) teacherDepts.set(m.userId, []);
    teacherDepts.get(m.userId)!.push(m.departmentId);
  }

  const rows = allRows.filter((row) =>
    canViewTeacherAnalysis(viewerContext, {
      teacherUserId: row.teacherMembershipId,
      teacherDepartmentIds: teacherDepts.get(row.teacherMembershipId) ?? [],
    })
  );

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
  const computedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <MetaText>
        Window: Last {windowDays} days · Based on observations · Updated {computedAt}
      </MetaText>

      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-text">Metric definitions</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li><strong>Coverage</strong>: Number of observations in the selected window.</li>
          <li><strong>Drift status</strong>: Whether recent signals are stable or declining.</li>
          <li><strong>Drift score</strong>: Normalized decline score (higher means greater drift).</li>
          <li><strong>Last observed</strong>: Most recent observation date in the window.</li>
        </ul>
      </details>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-6">
            <BodyText className="text-muted">
              No observation data available for the selected window.
            </BodyText>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-left text-xs font-medium text-muted">
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Department(s)</th>
                  <th className="px-4 py-3">Coverage</th>
                  <th className="px-4 py-3">Drift status</th>
                  <th className="px-4 py-3">Drift score</th>
                  <th className="px-4 py-3">Last observed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.teacherMembershipId}
                    className="border-b border-divider last:border-0 hover:bg-bg"
                  >
                    <td className="px-4 py-3 font-medium text-text">
                      <Link
                        href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                        className="hover:underline"
                      >
                        {row.teacherName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {row.departmentNames.length > 0 ? row.departmentNames.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {row.teacherCoverage} observation{row.teacherCoverage !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[row.status]}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {row.status === "LOW_COVERAGE" ? "—" : row.normalizedIDS.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {row.lastObservationAt
                        ? new Date(row.lastObservationAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <MetaText>
        Min. coverage threshold: {settings?.minObservationCount ?? 6} observations · Drift threshold: {settings?.driftDeltaThreshold ?? 0.35}
      </MetaText>
    </div>
  );
}

async function CpdTab({
  user,
  windowDays,
  searchParams,
}: {
  user: { id: string; tenantId: string; role: string };
  windowDays: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const rawDept = typeof searchParams?.department === "string" ? searchParams.department : undefined;

  const hodMemberships = await (prisma as any).departmentMembership.findMany({
    where: { userId: user.id, isHeadOfDepartment: true },
    include: { department: true },
  });
  const hodDepartments: { id: string; name: string }[] = (hodMemberships as any[]).map(
    (m: any) => ({ id: m.departmentId, name: m.department.name })
  );

  const allDepartments = await (prisma as any).department.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
  });

  const isHod = user.role === "HOD";
  const departmentOptions: { id: string; name: string }[] = isHod
    ? hodDepartments
    : (allDepartments as any[]).map((d: any) => ({ id: d.id, name: d.name }));

  let departmentId: string | undefined = rawDept;
  if (isHod && !departmentId && hodDepartments.length > 0) {
    departmentId = hodDepartments[0].id;
  }
  if (isHod && departmentId) {
    const allowed = hodDepartments.map((d) => d.id);
    if (!allowed.includes(departmentId)) {
      departmentId = hodDepartments[0]?.id;
    }
  }

  const filters = departmentId ? { departmentId } : undefined;

  const [rows, settings] = await Promise.all([
    computeCpdPriorities(user.tenantId, windowDays, filters),
    (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } }),
  ]);

  const minCoverage: number = settings?.minObservationCount ?? 6;
  const computedAt = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const topImproving = getTopImprovingSignals(rows);

  return (
    <div className="space-y-6">
      <MetaText>
        Most commonly weakening signals · Window: last {windowDays} days · Updated{" "}
        {computedAt} · Coverage threshold: {minCoverage} obs
      </MetaText>

      <div className="flex flex-wrap items-center gap-4">
        {departmentOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <MetaText className="mr-1">Department:</MetaText>
            <div className="segmented-toggle">
              {!isHod && (
                <Link
                  href={`/analytics?tab=cpd&window=${windowDays}`}
                  className={`segmented-toggle-btn ${!departmentId ? "segmented-toggle-btn-active" : ""}`}
                >
                  All
                </Link>
              )}
              {departmentOptions.map((dept) => {
                const params = new URLSearchParams();
                params.set("tab", "cpd");
                params.set("window", String(windowDays));
                params.set("department", dept.id);
                return (
                  <Link
                    key={dept.id}
                    href={`/analytics?${params.toString()}`}
                    className={`segmented-toggle-btn ${departmentId === dept.id ? "segmented-toggle-btn-active" : ""}`}
                  >
                    {dept.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-text">Metric definitions</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li><strong>Drift rate</strong>: Percentage of covered teachers showing weakening for a signal.</li>
          <li><strong>Avg negative delta</strong>: Mean size of decline where decline is present.</li>
          <li><strong>Teachers covered</strong>: Number of teachers with sufficient observations in window.</li>
          <li><strong>Improving rate</strong>: Percentage of covered teachers improving on that signal.</li>
        </ul>
      </details>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <H2>Areas for focus</H2>
          <MetaText>Signals showing the most widespread weakening in the selected window.</MetaText>
        </div>
        {rows.length === 0 ? (
          <div className="p-6">
            <BodyText className="text-muted">
              No observation data available for the selected window.
            </BodyText>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-left text-xs font-medium text-muted">
                  <th className="px-4 py-3">Signal</th>
                  <th className="px-4 py-3 text-right">Drift rate (%)</th>
                  <th className="px-4 py-3 text-right">Avg negative delta</th>
                  <th className="px-4 py-3 text-right">Teachers covered</th>
                  <th className="px-4 py-3 text-right">Improving rate (%)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const params = new URLSearchParams();
                  params.set("window", String(windowDays));
                  if (departmentId) params.set("department", departmentId);
                  return (
                    <tr
                      key={row.signalKey}
                      className="border-b border-divider last:border-0 hover:bg-bg"
                    >
                      <td className="px-4 py-3 font-medium text-text">
                        <Link
                          href={`/analysis/cpd/${row.signalKey}?${params.toString()}`}
                          className="hover:underline"
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {row.teachersCovered === 0
                          ? "—"
                          : `${Math.round(row.driftRate * 100)}%`}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {row.avgNegativeDelta !== null
                          ? row.avgNegativeDelta.toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {row.teachersCovered}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {row.teachersCovered === 0
                          ? "—"
                          : `${Math.round(row.improvingRate * 100)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <MetaText>
          Based on teachers with at least {minCoverage} observations in the selected window.
        </MetaText>
      )}

      {topImproving.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-0.5">
            <H2>Positive momentum</H2>
            <MetaText>
              Signals showing the strongest improvement in the last {windowDays} days.
            </MetaText>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {topImproving.map((row) => {
              const params = new URLSearchParams();
              params.set("window", String(windowDays));
              if (departmentId) params.set("department", departmentId);
              return (
                <Link
                  key={row.signalKey}
                  href={`/analysis/cpd/${row.signalKey}?${params.toString()}`}
                  className="block rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-accentHover calm-transition transition duration-200 ease-calm"
                >
                  <p className="text-sm font-medium text-text">{row.label}</p>
                  <div className="mt-2 space-y-0.5">
                    <MetaText>
                      {Math.round(row.improvingRate * 100)}% of teachers improving
                    </MetaText>
                    {row.avgPositiveDelta !== null && (
                      <MetaText>
                        Avg delta: +{row.avgPositiveDelta.toFixed(2)}
                      </MetaText>
                    )}
                    <MetaText>{row.teachersCovered} teachers covered</MetaText>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

async function StudentsTab({
  user,
  windowDays,
  searchParams,
}: {
  user: { id: string; tenantId: string; role: UserRole };
  windowDays: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const canView = canViewStudentAnalysis({
    userId: user.id,
    role: user.role,
    hodDepartmentIds: [],
    coacheeUserIds: [],
  });
  if (!canView) notFound();

  const filterYearGroup = typeof searchParams?.yearGroup === "string" ? searchParams.yearGroup : "";
  const filterSend = typeof searchParams?.send === "string" ? searchParams.send : "";
  const filterPp = typeof searchParams?.pp === "string" ? searchParams.pp : "";
  const filterBand = typeof searchParams?.band === "string" ? searchParams.band : "";
  const filterConfidence = typeof searchParams?.confidence === "string" ? searchParams.confidence : "";
  const filterWatchlist = searchParams?.watchlist === "1";

  const { rows: allRows, computedAt } = await computeStudentRiskIndex(
    user.tenantId,
    windowDays,
    user.id
  );

  let rows = allRows;
  if (filterYearGroup) rows = rows.filter((r) => r.yearGroup === filterYearGroup);
  if (filterSend === "yes") rows = rows.filter((r) => r.sendFlag);
  if (filterSend === "no") rows = rows.filter((r) => !r.sendFlag);
  if (filterPp === "yes") rows = rows.filter((r) => r.ppFlag);
  if (filterPp === "no") rows = rows.filter((r) => !r.ppFlag);
  if (filterBand) rows = rows.filter((r) => r.band === filterBand);
  if (filterConfidence) rows = rows.filter((r) => r.confidence === filterConfidence);
  if (filterWatchlist) rows = rows.filter((r) => r.onWatchlist);

  const yearGroups = Array.from(new Set(allRows.map((r) => r.yearGroup).filter(Boolean))).sort() as string[];

  const computedAtStr = computedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <MetaText>
        Window: last {windowDays} days · Updated {computedAtStr} · Based on latest snapshots
      </MetaText>

      <form method="GET" action="/analytics" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="students" />
        <input type="hidden" name="window" value={windowDays} />

        <div className="flex flex-col gap-1">
          <MetaText>Year group</MetaText>
          <select
            name="yearGroup"
            defaultValue={filterYearGroup}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          >
            <option value="">All years</option>
            {yearGroups.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <MetaText>SEND</MetaText>
          <select
            name="send"
            defaultValue={filterSend}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          >
            <option value="">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <MetaText>PP</MetaText>
          <select
            name="pp"
            defaultValue={filterPp}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          >
            <option value="">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <MetaText>Band</MetaText>
          <select
            name="band"
            defaultValue={filterBand}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          >
            <option value="">All bands</option>
            {(Object.keys(BAND_ORDER) as RiskBand[]).map((b) => (
              <option key={b} value={b}>
                {BAND_LABELS[b]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <MetaText>Confidence</MetaText>
          <select
            name="confidence"
            defaultValue={filterConfidence}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          >
            <option value="">Any</option>
            <option value="HIGH">High</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <MetaText>Watchlist</MetaText>
          <select
            name="watchlist"
            defaultValue={filterWatchlist ? "1" : ""}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
          >
            <option value="">All students</option>
            <option value="1">Watchlist only</option>
          </select>
        </div>

        <button
          type="submit"
          className="calm-transition rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition duration-200 ease-calm hover:border-accentHover"
        >
          Apply
        </button>
      </form>

      <details className="rounded-lg border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-text">Metric definitions</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li><strong>Band</strong>: Overall risk priority based on recent trend signals.</li>
          <li><strong>Score</strong>: Composite risk score used to sort support priorities.</li>
          <li><strong>Detentions / On calls</strong>: Change from baseline window (positive means increase).</li>
          <li><strong>Confidence</strong>: Data confidence based on recency and coverage quality.</li>
        </ul>
      </details>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="p-6">
            <BodyText className="text-muted">
              No students found with snapshot data in the selected window.
            </BodyText>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-left text-xs font-medium text-muted">
                  <th className="sticky left-0 z-20 bg-bg px-4 py-3">Student</th>
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3">Key drivers</th>
                  <th className="px-4 py-3 text-right">Attendance (%)</th>
                  <th className="px-4 py-3 text-right">Detentions Δ</th>
                  <th className="px-4 py-3 text-right">On calls Δ</th>
                  <th className="px-4 py-3">Flags</th>
                  <th className="px-4 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.studentId}
                    className="border-b border-divider last:border-0 hover:bg-bg"
                  >
                    <td className="sticky left-0 z-10 bg-surface px-4 py-3 font-medium text-text">
                      <Link
                        href={`/analysis/students/${row.studentId}?window=${windowDays}`}
                        className="hover:underline"
                      >
                        {row.onWatchlist ? "★ " : ""}{row.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.yearGroup ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${BAND_PILL[row.band]}`}
                      >
                        {BAND_LABELS[row.band]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{row.riskScore}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.drivers.map((d) => (
                          <span
                            key={d.metric}
                            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-scale-some-text"
                          >
                            {d.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.attendancePct !== null ? `${row.attendancePct.toFixed(1)}%` : "—"}
                      {row.attendanceDelta !== null && (
                        <span
                          className={`ml-1 text-xs ${
                            row.attendanceDelta < 0 ? "text-red-600" : "text-scale-strong-text"
                          }`}
                        >
                          ({row.attendanceDelta > 0 ? "+" : ""}
                          {row.attendanceDelta.toFixed(1)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.detentionsDelta !== null
                        ? row.detentionsDelta > 0
                          ? `+${row.detentionsDelta}`
                          : String(row.detentionsDelta)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.onCallsDelta !== null
                        ? row.onCallsDelta > 0
                          ? `+${row.onCallsDelta}`
                          : String(row.onCallsDelta)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {row.sendFlag && (
                          <span className="rounded-full bg-cat-violet-bg px-2 py-0.5 text-xs text-cat-violet-text">
                            SEND
                          </span>
                        )}
                        {row.ppFlag && (
                          <span className="rounded-full bg-scale-consistent-light px-2 py-0.5 text-xs text-blue-700">
                            PP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONFIDENCE_PILL[row.confidence]}`}
                      >
                        {row.confidence === "HIGH" ? "High" : "Low"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <MetaText>
        {rows.length} student{rows.length !== 1 ? "s" : ""} shown · Window: last {windowDays} days
      </MetaText>
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const rawTab = typeof searchParams?.tab === "string" ? searchParams.tab : "teachers";
  const activeTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "teachers";

  const rawWindow = Number(searchParams?.window ?? "21");
  const windowDays = WINDOW_OPTIONS.includes(rawWindow as (typeof WINDOW_OPTIONS)[number])
    ? (rawWindow as (typeof WINDOW_OPTIONS)[number])
    : 21;

  return (
    <div className="space-y-6">
      <H1>Priorities</H1>

      <div className="flex flex-wrap items-center gap-4">
        <TabBar activeTab={activeTab} windowDays={windowDays} />
        <WindowSelector
          windowDays={windowDays}
          activeTab={activeTab}
          extraParams={
            activeTab === "cpd" && typeof searchParams?.department === "string"
              ? { department: searchParams.department }
              : undefined
          }
        />
      </div>

      {activeTab === "teachers" && (
        <TeachersTab user={user} windowDays={windowDays} />
      )}
      {activeTab === "cpd" && (
        <CpdTab user={user} windowDays={windowDays} searchParams={searchParams ?? {}} />
      )}
      {activeTab === "students" && (
        <StudentsTab user={user} windowDays={windowDays} searchParams={searchParams ?? {}} />
      )}
    </div>
  );
}
