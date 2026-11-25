import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels } from "@/modules/observations/tenantSignalLabels";
import { SignalFlowScreen } from "../../components/SignalFlowScreen";
import { ObservationStageLayout } from "../../components/ObservationStageLayout";

export default async function ObservationSignalsPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  if (!hasPermission(user.role, "observe:create")) redirect("/observe/history");

  const draftKey = `observation-draft:${user.tenantId}:${user.id}`;
  const [labelMap, schoolType] = await Promise.all([getTenantSignalLabels(user.tenantId), getTenantSchoolType(user.tenantId)]);
  const signalDefs = getSignalDefinitionsForSchoolType(schoolType);

  return (
    <ObservationStageLayout currentStep={2} subtitle="Rate what you saw. If you didn't see something, say so and move on.">
      <SignalFlowScreen draftKey={draftKey} signals={signalDefs as any[]} labelMap={labelMap as any} schoolType={schoolType} />
    </ObservationStageLayout>
  );
}
