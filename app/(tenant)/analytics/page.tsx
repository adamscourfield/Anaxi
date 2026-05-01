import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/types";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableEmpty } from "@/components/ui/data-table-empty";
import { StudentPrioritiesFilters } from "./StudentPrioritiesFilters";
import { PrioritiesExportButton } from "./PrioritiesExportButton";
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

/** Match computeTeacherRiskIndex default ordering when no URL sort. */
const TEACHER_STATUS_ORDER: Record<RiskStatus, number> = {
  SIGNIFICANT_DRIFT: 0,
  EMERGING_DRIFT: 1,
  STABLE: 2,
  LOW_COVERAGE: 3,
};

function teacherInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AVATAR_TINTS = [
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-900",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-indigo-100 text-indigo-800",
];

function avatarTintClass(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length]!;
}

function PrioritiesMetaBar({
  items,
  className = "",
}: {
  items: { icon: ReactNode; label: string }[];
  className?: string;
}) {
  return (
    <div className={`anx-priorities-meta-bar ${className}`.trim()}>
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="px-2 text-[#d1d5db]" aria-hidden>·</span> : null}
          <span className="inline-flex items-center gap-1.5">
            <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

const ICON_CALENDAR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICON_CHART = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 16l4-4 4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICON_CLOCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="12 6 12 12 16 14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICON_CHEVRON_RIGHT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-muted/50">
    <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICON_INFO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5 text-muted">
    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICON_SORT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3 w-3 shrink-0 opacity-50">
    <path d="M7 15l5 5 5-5M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICON_TAB_TEACHER = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICON_TAB_CPD = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ICON_TAB_STUDENTS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4 shrink-0">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
  HIGH: "bg-[#f3f4f6] text-[#4b5563]",
  LOW: "bg-risk-priority-bg text-risk-priority-text",
};

const TAB_ICONS: Record<Tab, ReactNode> = {
  teachers: ICON_TAB_TEACHER,
  cpd: ICON_TAB_CPD,
  students: ICON_TAB_STUDENTS,
};

const TEACHER_SORT_COLUMNS = ["teacher", "score"] as const;
type TeacherSortColumn = (typeof TEACHER_SORT_COLUMNS)[number];

const STUDENT_SORT_COLUMNS = ["student", "score"] as const;
type StudentSortColumn = (typeof STUDENT_SORT_COLUMNS)[number];

