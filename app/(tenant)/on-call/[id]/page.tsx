import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasOnCallPermission } from "@/lib/rbac";
import { getRequestDetail } from "@/modules/oncall/service";
import { OnCallDetail } from "@/components/oncall/OnCallDetail";
import { notFound } from "next/navigation";

export default async function OnCallDetailPage({ params }: { params: { id: string } }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ON_CALL");

  let request: Awaited<ReturnType<typeof getRequestDetail>>;
  try {
    request = await getRequestDetail(user.tenantId, params.id);
  } catch {
    notFound();
  }

  const canAcknowledge = hasOnCallPermission(user.role, "oncall:acknowledge");
  const canResolve = hasOnCallPermission(user.role, "oncall:resolve");
  const canCancel =
    hasOnCallPermission(user.role, "oncall:cancel") && request.requesterUserId === user.id;

  const timelineEvents =
    (request as { timelineEvents?: unknown[] }).timelineEvents?.map((e: any) => ({
      id: e.id as string,
      type: e.type as "CREATED" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED",
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
      actor: e.actor ? { id: e.actor.id as string, fullName: e.actor.fullName as string } : null,
    })) ?? [];

  return (
    <OnCallDetail
      request={{
        ...request,
        timelineEvents,
      }}
      canAcknowledge={canAcknowledge}
      canResolve={canResolve}
      canCancel={canCancel}
    />
  );
}
