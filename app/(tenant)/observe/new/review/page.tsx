import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels } from "@/modules/observations/tenantSignalLabels";
import { submitObservationDraft } from "../../actions";
import { ReviewList } from "../../components/ReviewList";
import { ObservationStageLayout } from "../../components/ObservationStageLayout";

export default async function ObservationReviewPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  if (!hasPermission(user.role, "observe:create")) redirect("/observe/history");

  const draftKey = `observation-draft:${user.tenantId}:${user.id}`;
  const [labelMap, schoolType, teachers, observationCounts] = await Promise.all([
    getTenantSignalLabels(user.tenantId),
    getTenantSchoolType(user.tenantId),
    // Any active member of staff can be observed, including leaders.
    (prisma as any).user.findMany({
      where: { tenantId: user.tenantId, isActive: true, id: { not: user.id } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    (prisma as any).observation.groupBy({
      by: ["observedTeacherId"],
      where: { tenantId: user.tenantId },
      _count: { _all: true },
    }),
  ]);
  const signalDefs = getSignalDefinitionsForSchoolType(schoolType);

  const priorCountByTeacherId: Record<string, number> = {};
  for (const row of observationCounts as { observedTeacherId: string; _count: { _all: number } }[]) {
    priorCountByTeacherId[row.observedTeacherId] = row._count._all;
  }

  return (
    <ObservationStageLayout currentStep={3} wide subtitle="Check the ratings, add a note if you want, then save.">
      <ReviewList
        draftKey={draftKey}
        signals={signalDefs as any[]}
        labelMap={labelMap as any}
        action={submitObservationDraft}
        schoolType={schoolType}
        teachers={teachers as { id: string; fullName: string }[]}
        priorCountByTeacherId={priorCountByTeacherId}
      />
    </ObservationStageLayout>
  );
}