function TabBar({
  activeTab,
  windowDays,
  preserveParams,
}: {
  activeTab: Tab;
  windowDays: number;
  preserveParams?: Record<string, string>;
}) {
  return (
    <div className="filter-period-toggle w-fit max-w-full bg-[#F3F4F6]">
      {TABS.map((tab) => {
        const params = new URLSearchParams();
        params.set("tab", tab);
        params.set("window", String(windowDays));
        if (preserveParams) {
          for (const [k, v] of Object.entries(preserveParams)) {
            if (v) params.set(k, v);
          }
        }
        return (
          <Link
            key={tab}
            href={`/analytics?${params.toString()}`}
            className={`filter-period-btn inline-flex items-center gap-2 ${tab === activeTab ? "filter-period-btn-active" : ""}`}
          >
            {TAB_ICONS[tab]}
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
  extraParams?: Record<string, string | undefined>;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-[0.8125rem] font-medium text-[#374151]">Window:</span>
      <div className="filter-period-toggle w-fit max-w-full bg-[#F3F4F6]">
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
              className={`filter-period-btn ${w === windowDays ? "filter-period-btn-active" : ""}`}
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
  searchParams,
}: {
  user: { id: string; tenantId: string; role: UserRole };
  windowDays: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const rawSort = typeof searchParams?.sort === "string" ? searchParams.sort : "";
  const sortCol: TeacherSortColumn = TEACHER_SORT_COLUMNS.includes(rawSort as TeacherSortColumn)
    ? (rawSort as TeacherSortColumn)
    : "score";
  const rawDir = typeof searchParams?.dir === "string" ? searchParams.dir : "desc";
  const sortDir = rawDir === "asc" ? "asc" : "desc";

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

  let rows = allRows.filter((row) =>
    canViewTeacherAnalysis(viewerContext, {
      teacherUserId: row.teacherMembershipId,
      teacherDepartmentIds: teacherDepts.get(row.teacherMembershipId) ?? [],
    })
  );

  const collator = new Intl.Collator("en", { sensitivity: "base" });
  rows = [...rows].sort((a, b) => {
    if (sortCol === "teacher") {
      const nameCmp = collator.compare(a.teacherName, b.teacherName);
      if (nameCmp !== 0) return sortDir === "asc" ? nameCmp : -nameCmp;
      const statusDiff = TEACHER_STATUS_ORDER[a.status] - TEACHER_STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.normalizedIDS - a.normalizedIDS;
    }
    const statusDiff = TEACHER_STATUS_ORDER[a.status] - TEACHER_STATUS_ORDER[b.status];
    if (statusDiff !== 0) return sortDir === "asc" ? statusDiff : -statusDiff;
    const scoreCmp = a.normalizedIDS - b.normalizedIDS;
    if (scoreCmp !== 0) return sortDir === "asc" ? scoreCmp : -scoreCmp;
    return collator.compare(a.teacherName, b.teacherName);
  });

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
  const computedAt = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function teacherListParams(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    p.set("tab", "teachers");
    p.set("window", String(windowDays));
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== "") p.set(k, v);
    }
    return p.toString();
  }

  const teacherSortHref = (col: TeacherSortColumn) => {
    const nextDir =
      sortCol === col ? (sortDir === "desc" ? "asc" : "desc") : col === "teacher" ? "asc" : "desc";
    return `/analytics?${teacherListParams({ sort: col, dir: nextDir })}`;
  };

  return (
    <div className="space-y-5">
      <PrioritiesMetaBar
        items={[
          { icon: ICON_CALENDAR, label: `Window: last ${windowDays} days` },
          { icon: ICON_CHART, label: "Based on observations" },
          { icon: ICON_CLOCK, label: `Updated ${computedAt}` },
        ]}
      />

      <details className="anx-priorities-definitions anx-priorities-definitions-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[#111827]">
          <span className="text-[#9ca3af]" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Metric definitions
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#6B7280]">
          <li><strong>Coverage</strong>: Number of observations in the selected window.</li>
          <li><strong>Drift status</strong>: Whether recent signals are stable or declining.</li>
          <li><strong>Drift score</strong>: Normalized decline score (higher means greater drift).</li>
          <li><strong>Last observed</strong>: Most recent observation date in the window.</li>
        </ul>
      </details>

      <div className="anx-priorities-table-card">
        {rows.length === 0 ? (
          <DataTableEmpty
            title="No observation data in this window"
            description="Widen the window or add observations so teacher drift and coverage can be computed."
            action={
              <Link href="/observe/new" className="link-accent text-sm font-semibold underline-offset-2">
                Start an observation
              </Link>
            }
          />
        ) : (
          <div className="anx-priorities-table-wrap">
            <table className="anx-priorities-table">
              <thead>
                <tr>
                  <th>
                    <Link href={teacherSortHref("teacher")} className="anx-priorities-sort-link">
                      Teacher
                      {ICON_SORT}
                    </Link>
                  </th>
                  <th>Department(s)</th>
                  <th>Coverage</th>
                  <th>
                    <span className="inline-flex items-center gap-1">
                      Drift status
                      <span
                        className="inline-flex"
                        title="Whether recent signals are stable or declining vs the prior window."
                      >
                        {ICON_INFO}
                      </span>
                    </span>
                  </th>
                  <th className="text-right">
                    <Link href={teacherSortHref("score")} className="anx-priorities-sort-link justify-end">
                      Drift score
                      {ICON_SORT}
                    </Link>
                  </th>
                  <th>Last observed</th>
                  <th className="w-10" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.teacherMembershipId}>
                    <td>
                      <Link
                        href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                        className="flex min-w-0 items-center gap-3"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTintClass(row.teacherMembershipId)}`}
                        >
                          {teacherInitials(row.teacherName)}
                        </span>
                        <span className="min-w-0 truncate font-semibold text-[#111827] underline decoration-[color-mix(in_srgb,#111827_35%,transparent)] underline-offset-2 hover:decoration-[#111827]">
                          {row.teacherName}
                        </span>
                      </Link>
                    </td>
                    <td className="text-[#6B7280]">
                      {row.departmentNames.length > 0 ? row.departmentNames.join(", ") : "—"}
                    </td>
                    <td className="text-[#6B7280]">
                      {row.teacherCoverage} observation{row.teacherCoverage !== 1 ? "s" : ""}
                    </td>
                    <td>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[row.status]}`}>
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-[#6B7280]">
                      {row.status === "LOW_COVERAGE" ? "—" : row.normalizedIDS.toFixed(1)}
                    </td>
                    <td className="text-[#6B7280]">
                      {row.lastObservationAt
                        ? new Date(row.lastObservationAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="text-right" aria-hidden>
                      <Link
                        href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                        className="inline-flex text-[#9ca3af] calm-transition hover:text-[#6b7280]"
                        tabIndex={-1}
                      >
                        {ICON_CHEVRON_RIGHT}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[0.8125rem] text-[#6B7280]">
        Min. coverage threshold: {settings?.minObservationCount ?? 6} observations · Drift threshold:{" "}
        {settings?.driftDeltaThreshold ?? 0.35}
      </p>
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
  const computedAt = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const topImproving = getTopImprovingSignals(rows);

  return (
    <div className="space-y-5">
      <PrioritiesMetaBar
        items={[
          { icon: ICON_CALENDAR, label: `Window: last ${windowDays} days` },
          { icon: ICON_CHART, label: "Based on observations" },
          { icon: ICON_CLOCK, label: `Updated ${computedAt}` },
          { icon: ICON_INFO, label: `Coverage threshold: ${minCoverage} obs` },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        {departmentOptions.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-[0.8125rem] font-medium text-[#374151]">Department:</span>
            <div className="filter-period-toggle w-fit max-w-full bg-[#F3F4F6]">
              {!isHod && (
                <Link
                  href={`/analytics?tab=cpd&window=${windowDays}`}
                  className={`filter-period-btn ${!departmentId ? "filter-period-btn-active" : ""}`}
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
                    className={`filter-period-btn ${departmentId === dept.id ? "filter-period-btn-active" : ""}`}
                  >
                    {dept.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <details className="anx-priorities-definitions anx-priorities-definitions-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[#111827]">
          <span className="text-[#9ca3af]" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Metric definitions
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#6B7280]">
          <li><strong>Drift rate</strong>: Percentage of covered teachers showing weakening for a signal.</li>
          <li><strong>Avg negative delta</strong>: Mean size of decline where decline is present.</li>
          <li><strong>Teachers covered</strong>: Number of teachers with sufficient observations in window.</li>
          <li><strong>Improving rate</strong>: Percentage of covered teachers improving on that signal.</li>
        </ul>
      </details>

      <div className="anx-priorities-table-card">
        <div className="anx-priorities-table-card__header">
          <h2>Areas for focus</h2>
          <p className="anx-priorities-table-card__meta">
            Signals showing the most widespread weakening in the selected window.
          </p>
        </div>
        {rows.length === 0 ? (
          <DataTableEmpty
            title="No CPD drift data in this window"
            description="Signals need enough observations across staff. Try a longer window or record more observations."
            action={
              <Link href="/observe/new" className="link-accent text-sm font-semibold underline-offset-2">
                Start an observation
              </Link>
            }
          />
        ) : (
          <div className="anx-priorities-table-wrap">
            <table className="anx-priorities-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th className="text-right">Drift rate (%)</th>
                  <th className="text-right">Avg negative delta</th>
                  <th className="text-right">Teachers covered</th>
                  <th className="text-right">Improving rate (%)</th>
                  <th className="w-10" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const params = new URLSearchParams();
                  params.set("window", String(windowDays));
                  if (departmentId) params.set("department", departmentId);
                  return (
                    <tr key={row.signalKey}>
                      <td>
                        <Link
                          href={`/analysis/cpd/${row.signalKey}?${params.toString()}`}
                          className="font-medium text-[#111827] underline decoration-[color-mix(in_srgb,#111827_35%,transparent)] underline-offset-2 hover:decoration-[#111827]"
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums text-[#6B7280]">
                        {row.teachersCovered === 0
                          ? "—"
                          : `${Math.round(row.driftRate * 100)}%`}
                      </td>
                      <td className="text-right tabular-nums text-[#6B7280]">
                        {row.avgNegativeDelta !== null
                          ? row.avgNegativeDelta.toFixed(2)
                          : "—"}
                      </td>
                      <td className="text-right tabular-nums text-[#6B7280]">
                        {row.teachersCovered}
                      </td>
                      <td className="text-right tabular-nums text-[#6B7280]">
                        {row.teachersCovered === 0
                          ? "—"
                          : `${Math.round(row.improvingRate * 100)}%`}
                      </td>
                      <td className="text-right" aria-hidden>
                        <Link
                          href={`/analysis/cpd/${row.signalKey}?${params.toString()}`}
                          className="inline-flex text-[#9ca3af] calm-transition hover:text-[#6b7280]"
                          tabIndex={-1}
                        >
                          {ICON_CHEVRON_RIGHT}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <p className="text-[0.8125rem] text-[#6B7280]">
          Based on teachers with at least {minCoverage} observations in the selected window.
        </p>
      )}

      {topImproving.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-0.5">
            <h2 className="text-lg font-bold text-[#111827]">Positive momentum</h2>
            <p className="text-[0.8125rem] text-[#6B7280]">
              Signals showing the strongest improvement in the last {windowDays} days.
            </p>
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
                  className="block rounded-xl border border-[color-mix(in_srgb,#e5e7eb_90%,transparent)] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] calm-transition hover:border-[#d1d5db]"
                >
                  <p className="text-sm font-semibold text-[#111827] underline decoration-[color-mix(in_srgb,#111827_35%,transparent)] underline-offset-2">
                    {row.label}
                  </p>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[0.8125rem] text-[#6B7280]">
                      {Math.round(row.improvingRate * 100)}% of teachers improving
                    </p>
                    {row.avgPositiveDelta !== null && (
                      <p className="text-[0.8125rem] text-[#6B7280]">
                        Avg delta: +{row.avgPositiveDelta.toFixed(2)}
                      </p>
                    )}
                    <p className="text-[0.8125rem] text-[#6B7280]">{row.teachersCovered} teachers covered</p>
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

  const rawStudentSort = typeof searchParams?.sort === "string" ? searchParams.sort : "";
  const sortCol: StudentSortColumn = STUDENT_SORT_COLUMNS.includes(rawStudentSort as StudentSortColumn)
    ? (rawStudentSort as StudentSortColumn)
    : "score";
  const rawStudentDir = typeof searchParams?.dir === "string" ? searchParams.dir : "desc";
  const sortDir = rawStudentDir === "asc" ? "asc" : "desc";

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

  const collator = new Intl.Collator("en", { sensitivity: "base" });
  rows = [...rows].sort((a, b) => {
    if (sortCol === "student") {
      const nameCmp = collator.compare(a.studentName, b.studentName);
      if (nameCmp !== 0) return sortDir === "asc" ? nameCmp : -nameCmp;
      const bandDiff = BAND_ORDER[a.band] - BAND_ORDER[b.band];
      if (bandDiff !== 0) return bandDiff;
      return b.riskScore - a.riskScore;
    }
    const bandDiff = BAND_ORDER[a.band] - BAND_ORDER[b.band];
    if (bandDiff !== 0) return sortDir === "asc" ? bandDiff : -bandDiff;
    const scoreCmp = a.riskScore - b.riskScore;
    if (scoreCmp !== 0) return sortDir === "asc" ? scoreCmp : -scoreCmp;
    return collator.compare(a.studentName, b.studentName);
  });

  const yearGroups = Array.from(new Set(allRows.map((r) => r.yearGroup).filter(Boolean))).sort() as string[];

  const hasStudentFilters =
    !!filterYearGroup ||
    !!filterSend ||
    !!filterPp ||
    !!filterBand ||
    !!filterConfidence ||
    filterWatchlist;

  const computedAtStr = computedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function studentListParams(overrides: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    p.set("tab", "students");
    p.set("window", String(windowDays));
    if (filterYearGroup) p.set("yearGroup", filterYearGroup);
    if (filterSend) p.set("send", filterSend);
    if (filterPp) p.set("pp", filterPp);
    if (filterBand) p.set("band", filterBand);
    if (filterConfidence) p.set("confidence", filterConfidence);
    if (filterWatchlist) p.set("watchlist", "1");
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== "") p.set(k, v);
    }
    return p.toString();
  }

  const studentSortHref = (col: StudentSortColumn) => {
    const nextDir =
      sortCol === col ? (sortDir === "desc" ? "asc" : "desc") : col === "student" ? "asc" : "desc";
    return `/analytics?${studentListParams({ sort: col, dir: nextDir })}`;
  };

  return (
    <div className="space-y-5">
      <PrioritiesMetaBar
        items={[
          { icon: ICON_CALENDAR, label: `Window: last ${windowDays} days` },
          { icon: ICON_CHART, label: "Based on latest snapshots" },
          { icon: ICON_CLOCK, label: `Updated ${computedAtStr}` },
        ]}
      />

      <StudentPrioritiesFilters
        yearGroups={yearGroups}
        windowDays={windowDays}
        tableSort={{ sort: sortCol, dir: sortDir }}
        defaults={{
          yearGroup: filterYearGroup,
          send: filterSend,
          pp: filterPp,
          band: filterBand,
          confidence: filterConfidence,
          watchlist: filterWatchlist,
        }}
        hasFilters={hasStudentFilters}
      />

      <details className="anx-priorities-definitions anx-priorities-definitions-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-[#111827]">
          <span className="text-[#9ca3af]" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Metric definitions
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#6B7280]">
          <li><strong>Band</strong>: Overall risk priority based on recent trend signals.</li>
          <li><strong>Score</strong>: Composite risk score used to sort support priorities.</li>
          <li><strong>Detentions / On calls</strong>: Change from baseline window (positive means increase).</li>
          <li><strong>Confidence</strong>: Data confidence based on recency and coverage quality.</li>
        </ul>
      </details>

      <div className="anx-priorities-table-card">
        {rows.length === 0 ? (
          <DataTableEmpty
            title={hasStudentFilters ? "No students match these filters" : "No student snapshot data"}
            description={
              hasStudentFilters
                ? "Relax filters or reset the table to see students in this window."
                : "Behaviour snapshots may still be importing. Check back after the next sync or widen the window."
            }
            action={
              hasStudentFilters ? (
                <Link
                  href={`/analytics?tab=students&window=${windowDays}`}
                  className="link-accent text-sm font-semibold underline-offset-2"
                >
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="anx-priorities-table-wrap">
            <table className="anx-priorities-table min-w-[960px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#fafafa] shadow-[inset_-1px_0_0_#f3f4f6]">
                    <Link href={studentSortHref("student")} className="anx-priorities-sort-link">
                      Student
                      {ICON_SORT}
                    </Link>
                  </th>
                  <th>Year</th>
                  <th>Band</th>
                  <th className="text-right">
                    <Link href={studentSortHref("score")} className="anx-priorities-sort-link justify-end">
                      Score
                      {ICON_SORT}
                    </Link>
                  </th>
                  <th>
                    <span className="inline-flex items-center gap-1">
                      Key drivers
                      <span className="inline-flex" title="Top contributing metrics from the latest snapshot window.">
                        {ICON_INFO}
                      </span>
                    </span>
                  </th>
                  <th className="text-right">Attendance (%)</th>
                  <th className="text-right">Detentions Δ</th>
                  <th className="text-right">On calls Δ</th>
                  <th>Flags</th>
                  <th>Confidence</th>
                  <th className="w-10" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.studentId}>
                    <td className="sticky left-0 z-10 bg-white shadow-[inset_-1px_0_0_#f3f4f6]">
                      <Link
                        href={`/analysis/students/${row.studentId}?window=${windowDays}`}
                        className="group flex min-w-0 items-center gap-3"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTintClass(row.studentId)}`}
                        >
                          {teacherInitials(row.studentName)}
                        </span>
                        <span className="min-w-0 truncate font-semibold text-[#111827] underline decoration-[color-mix(in_srgb,#111827_35%,transparent)] underline-offset-2 group-hover:decoration-[#111827]">
                          {row.onWatchlist ? "★ " : ""}
                          {row.studentName}
                        </span>
                      </Link>
                    </td>
                    <td className="text-[#6B7280]">{row.yearGroup ?? "—"}</td>
                    <td>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BAND_PILL[row.band]}`}>
                        {BAND_LABELS[row.band]}
                      </span>
                    </td>
                    <td className="text-right tabular-nums text-[#6B7280]">{row.riskScore}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {row.drivers.map((d) => (
                          <span key={d.metric} className="anx-priorities-driver-pill">
                            {d.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right tabular-nums text-[#6B7280]">
                      {row.attendancePct !== null ? `${row.attendancePct.toFixed(1)}%` : "—"}
                      {row.attendanceDelta !== null && (
                        <span
                          className={`ml-1 text-xs font-medium ${
                            row.attendanceDelta < 0 ? "text-[#dc2626]" : "text-[#059669]"
                          }`}
                        >
                          ({row.attendanceDelta > 0 ? "+" : ""}
                          {row.attendanceDelta.toFixed(1)})
                        </span>
                      )}
                    </td>
                    <td className="text-right tabular-nums text-[#6B7280]">
                      {row.detentionsDelta !== null
                        ? row.detentionsDelta > 0
                          ? `+${row.detentionsDelta}`
                          : String(row.detentionsDelta)
                        : "—"}
                    </td>
                    <td className="text-right tabular-nums text-[#6B7280]">
                      {row.onCallsDelta !== null
                        ? row.onCallsDelta > 0
                          ? `+${row.onCallsDelta}`
                          : String(row.onCallsDelta)
                        : "—"}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {row.sendFlag && (
                          <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-xs font-medium text-[#6b21a8]">
                            SEND
                          </span>
                        )}
                        {row.ppFlag && (
                          <span className="rounded-full bg-[#f3e8ff] px-2 py-0.5 text-xs font-medium text-[#6b21a8]">
                            PP
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONFIDENCE_PILL[row.confidence]}`}
                      >
                        {row.confidence === "HIGH" ? "High" : "Low"}
                      </span>
                    </td>
                    <td className="text-right" aria-hidden>
                      <Link
                        href={`/analysis/students/${row.studentId}?window=${windowDays}`}
                        className="inline-flex text-[#9ca3af] calm-transition hover:text-[#6b7280]"
                        tabIndex={-1}
                      >
                        {ICON_CHEVRON_RIGHT}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[0.8125rem] text-[#6B7280]">
        {rows.length} student{rows.length !== 1 ? "s" : ""} shown · Window: last {windowDays} days
      </p>
    </div>
  );
}

async function resolveCpdDepartmentForAnalytics(
  user: { id: string; tenantId: string; role: string },
  searchParams: Record<string, string | string[] | undefined>
): Promise<string | undefined> {
  const rawDept = typeof searchParams?.department === "string" ? searchParams.department : undefined;

  const hodMemberships = await (prisma as any).departmentMembership.findMany({
    where: { userId: user.id, isHeadOfDepartment: true },
    include: { department: true },
  });
  const hodDepartments: { id: string; name: string }[] = (hodMemberships as any[]).map((m: any) => ({
    id: m.departmentId,
    name: m.department.name,
  }));

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

  if (departmentOptions.length === 0) return undefined;
  return departmentId;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);
  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);

  const rawTab = typeof searchParams?.tab === "string" ? searchParams.tab : "teachers";
  const activeTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "teachers";

  const rawWindow = Number(searchParams?.window ?? "21");
  const windowDays = WINDOW_OPTIONS.includes(rawWindow as (typeof WINDOW_OPTIONS)[number])
    ? (rawWindow as (typeof WINDOW_OPTIONS)[number])
    : 21;

  const sp = searchParams ?? {};
  const rawTeacherSort = typeof sp.sort === "string" ? sp.sort : "";
  const rawTeacherDir = typeof sp.dir === "string" ? sp.dir : "";
  const teacherSortPreserve: Record<string, string> = {};
  if (activeTab === "teachers" && TEACHER_SORT_COLUMNS.includes(rawTeacherSort as TeacherSortColumn)) {
    teacherSortPreserve.sort = rawTeacherSort;
    if (rawTeacherDir === "asc" || rawTeacherDir === "desc") teacherSortPreserve.dir = rawTeacherDir;
  }

  const rawStudentSort = typeof sp.sort === "string" ? sp.sort : "";
  const rawStudentDir = typeof sp.dir === "string" ? sp.dir : "";
  const studentSortPreserve: Record<string, string> = {};
  if (activeTab === "students" && STUDENT_SORT_COLUMNS.includes(rawStudentSort as StudentSortColumn)) {
    studentSortPreserve.sort = rawStudentSort;
    if (rawStudentDir === "asc" || rawStudentDir === "desc") studentSortPreserve.dir = rawStudentDir;
  }

  const tabPreserveParams =
    activeTab === "teachers"
      ? teacherSortPreserve
      : activeTab === "students"
        ? studentSortPreserve
        : {};

  const cpdExportDepartmentId =
    activeTab === "cpd" ? await resolveCpdDepartmentForAnalytics(user, sp) : undefined;

  const windowExtraParams: Record<string, string | undefined> =
    activeTab === "cpd" && typeof sp.department === "string"
      ? { department: sp.department }
      : activeTab === "teachers"
        ? { sort: teacherSortPreserve.sort, dir: teacherSortPreserve.dir }
        : activeTab === "students"
          ? {
              sort: studentSortPreserve.sort,
              dir: studentSortPreserve.dir,
              yearGroup: typeof sp.yearGroup === "string" ? sp.yearGroup : undefined,
              send: typeof sp.send === "string" ? sp.send : undefined,
              pp: typeof sp.pp === "string" ? sp.pp : undefined,
              band: typeof sp.band === "string" ? sp.band : undefined,
              confidence: typeof sp.confidence === "string" ? sp.confidence : undefined,
              watchlist: sp.watchlist === "1" ? "1" : undefined,
            }
          : {};

  return (
    <div className="anx-priorities-page anx-reports-page">
      <div className="anx-priorities-inner space-y-8">
        <PageHeader
          variant="ledger"
          className="!mb-0 border-0 !pb-0"
          eyebrowClassName="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[#6B7280]"
          eyebrow="Analysis"
          titleClassName="text-[1.75rem] font-bold tracking-tight text-[#111827] md:text-[2rem]"
          subtitleClassName="max-w-3xl text-[0.9375rem] font-medium leading-relaxed text-[#374151]"
          title="Priorities"
          subtitle="Teacher coverage, CPD drift, and student pastoral bands — driven by the tab and time window below."
          meta={<p className="text-[0.8125rem] text-[#6B7280]">Same URL controls apply across all three tabs.</p>}
          actions={
            <PrioritiesExportButton
              userId={user.id}
              userRole={user.role}
              hodDepartmentIds={hodDepartmentIds}
              coacheeUserIds={coacheeUserIds}
              activeTab={activeTab}
              windowDays={windowDays}
              departmentId={cpdExportDepartmentId}
            />
          }
        />

        <div className="anx-priorities-toolbar">
          <TabBar activeTab={activeTab} windowDays={windowDays} preserveParams={tabPreserveParams} />
          <WindowSelector windowDays={windowDays} activeTab={activeTab} extraParams={windowExtraParams} />
        </div>

        {activeTab === "teachers" && (
          <TeachersTab user={user} windowDays={windowDays} searchParams={sp} />
        )}
        {activeTab === "cpd" && <CpdTab user={user} windowDays={windowDays} searchParams={sp} />}
        {activeTab === "students" && <StudentsTab user={user} windowDays={windowDays} searchParams={sp} />}
      </div>
    </div>
  );
}
