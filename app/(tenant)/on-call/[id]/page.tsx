import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { getRequestDetail } from "@/modules/oncall/service";
import { OnCallDetail } from "@/components/oncall/OnCallDetail";
import { notFound } from "next/navigation";

export default async function OnCallDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const user = await getSessionUserOrThrow();
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const backHref =
    resolvedSearchParams.from && resolvedSearchParams.from.startsWith("/")
      ? resolvedSearchParams.from
      : "/on-call";

  if (process.env.NODE_ENV === "development" && resolvedParams.id === "design-preview") {
    return <OnCallDetail backHref={backHref} canViewResolveTime request={{
      id: "design-preview", status: "ACKNOWLEDGED", requestType: "BEHAVIOUR",
      student: { fullName: "Example student", upn: "Preview", yearGroup: "10" },
      location: "Room 12", behaviourReasonCategory: "Classroom support",
      notes: "Please support the student with a calm return to learning.",
      requester: { fullName: "Example teacher" }, responder: { id: "preview", fullName: "Support team" },
      createdAt: "2026-10-11T09:00:00Z", acknowledgedAt: "2026-10-11T09:02:00Z",
    }} />;
  }

  let request: Awaited<ReturnType<typeof getRequestDetail>>;
  try {
    request = await getRequestDetail(user.tenantId, resolvedParams.id);
  } catch {
    notFound();
  }

  const canAcknowledge = hasOnCallPermission(user.role, "oncall:acknowledge");
  const canResolve = hasOnCallPermission(user.role, "oncall:resolve");
  const canCancel =
    hasOnCallPermission(user.role, "oncall:cancel") && request.requesterUserId === user.id;
  const canDelete = hasOnCallPermission(user.role, "oncall:delete");
  const canViewResolveTime = hasOnCallPermission(user.role, "oncall:view_resolve_time");

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
      canDelete={canDelete}
      canViewResolveTime={canViewResolveTime}
      backHref={backHref}
    />
  );
}
