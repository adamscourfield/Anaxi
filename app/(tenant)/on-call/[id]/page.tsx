import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasOnCallPermission } from "@/lib/rbac";
import { getRequestDetail } from "@/modules/oncall/service";
import { OnCallDetail } from "@/components/oncall/OnCallDetail";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { REQUEST_TYPE_LABELS } from "@/modules/oncall/types";

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

  return (
    <div className="w-full min-w-0 space-y-5">
      <PageHeader variant="ledger"
        title="On Call Request"
        subtitle={`${request.student.fullName} · ${REQUEST_TYPE_LABELS[request.requestType as keyof typeof REQUEST_TYPE_LABELS] ?? request.requestType}`}
        actions={
          <Link href="/on-call">
            <Button variant="secondary">Back to inbox</Button>
          </Link>
        }
      />
      <OnCallDetail
        request={request}
        canAcknowledge={canAcknowledge}
        canResolve={canResolve}
        canCancel={canCancel}
      />
    </div>
  );
}
