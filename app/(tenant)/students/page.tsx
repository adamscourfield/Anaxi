import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { canViewExplorer, canViewBehaviourExplorer } from "@/modules/authz";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { FeatureKey } from "@/lib/types";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");

  const params = await searchParams;

  const [hodMemberships, coachAssignments, tenantFeatures] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({
      where: { coachUserId: user.id },
    }),
    prisma.tenantFeature.findMany({
      where: {
        tenantId: user.tenantId,
        key: { in: ["ANALYSIS", "ASSESSMENTS", "STUDENTS_IMPORT"] },
      },
      select: { key: true, enabled: true },
    }),
  ]);

  const featureOn = (key: FeatureKey) =>
    tenantFeatures.some((f) => f.key === key && f.enabled);

  const viewerContext = {
    userId: user.id,
    role: user.role,
    hodDepartmentIds: (hodMemberships as { departmentId: string }[]).map((m) => m.departmentId),
    coacheeUserIds: (coachAssignments as { coacheeUserId: string }[]).map((a) => a.coacheeUserId),
  };

  const canOpenExplorerStudentDirectory =
    featureOn("ANALYSIS") &&
    canViewExplorer(viewerContext) &&
    canViewBehaviourExplorer(viewerContext);

  if (canOpenExplorerStudentDirectory) {
    const q = Array.isArray(params.q) ? params.q[0] : params.q;
    const yearGroup = Array.isArray(params.yearGroup) ? params.yearGroup[0] : params.yearGroup;
    const band = Array.isArray(params.band) ? params.band[0] : params.band;
    const page = Array.isArray(params.page) ? params.page[0] : params.page;

    const mapped = new URLSearchParams();
    if (q) mapped.set("studentSearch", q);
    if (yearGroup) mapped.set("yearGroup", yearGroup);
    if (band) mapped.set("band", band);
    if (page) mapped.set("page", page);

    const qs = mapped.toString();
    redirect(`/explorer/students${qs ? `?${qs}` : ""}`);
  }

  return (
    <EmptyState
      title="Student directory"
      description="The school-wide student risk overview lives in Explorer and is available to senior pastoral roles when the Analysis module is enabled. You can still open students from Assessments or use import tools where your school has turned them on."
      action={
        <div className="flex flex-wrap justify-center gap-3">
          {featureOn("ASSESSMENTS") ? (
            <Button asChild variant="primary">
              <Link href="/assessments">Go to assessments</Link>
            </Button>
          ) : null}
          {featureOn("STUDENTS_IMPORT") ? (
            <Button asChild variant="secondary">
              <Link href="/students/import">Student import</Link>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href="/home">Back to home</Link>
          </Button>
        </div>
      }
    />
  );
}
