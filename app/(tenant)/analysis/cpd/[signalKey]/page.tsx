import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { H1, H2, MetaText, BodyText } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { computeCpdPriorities, computeSignalAffectedTeachers } from "@/modules/analysis/cpdPriorities";
import { canViewCpdDrilldown } from "@/modules/authz";
import { SIGNAL_DEFINITIONS } from "@/modules/observations/signalDefinitions";

const WINDOW_OPTIONS = [7, 21, 28] as const;

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
  const sigDef = SIGNAL_DEFINITIONS.find((s) => s.key === signalKey);
  if (!sigDef) notFound();

  const rawDept =
    typeof searchParams?.department === "string" ? searchParams.department : undefined;

  // Build viewer context for RBAC
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

  // Resolve department filter
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

  const minCoverage: number = settings?.minObservationCount ?? 6;
  const signalDisplayName = signalLabel?.displayName ?? sigDef.displayNameDefault;

  // Find the row for this signal
  const signalRow = allSignalRows.find((r) => r.signalKey === signalKey);

  // Load affected teachers (only for leaders)
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

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/analytics?tab=cpd&${backParams.toString()}`}
        className="text-sm text-muted hover:underline"
      >
        ← Back to CPD priorities
      </Link>

      {/* Header */}
      <div className="space-y-1">
        <H1>{signalDisplayName}</H1>
        <BodyText className="text-muted">{sigDef.descriptionDefault}</BodyText>
        <MetaText>
          Window: last {windowDays} days · Updated {computedAt} · Coverage threshold:{" "}
          {minCoverage} obs
        </MetaText>
      </div>

      {/* Window selector */}
      <div className="flex items-center gap-2">
        <MetaText className="mr-1">Window:</MetaText>
        <div className="segmented-toggle">
          {WINDOW_OPTIONS.map((w) => {
            const p = new URLSearchParams();
            p.set("window", String(w));
            if (departmentId) p.set("department", departmentId);
            return (
              <Link
                key={w}
                href={`/analysis/cpd/${signalKey}?${p.toString()}`}
                className={`segmented-toggle-btn ${w === windowDays ? "segmented-toggle-btn-active" : ""}`}
              >
                {w} days
              </Link>
            );
          })}
        </div>
      </div>

      {/* Summary metrics card */}
      {signalRow && (
        <Card>
          <H2>Summary</H2>
          <MetaText className="mb-3">
            Based on {signalRow.teachersCovered} teachers with sufficient observation coverage.
          </MetaText>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-[12px] text-muted">Drift rate</p>
              <p className="text-lg font-semibold text-text tabular-nums">
                {signalRow.teachersCovered === 0
                  ? "—"
                  : `${Math.round(signalRow.driftRate * 100)}%`}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-muted">Teachers drifting down</p>
              <p className="text-lg font-semibold text-text tabular-nums">
                {signalRow.teachersDriftingDown}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-muted">Avg negative delta</p>
              <p className="text-lg font-semibold text-text tabular-nums">
                {signalRow.avgNegativeDelta !== null
                  ? signalRow.avgNegativeDelta.toFixed(2)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-muted">Teachers covered</p>
              <p className="text-lg font-semibold text-text tabular-nums">
                {signalRow.teachersCovered}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Teacher drilldown list (leaders only) */}
      {canDrilldown ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <H2>Teachers with drift on this signal</H2>
            <MetaText>Sorted by most negative change first.</MetaText>
          </div>
          {affectedTeachers.length === 0 ? (
            <div className="p-6">
              <BodyText className="text-muted">
                No teachers with sufficient coverage for this signal in the selected window.
              </BodyText>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-left text-xs font-medium text-muted">
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Department(s)</th>
                  <th className="px-4 py-3 text-right">Coverage</th>
                  <th className="px-4 py-3 text-right">Current</th>
                  <th className="px-4 py-3 text-right">Previous</th>
                  <th className="px-4 py-3 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {affectedTeachers.map((row) => (
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
                      {row.deptNames.length > 0 ? row.deptNames.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.teacherCoverage}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.currentMean !== null ? row.currentMean.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {row.prevMean !== null ? row.prevMean.toFixed(2) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        row.delta === null
                          ? "text-muted"
                          : row.delta < 0
                          ? "text-scale-some-text"
                          : row.delta > 0
                          ? "text-scale-strong-text"
                          : "text-muted"
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
          )}
        </Card>
      ) : (
        <Card>
          <BodyText className="text-muted">
            Teacher-level details are available to school leaders. You can see the
            whole-school signal summary above.
          </BodyText>
        </Card>
      )}

      {/* CTAs */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/observe/history?signalKey=${signalKey}&window=${windowDays}`} passHref>
          <Button variant="secondary">View observations</Button>
        </Link>
      </div>
    </div>
  );
}
