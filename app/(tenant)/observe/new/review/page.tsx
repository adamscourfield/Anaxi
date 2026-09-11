import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels } from "@/modules/observations/tenantSignalLabels";
import { submitObservationDraft } from "../../actions";
import { ReviewList } from "../../components/ReviewList";

export default async function ObservationReviewPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  if (!hasPermission(user.role, "observe:create")) throw new Error("FORBIDDEN");

  const draftKey = `observation-draft:${user.tenantId}:${user.id}`;
  const labelMap = await getTenantSignalLabels(user.tenantId);
  const schoolType = await getTenantSchoolType(user.tenantId);
  const signalDefs = getSignalDefinitionsForSchoolType(schoolType);

  // Any active member of staff can be observed -- including SLT and other
  // leaders -- so this is intentionally not filtered to role: "TEACHER".
  const teachers = await (prisma as any).user.findMany({
    where: { tenantId: user.tenantId, isActive: true, id: { not: user.id } },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, role: true },
  });

  const observationCounts = await (prisma as any).observation.groupBy({
    by: ["observedTeacherId"],
    where: { tenantId: user.tenantId },
    _count: { _all: true },
  });
  const priorCountByTeacherId: Record<string, number> = {};
  for (const row of observationCounts as { observedTeacherId: string; _count: { _all: number } }[]) {
    priorCountByTeacherId[row.observedTeacherId] = row._count._all;
  }

  return (
    <ReviewList
      draftKey={draftKey}
      signals={signalDefs as any[]}
      labelMap={labelMap as any}
      action={submitObservationDraft}
      schoolType={schoolType}
      teachers={teachers as { id: string; fullName: string; role: string }[]}
      priorCountByTeacherId={priorCountByTeacherId}
      observerFullName={user.fullName}
    />
  );
}
