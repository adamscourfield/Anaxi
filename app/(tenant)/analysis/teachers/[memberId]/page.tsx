import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { H1, H2, MetaText, BodyText } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { computeTeacherSignalProfile, RiskStatus } from "@/modules/analysis/teacherRisk";
import { canViewTeacherAnalysis } from "@/modules/authz";

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

export default async function TeacherProfilePage({
  params,
  searchParams,
}: {
  params: { memberId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ANALYSIS");

  const rawWindow = Number(searchParams?.window ?? "21");
  const windowDays = WINDOW_OPTIONS.includes(rawWindow as (typeof WINDOW_OPTIONS)[number])
    ? (rawWindow as (typeof WINDOW_OPTIONS)[number])
    : 21;

  const teacherId = params.memberId;

  // Build viewer context for RBAC
  const [hodMemberships, coachAssignments, teacherDeptMemberships] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
    (prisma as any).departmentMembership.findMany({ where: { userId: teacherId } }),
  ]);

  const hodDepartmentIds = (hodMemberships as any[]).map((m: any) => m.departmentId);
  const coacheeUserIds = (coachAssignments as any[]).map((a: any) => a.coacheeUserId);
  const teacherDepartmentIds = (teacherDeptMemberships as any[]).map((m: any) => m.departmentId);

  const viewerContext = { userId: user.id, role: user.role, hodDepartmentIds, coacheeUserIds };

  const canView = canViewTeacherAnalysis(viewerContext, { teacherUserId: teacherId, teacherDepartmentIds });
  if (!canView) notFound();

  const profile = await computeTeacherSignalProfile(user.tenantId, teacherId, windowDays);
  if (!profile) notFound();

  const computedAt = profile.computedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Load department names for display
  const deptMemberships = await (prisma as any).departmentMembership.findMany({
    where: { userId: teacherId },
    include: { department: true },
  });
  const departmentNames = (deptMemberships as any[]).map((m: any) => m.department.name);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/analytics?tab=teachers&window=${windowDays}`}
        className="text-sm text-muted hover:underline"
      >
        ← Back to teacher priorities
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <H1>{profile.teacherName}</H1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_PILL[profile.status]}`}>
            {STATUS_LABELS[profile.status]}
          </span>
        </div>
        {departmentNames.length > 0 && (
          <BodyText className="text-muted">{departmentNames.join(", ")}</BodyText>
        )}
        <MetaText>
          Coverage: {profile.teacherCoverage} observation{profile.teacherCoverage !== 1 ? "s" : ""} in
          last {windowDays} days
          {profile.lastObservationAt
            ? ` · Last observed ${new Date(profile.lastObservationAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
            : ""}
          {" · "}Updated {computedAt}
        </MetaText>
      </div>

      {/* Window selector */}
      <div className="flex items-center gap-2">
        <MetaText className="mr-1">Window:</MetaText>
        <div className="segmented-toggle">
          {WINDOW_OPTIONS.map((w) => (
            <Link
              key={w}
              href={`/analysis/teachers/${teacherId}?window=${w}`}
              className={`segmented-toggle-btn ${w === windowDays ? "segmented-toggle-btn-active" : ""}`}
            >
              {w} days
            </Link>
          ))}
        </div>
      </div>

      {/* Signal table */}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <H2>Signal profile</H2>
          <MetaText>
            {profile.status === "LOW_COVERAGE"
              ? "Insufficient observations for drift analysis."
              : `Drift score: ${profile.normalizedIDS.toFixed(1)} · Sorted by worst change first`}
          </MetaText>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg text-left text-xs font-medium text-muted">
              <th className="px-4 py-3">Signal</th>
              <th className="px-4 py-3 text-right">Current</th>
              <th className="px-4 py-3 text-right">Previous</th>
              <th className="px-4 py-3 text-right">Δ</th>
              <th className="px-4 py-3 text-right">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {profile.signals.map((sig) => {
              const isDriver = sig.driftContribution > 0;
              return (
                <tr
                  key={sig.signalKey}
                  className={`border-b border-divider last:border-0 ${
                    isDriver ? "border-l-2 border-l-amber-400 bg-scale-some-bg/40" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-text">{sig.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {sig.currentMean !== null ? sig.currentMean.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {sig.prevMean !== null ? sig.prevMean.toFixed(2) : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${
                      sig.delta === null
                        ? "text-muted"
                        : sig.delta < 0
                        ? "text-scale-some-text"
                        : sig.delta > 0
                        ? "text-scale-strong-text"
                        : "text-muted"
                    }`}
                  >
                    {sig.delta !== null
                      ? `${sig.delta > 0 ? "+" : ""}${sig.delta.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">{sig.coverageCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Footer */}
      <div className="flex items-center gap-3">
        <Link
          href={`/observe/history?teacherId=${teacherId}&window=${windowDays}`}
          passHref
        >
          <Button variant="secondary">View observations</Button>
        </Link>
      </div>
    </div>
  );
}
