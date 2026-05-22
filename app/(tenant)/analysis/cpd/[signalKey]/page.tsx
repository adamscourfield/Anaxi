import { Fragment, type ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { computeCpdPriorities, computeSignalAffectedTeachers } from "@/modules/analysis/cpdPriorities";
import { canViewCpdDrilldown } from "@/modules/authz";
import { findSignalDefinitionForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { SignalKeyIcon } from "@/app/(tenant)/admin/observation-signal-labels/SignalKeyIcon";

const WINDOW_OPTIONS = [7, 21, 28] as const;

const ELEVATED_SHELL =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

const KPI_ICON_WELL =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[rgba(124,92,255,0.12)] text-[#7C5CFF] [&_svg]:h-[18px] [&_svg]:w-[18px]";

const TH =
  "px-4 py-3.5 text-left text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280] sm:px-5";
const TH_NUM = `${TH} text-right`;
const ROW_BORDER = "border-b border-[rgba(15,23,42,0.06)]";

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

const ICON_INFO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-3.5 w-3.5 text-muted">
    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function DrilldownMetaBar({ items }: { items: { icon: ReactNode; label: string }[] }) {
  return (
    <div className="anx-priorities-meta-bar">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <span className="px-2 text-[#d1d5db]" aria-hidden>
              ·
            </span>
          ) : null}
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

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export default async function CpdSignalDrilldownPage({
  params,
  searchParams,
}: {
  params: Promise<{ signalKey: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const rawWindow = Number(resolvedSearchParams.window ?? "21");
  const windowDays = WINDOW_OPTIONS.includes(rawWindow as (typeof WINDOW_OPTIONS)[number])
    ? (rawWindow as (typeof WINDOW_OPTIONS)[number])
    : 21;

  const signalKey = resolvedParams.signalKey;

  const rawDept =
    typeof resolvedSearchParams.department === "string" ? resolvedSearchParams.department : undefined;

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

  return (
    <div className="w-full min-w-0 space-y-5 pb-12 pt-1">
      <div className="mx-auto max-w-[960px] space-y-5">
        <Link
          href={`/analytics?tab=cpd&${backParams.toString()}`}
          className="link-muted-accent inline-flex items-center gap-1 text-[0.8125rem] font-medium"
        >
          <span aria-hidden className="text-[0.9375rem] leading-none">
            &lt;
          </span>
          Back to CPD priorities
        </Link>

        <header className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <span
              className={`${KPI_ICON_WELL} mx-auto h-12 w-12 sm:mx-0 [&_svg]:h-7 [&_svg]:w-7`}
              aria-hidden
            >
              <SignalKeyIcon signalKey={signalKey} />
            </span>
            <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">
                CPD signal priority
              </p>
              <h1 className="text-[1.75rem] font-bold tracking-tight text-[#111827] md:text-[2rem]">
                {signalDisplayName}
              </h1>
              <p className="text-[0.9375rem] font-medium leading-relaxed text-[#374151]">
                {sigDef.descriptionDefault}
              </p>
            </div>
          </div>

          <DrilldownMetaBar
            items={[
              { icon: ICON_CALENDAR, label: `Window: last ${windowDays} days` },
              { icon: ICON_CHART, label: "Based on observations" },
              { icon: ICON_CLOCK, label: `Updated ${computedAt}` },
              { icon: ICON_INFO, label: `Coverage threshold: ${minCoverage} obs` },
            ]}
          />
        </header>

        <div className="anx-priorities-toolbar">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Time window</p>
            <p className="text-[0.8125rem] text-[#6B7280]">Choose how many recent days feed these metrics.</p>
          </div>
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
            <li>
              <strong>Drift rate</strong>: Share of covered teachers whose signal weakened beyond the drift
              threshold in this window.
            </li>
            <li>
              <strong>Teachers drifting down</strong>: Count of covered teachers with a meaningful negative change.
            </li>
            <li>
              <strong>Avg negative delta</strong>: Mean size of decline where decline is present.
            </li>
            <li>
              <strong>Teachers covered</strong>: Teachers with at least the coverage threshold of observations.
            </li>
          </ul>
        </details>

        {signalRow && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Signal summary</h2>
              <p className="text-[0.8125rem] text-[#6B7280]">
                Based on {signalRow.teachersCovered} teachers with sufficient observation coverage.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={`${ELEVATED_SHELL} p-5`}>
                <div className="flex items-start gap-3">
                  <div className={KPI_ICON_WELL} aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l4-4 4 4 6-8" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Drift rate</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#111827]">
                      {signalRow.teachersCovered === 0 ? "—" : pct(signalRow.driftRate)}
                    </p>
                  </div>
                </div>
              </div>
              <div className={`${ELEVATED_SHELL} p-5`}>
                <div className="flex items-start gap-3">
                  <div className={KPI_ICON_WELL} aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
                      Teachers drifting down
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#111827]">
                      {signalRow.teachersDriftingDown}
                    </p>
                  </div>
                </div>
              </div>
              <div className={`${ELEVATED_SHELL} p-5`}>
                <div className="flex items-start gap-3">
                  <div className={KPI_ICON_WELL} aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
                      Avg negative delta
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#111827]">
                      {signalRow.avgNegativeDelta !== null ? signalRow.avgNegativeDelta.toFixed(2) : "—"}
                    </p>
                  </div>
                </div>
              </div>
              <div className={`${ELEVATED_SHELL} p-5`}>
                <div className="flex items-start gap-3">
                  <div className={KPI_ICON_WELL} aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
                      Teachers covered
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#111827]">
                      {signalRow.teachersCovered}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {canDrilldown ? (
          <section className={ELEVATED_SHELL}>
            <div className={`px-5 py-5 sm:px-7 sm:py-6 ${ROW_BORDER}`}>
              <h2 className="text-lg font-bold tracking-tight text-[#111827]">Teachers with drift on this signal</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6B7280]">
                Sorted by most negative change first.
              </p>
            </div>
            {affectedTeachers.length === 0 ? (
              <div className="px-5 py-10 sm:px-7">
                <p className="text-[0.875rem] text-[#6B7280]">
                  No teachers with sufficient coverage for this signal in the selected window.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-[0.8125rem]">
                  <thead>
                    <tr className={`${ROW_BORDER} bg-[#F3F4F6]`}>
                      <th className={TH}>Teacher</th>
                      <th className={TH}>Department(s)</th>
                      <th className={TH_NUM}>Coverage</th>
                      <th className={TH_NUM}>Current</th>
                      <th className={TH_NUM}>Previous</th>
                      <th className={`${TH_NUM} pr-5 sm:pr-7`}>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affectedTeachers.map((row) => (
                      <tr
                        key={row.teacherMembershipId}
                        className={`group calm-transition odd:bg-[rgba(124,92,255,0.035)] hover:bg-[rgba(124,92,255,0.06)] ${ROW_BORDER} last:border-b-0`}
                      >
                        <td className="py-4 pl-5 pr-3 sm:pl-7">
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
                          className={`px-3 py-4 pr-5 text-right tabular-nums font-semibold sm:pr-7 ${
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
          <section className={`${ELEVATED_SHELL} p-6 sm:p-7`}>
            <p className="text-[0.875rem] leading-relaxed text-[#6B7280]">
              Teacher-level details are available to school leaders. You can see the whole-school signal summary
              above.
            </p>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button asChild variant="secondary">
            <Link href={`/observe/history?signalKey=${signalKey}&window=${windowDays}`}>View observations</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
