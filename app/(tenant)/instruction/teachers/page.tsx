import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { canViewTeacherAnalysis } from "@/modules/authz";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { computeTeacherPivot, type RiskStatus } from "@/modules/analysis/teacherRisk";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type PillVariant } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { TeachersFilterToolbar } from "@/components/teachers/TeachersFilterToolbar";

const VALID_WINDOWS = [7, 21, 28, 90] as const;
type WindowDays = (typeof VALID_WINDOWS)[number];

const STATUS_LABELS: Record<RiskStatus, string> = {
  SIGNIFICANT_DRIFT: "Significant",
  EMERGING_DRIFT: "Emerging",
  STABLE: "Consistent",
  LOW_COVERAGE: "Low coverage",
};

const STATUS_VARIANT: Record<RiskStatus, PillVariant> = {
  SIGNIFICANT_DRIFT: "error",
  EMERGING_DRIFT: "neutral",
  STABLE: "success",
  LOW_COVERAGE: "neutral",
};

function formatDrift(value: number): { text: string; arrow: string; color: string } {
  const abs = Math.abs(value);
  const formatted = abs.toFixed(1);
  if (value > 0.5) return { text: `+${formatted}`, arrow: "↗", color: "text-scale-strong-text" };
  if (value < -0.5) return { text: `-${formatted}`, arrow: "↘", color: "text-scale-limited-text" };
  const sign = value < 0 ? "-" : "+";
  return { text: `${sign}${formatted}`, arrow: "→", color: "text-muted" };
}

function zeroPad(n: number): string {
  return String(n).padStart(2, "0");
}

async function resolvePivotTeacherFilter(args: {
  tenantId: string;
  role: string;
  userId: string;
  hodDepartmentIds: string[];
  coacheeUserIds: string[];
}): Promise<string[] | undefined> {
  const { tenantId, role, userId, hodDepartmentIds, coacheeUserIds } = args;

  if (role === "TEACHER") return [userId];

  if (role === "LEADER") {
    return coacheeUserIds.length > 0 ? coacheeUserIds : [];
  }

  if (role === "HOD") {
    if (hodDepartmentIds.length === 0) return [];
    const memberRows = await (prisma as any).departmentMembership.findMany({
      where: { tenantId, departmentId: { in: hodDepartmentIds } },
      select: { userId: true },
    });
    return [...new Set((memberRows as { userId: string }[]).map((m) => m.userId))];
  }

  return undefined;
}

