import { prisma } from "@/lib/prisma";
import type { ViewerContext } from "@/modules/authz";
import type { SessionUser } from "@/lib/types";

export async function buildViewerContext(user: SessionUser): Promise<ViewerContext> {
  const [hodMemberships, coachAssignments] = await Promise.all([
    (prisma as any).departmentMembership.findMany({
      where: { userId: user.id, isHeadOfDepartment: true },
    }),
    (prisma as any).coachAssignment.findMany({ where: { coachUserId: user.id } }),
  ]);

  return {
    userId: user.id,
    role: user.role,
    hodDepartmentIds: (hodMemberships as any[]).map((m: any) => m.departmentId),
    coacheeUserIds: (coachAssignments as any[]).map((a: any) => a.coacheeUserId),
  };
}
