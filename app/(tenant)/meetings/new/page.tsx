import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { MeetingForm } from "@/components/meetings/MeetingForm";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export default async function NewMeetingPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");
  if (!hasPermission(user.role, "meetings:create")) redirect("/meetings");

  const users = await (prisma as any).user.findMany({
    where: { tenantId: user.tenantId, isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, email: true, role: true },
  });

  return (
    <div className={`${styles.page} space-y-4`}>
      <MeetingForm users={users} currentUserId={user.id} />
    </div>
  );
}
