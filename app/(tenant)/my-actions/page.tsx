import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { getMyActions } from "@/modules/actions/service";
import { PageHeader } from "@/components/ui/page-header";
import { MyActionsBoard, type MyAction } from "@/components/actions/MyActionsBoard";
import styles from "@/components/actions/actions.module.css";

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export default async function MyActionsPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");
  if (!hasPermission(user.role, "actions:view_own")) redirect("/home");

  const grouped = await getMyActions(user.tenantId, user.id);
  const actions: MyAction[] = [...grouped.OPEN, ...grouped.BLOCKED, ...grouped.DONE].map((a: any) => ({
    id: a.id,
    description: a.description,
    status: a.status,
    dueDate: iso(a.dueDate),
    blockReason: a.blockReason ?? null,
    completedAt: iso(a.completedAt),
    meeting: a.meeting ? { id: a.meeting.id, title: a.meeting.title } : null,
  }));

  return (
    <div className={`${styles.page} mx-auto w-full max-w-4xl space-y-8 pb-16`}>
      <PageHeader
        title="My actions"
        subtitle="Follow-ups given to you in meetings. Tick them off as you go."
        actions={
          <Link
            href="/meetings"
            className="inline-flex h-10 items-center rounded-[10px] border border-[#e5e5e6] bg-white px-4 text-[14px] font-medium text-[#1c1c1e] calm-transition hover:border-[#a1a1aa]"
          >
            Meetings
          </Link>
        }
      />
      <MyActionsBoard initialActions={actions} doneTotal={grouped.doneTotal} />
    </div>
  );
}