export default async function InstructionTeachersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  if (!hasPermission(user.role, "analysis:view")) notFound();

  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);

  const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
  const schoolType = settings?.schoolType ?? "SECONDARY";
  const signalDefs = getSignalDefinitionsForSchoolType(schoolType);
  const signalLabelMap: Record<string, string> = Object.fromEntries(
    signalDefs.map((s) => [s.key, s.displayNameDefault]),
  );
  const heatmapKeys = signalDefs.map((s) => s.key).slice(0, 7);

  const rawWindow = Number(
    typeof searchParams?.windowDays === "string" ? searchParams.windowDays : "21",
  );
  const windowDays: WindowDays = VALID_WINDOWS.includes(rawWindow as WindowDays)
    ? (rawWindow as WindowDays)
    : 21;

  const departmentId =
    typeof searchParams?.departmentId === "string" ? searchParams.departmentId : undefined;

  const departments: { id: string; name: string }[] = await (prisma as any).department.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const isHod = user.role === "HOD";
  const scopedDepartments = isHod
    ? departments.filter((d) => hodDepartmentIds.includes(d.id))
    : departments;

  const teacherFilter = await resolvePivotTeacherFilter({
    tenantId: user.tenantId,
    role: user.role,
    userId: user.id,
    hodDepartmentIds,
    coacheeUserIds,
  });

  const deptMemberships = await (prisma as any).departmentMembership.findMany({
    where: { tenantId: user.tenantId },
    select: { userId: true, departmentId: true },
  });
  const teacherDeptIds = new Map<string, string[]>();
  for (const m of deptMemberships as { userId: string; departmentId: string }[]) {
    if (!teacherDeptIds.has(m.userId)) teacherDeptIds.set(m.userId, []);
    teacherDeptIds.get(m.userId)!.push(m.departmentId);
  }

  const pivotFilter =
    teacherFilter === undefined
      ? undefined
      : teacherFilter.length > 0
        ? teacherFilter
        : ([] as string[]);

  const { rows: pivotRows } = await computeTeacherPivot(user.tenantId, windowDays, pivotFilter);

  let pivotRowsForTable = pivotRows;
  if (departmentId) {
    const dept = departments.find((d) => d.id === departmentId);
    if (dept) {
      pivotRowsForTable = pivotRowsForTable.filter((r) => r.departmentNames.includes(dept.name));
    }
  }

  const visibleRows = pivotRowsForTable.filter((r) =>
    canViewTeacherAnalysis(viewerContext, {
      teacherUserId: r.teacherMembershipId,
      teacherDepartmentIds: teacherDeptIds.get(r.teacherMembershipId) ?? [],
    }),
  );

  visibleRows.sort((a, b) => {
    const statusOrder: Record<RiskStatus, number> = {
      SIGNIFICANT_DRIFT: 0,
      EMERGING_DRIFT: 1,
      STABLE: 2,
      LOW_COVERAGE: 3,
    };
    const sd = statusOrder[a.status] - statusOrder[b.status];
    if (sd !== 0) return sd;
    return b.normalizedIDS - a.normalizedIDS;
  });

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        variant="ledger"
        eyebrow="Instruction"
        title="Teachers"
        subtitle="Observation coverage, signal strength, and drift — open a teacher for observations, signal detail, and classes."
      />

      <TeachersFilterToolbar
        variant="instruction"
        windowDays={windowDays}
        departmentId={departmentId}
        scopedDepartments={scopedDepartments}
      />
      <p className="text-[0.8125rem] text-muted">
        Same data as Explorer teachers, with a full profile for each teacher including observations and timetable classes.
      </p>

      {visibleRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <p className="text-[0.875rem] font-semibold text-text">No teachers in scope</p>
          <p className="mt-1 max-w-md text-center text-[0.8125rem] text-muted">
            {user.role === "LEADER"
              ? "You do not have coaching assignments, or no observations exist for your coachees in this window."
              : "Try a longer window, or check department assignments if you are a head of department."}
          </p>
        </div>
      ) : (
        <div className="table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="table-head-row">
                  <th className="px-5 py-4">Teacher</th>
                  <th className="px-4 py-4">Department</th>
                  <th className="px-4 py-4 text-center">Coverage</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4 text-center">Drift score</th>
                  <th className="min-w-[11rem] px-4 py-4">
                    <span className="inline-flex flex-col gap-0.5">
                      <span>Signal heatmap</span>
                      <span className="text-[0.625rem] font-normal normal-case tracking-normal text-muted">
                        Higher mean = stronger (1–4)
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const drift = formatDrift(row.normalizedIDS);
                  return (
                    <tr key={row.teacherMembershipId} className="group table-row calm-transition">
                      <td className="whitespace-nowrap px-5 py-5">
                        <Link
                          href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}&ref=instruction`}
                          className="flex items-center gap-3.5 calm-transition group-hover:text-accent"
                        >
                          <Avatar name={row.teacherName} size="md" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--text)]">{row.teacherName}</p>
                            <p className="truncate text-xs text-muted">Teacher</p>
                          </div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-5 text-muted">
                        {row.departmentNames.join(", ") || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-5 text-center font-semibold tabular-nums text-[var(--text)]">
                        {zeroPad(row.teacherCoverage)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-5">
                        <StatusPill variant={STATUS_VARIANT[row.status]} size="sm">
                          {STATUS_LABELS[row.status]}
                        </StatusPill>
                      </td>
                      <td className="whitespace-nowrap px-4 py-5 text-center">
                        <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${drift.color}`}>
                          {drift.text}
                          <span className="text-xs" aria-hidden>
                            {drift.arrow}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex max-w-[14rem] items-center gap-1.5">
                          {heatmapKeys.map((key) => {
                            const cell = row.signalData[key];
                            const mean = cell?.currentMean;
                            const barClass = meanToHeatmapBarClass(mean);
                            const label = signalLabelMap[key] ?? key;
                            return (
                              <div
                                key={key}
                                className={`h-5 min-w-0 flex-1 rounded-md ${barClass}`}
                                title={signalHeatmapCellTitle(label, mean)}
                              />
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
