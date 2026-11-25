import { getSessionUserOrThrow } from "@/lib/auth";
import { hasOnCallPermission } from "@/lib/rbac";
import { getRequestDetail } from "@/modules/oncall/service";
import { OnCallDetail } from "@/components/oncall/OnCallDetail";
import { notFound } from "next/navigation";
import { getTenantVocab } from "@/lib/vocab";

export default async function OnCallDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string }>;
}) {
  const user = await getSessionUserOrThrow();
  const vocab = await getTenantVocab(user.tenantId);
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  // Only ever go back to an On Call page on this site ("//evil.example" is an external URL).
  const from = resolvedSearchParams.from ?? "";
  const backHref = /^\/on-call(?:[/?]|$)/.test(from) ? from : "/on-call";

  let request: Awaited<ReturnType<typeof getRequestDetail>>;
  try {
    request = await getRequestDetail(user.tenantId, resolvedParams.id);
  } catch {
    notFound();
  }
  // Staff without view_all (e.g. teachers) can open the requests they raised, not anyone else's.
  if (!hasOnCallPermission(user.role, "oncall:view_all") && request.requesterUserId !== user.id) {
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
      createdAt:
        e.type === "RESOLVED" && !canViewResolveTime
          ? null
          : e.createdAt instanceof Date
            ? e.createdAt.toISOString()
            : String(e.createdAt),
      actor: e.actor ? { id: e.actor.id as string, fullName: e.actor.fullName as string } : null,
    })) ?? [];

  return (
    <OnCallDetail
      request={{
        ...request,
        // Resolve times are for staff allowed to see them only; don't send them to anyone else.
        resolvedAt: canViewResolveTime ? request.resolvedAt : null,
        timelineEvents,
      }}
      inboxLabel={vocab.on_calls.singular}
      canAcknowledge={canAcknowledge}
      canResolve={canResolve}
      canCancel={canCancel}
      canDelete={canDelete}
      canViewResolveTime={canViewResolveTime}
      backHref={backHref}
    />
  );
}
