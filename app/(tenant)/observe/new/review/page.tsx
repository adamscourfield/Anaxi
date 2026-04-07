import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature, requireRole } from "@/lib/guards";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalDefinitionsForSchoolType } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels } from "@/modules/observations/tenantSignalLabels";
import { submitObservationDraft } from "../../actions";
import { ReviewList } from "../../components/ReviewList";

export default async function ObservationReviewPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  requireRole(user, ["LEADER", "SLT", "ADMIN"]);

  const draftKey = `observation-draft:${user.tenantId}:${user.id}`;
  const labelMap = await getTenantSignalLabels(user.tenantId);
  const schoolType = await getTenantSchoolType(user.tenantId);
  const signalDefs = getSignalDefinitionsForSchoolType(schoolType);

  return (
    <ReviewList
      draftKey={draftKey}
      signals={signalDefs as any[]}
      labelMap={labelMap as any}
      action={submitObservationDraft}
      schoolType={schoolType}
    />
  );
}
