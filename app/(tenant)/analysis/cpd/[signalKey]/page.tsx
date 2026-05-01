import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { computeCpdPriorities, computeSignalAffectedTeachers } from "@/modules/analysis/cpdPriorities";
import { canViewCpdDrilldown } from "@/modules/authz";
import { findSignalDefinitionForSchoolType } from "@/modules/observations/getSignalsBySchoolType";

const WINDOW_OPTIONS = [7, 21, 28] as const;

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export default async function CpdSignalDrilldownPage({
  params,
  searchParams,
}: {
  params: { signalKey: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const rawWindow = Number(searchParams?.window ?? "21");
  const windowDays = WINDOW_OPTIONS.includes(rawWindow as (typeof WINDOW_OPTIONS)[number])
    ? (rawWindow as (typeof WINDOW_OPTIONS)[number])
    : 21;

  const signalKey = params.signalKey;

  const rawDept =
    typeof searchParams?.department === "string" ? searchParams.department : undefined;

  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);
  const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

  const canDrilldown = canViewCpdDrilldown(viewerContext);

  let departmentId: string | undefined = rawDept;
  if (user.role === "HOD" && departmentId) {
    if (!hodDepartmentIds.includes(departmentId)) {
      departmentId = hodDepartmentIds[0];
    }
  }
  if (user.role === "HOD" && !departmentId && hodDepartmentIds.length > 0) {
    departmentId = hodDepartmentIds[0];
  }

  const filters = departmentId ? { departmentId } : undefined;

  const [settings, allSignalRows, signalLabel] = await Promise.all([
    (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } }),
    computeCpdPriorities(user.tenantId, windowDays, filters),
    (prisma as any).tenantSignalLabel.findFirst({ where: { tenantId: user.tenantId, signalKey } }),
  ]);

  const schoolType = (settings?.schoolType ?? "SECONDARY") as "PRIMARY" | "SECONDARY";
  const sigDef = findSignalDefinitionForSchoolType(signalKey, schoolType);
  if (!sigDef) notFound();

  const minCoverage: number = settings?.minObservationCount ?? 6;
  const signalDisplayName = signalLabel?.displayName ?? sigDef.displayNameDefault;

  const signalRow = allSignalRows.find((r) => r.signalKey === signalKey);

  const affectedTeachers = canDrilldown
    ? await computeSignalAffectedTeachers(user.tenantId, signalKey, windowDays, filters)
    : [];

  const computedAt = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const backParams = new URLSearchParams();
  backParams.set("window", String(windowDays));
  if (departmentId) backParams.set("department", departmentId);

  const windowHref = (w: number) => {
    const p = new URLSearchParams();
    p.set("window", String(w));
    if (departmentId) p.set("department", departmentId);
    return `/analysis/cpd/${signalKey}?${p.toString()}`;
  };

  const summaryTileClass =
    "flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#6B7280] [&_svg]:size-[1.125rem]";

  return (
    <div className="-mx-4 -mt-4 min-h-[calc(100vh-4rem)] bg-[#F9FAFB] px-4 pb-12 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-[960px] space-y-8">
        <Link
          href={`/analytics?tab=cpd&${backParams.toString()}`}
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
        >
          <span aria-hidden className="text-[0.9375rem] leading-none">
            &lt;
          </span>
          Back to CPD priorities
        </Link>

        <header className="space-y-3">
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[#111827] md:text-[2rem]">
            {signalDisplayName}
          </h1>
          <p className="max-w-3xl text-[0.9375rem] font-medium leading-relaxed text-[#374151]">
            {sigDef.descriptionDefault}
          </p>
          <p className="text-[0.8125rem] text-[#6B7280]">
            Window: last {windowDays} days · Updated {computedAt} · Coverage threshold: {minCoverage}{" "}
            obs
          </p>
        </header>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-[0.8125rem] font-medium text-[#374151]">Window:</span>
          <div className="filter-period-toggle w-fit max-w-full bg-[#F3F4F6]">
            {WINDOW_OPTIONS.map((w) => (
              <Link
                key={w}
                href={windowHref(w)}
                className={`filter-period-btn ${w === windowDays ? "filter-period-btn-active" : ""}`}
              >
                {w} days
              </Link>
            ))}
          </div>
        </div>

        {signalRow && (
          <section className="rounded-xl border border-[color-mix(in_srgb,#E5E7EB_90%,transparent)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-8">
            <div className="mb-6 border-b border-[#F3F4F6] pb-5">
              <h2 className="text-lg font-bold text-[#111827]">Summary</h2>
              <p className="mt-1 text-[0.8125rem] text-[#6B7280]">
                Based on {signalRow.teachersCovered} teachers with sufficient observation coverage.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
              <div className="flex gap-3 lg:border-r lg:border-[#F3F4F6] lg:pr-6">
                <div className={summaryTileClass} aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l4-4 4 4 6-8" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                    Drift rate
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#111827]">
                    {signalRow.teachersCovered === 0 ? "—" : pct(signalRow.driftRate)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 lg:border-r lg:border-[#F3F4F6] lg:px-6">
                <div className={summaryTileClass} aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                    Teachers drifting down
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#111827]">
                    {signalRow.teachersDriftingDown}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 lg:border-r lg:border-[#F3F4F6] lg:px-6">
                <div className={summaryTileClass} aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                    Avg negative delta
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#111827]">
                    {signalRow.avgNegativeDelta !== null ? signalRow.avgNegativeDelta.toFixed(2) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 lg:pl-6">
                <div className={summaryTileClass} aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                    Teachers covered
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#111827]">
                    {signalRow.teachersCovered}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {canDrilldown ? (
          <section className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,#E5E7EB_90%,transparent)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="border-b border-[#F3F4F6] px-5 py-5 md:px-6">
              <h2 className="text-lg font-bold text-[#111827]">Teachers with drift on this signal</h2>
              <p className="mt-1 text-[0.8125rem] text-[#6B7280]">Sorted by most negative change first.</p>
            </div>
            {affectedTeachers.length === 0 ? (
              <div className="px-5 py-10 md:px-6">
                <p className="text-[0.875rem] text-[#6B7280]">
                  No teachers with sufficient coverage for this signal in the selected window.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-[0.8125rem]">
                  <thead>
                    <tr className="border-b border-[#F3F4F6] bg-[#FAFAFA] text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">
                      <th className="py-3.5 pl-5 pr-3">Teacher</th>
                      <th className="px-3 py-3.5">Department(s)</th>
                      <th className="px-3 py-3.5 text-right">Coverage</th>
                      <th className="px-3 py-3.5 text-right">Current</th>
                      <th className="px-3 py-3.5 text-right">Previous</th>
                      <th className="px-3 py-3.5 pr-5 text-right">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {affectedTeachers.map((row) => (
                      <tr key={row.teacherMembershipId} className="bg-white calm-transition hover:bg-[#FAFAFA]">
                        <td className="py-4 pl-5 pr-3">
                          <Link
                            href={`/analysis/teachers/${row.teacherMembershipId}?window=${windowDays}`}
                            className="font-medium text-[#111827] underline decoration-[color-mix(in_srgb,#111827_35%,transparent)] underline-offset-2 hover:decoration-[#111827]"
                          >
                            {row.teacherName}
                          </Link>
                        </td>
                        <td className="px-3 py-4 text-[#6B7280]">
                          {row.deptNames.length > 0 ? row.deptNames.join(", ") : "—"}
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums text-[#6B7280]">
                          {row.teacherCoverage}
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums text-[#6B7280]">
                          {row.currentMean !== null ? row.currentMean.toFixed(2) : "—"}
                        </td>
                        <td className="px-3 py-4 text-right tabular-nums text-[#6B7280]">
                          {row.prevMean !== null ? row.prevMean.toFixed(2) : "—"}
                        </td>
                        <td
                          className={`px-3 py-4 pr-5 text-right tabular-nums font-semibold ${
                            row.delta === null
                              ? "text-[#6B7280]"
                              : row.delta < 0
                                ? "text-[#B45309]"
                                : row.delta > 0
                                  ? "text-[#047857]"
                                  : "text-[#6B7280]"
                          }`}
                        >
                          {row.delta !== null
                            ? `${row.delta > 0 ? "+" : ""}${row.delta.toFixed(2)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-xl border border-[color-mix(in_srgb,#E5E7EB_90%,transparent)] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-[0.875rem] leading-relaxed text-[#6B7280]">
              Teacher-level details are available to school leaders. You can see the whole-school signal
              summary above.
            </p>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button asChild variant="secondary">
            <Link href={`/observe/history?signalKey=${signalKey}&window=${windowDays}`}>
              View observations
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
