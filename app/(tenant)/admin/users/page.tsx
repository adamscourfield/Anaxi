import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { UserDirectoryPageShell } from "./UserDirectoryPageShell";
import {
  createUser,
  resetPassword,
  toggleActive,
  updateUser,
  updateUserRole,
} from "./actions";

export default async function AdminUsersPage() {
  const user = await requireAdminUser();
  const canMutateSuperUsers = user.role === "SUPER_ADMIN";
  const canAssignSuperAdmin = user.role === "SUPER_ADMIN";

  const users = await (prisma as any).user.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { fullName: "asc" },
  });
  const scopes = await (prisma as any).lOAApprovalScope.findMany({
    where: { tenantId: user.tenantId },
  });

  const scopedByApprover = new Map<string, Set<string>>();
  for (const scope of scopes as any[]) {
    if (!scopedByApprover.has(scope.approverId)) scopedByApprover.set(scope.approverId, new Set());
    scopedByApprover.get(scope.approverId)!.add(scope.targetUserId);
  }

  const allUsers = users as any[];
  const activeCount = allUsers.filter((u) => u.isActive).length;
  const inactiveCount = allUsers.length - activeCount;
  const adminCount = allUsers.filter((u: any) =>
    ["ADMIN", "SLT", "SUPER_ADMIN"].includes(u.role),
  ).length;

  const scopedLoaByUser: Record<string, string[]> = {};
  for (const [approverId, targetIds] of scopedByApprover.entries()) {
    scopedLoaByUser[approverId] = Array.from(targetIds);
  }

  const tableUsers = allUsers.map((u: any) => {
    const scoped = scopedLoaByUser[u.id as string] ?? [];
    return {
      id: u.id as string,
      fullName: u.fullName as string,
      email: u.email as string,
      role: u.role as string,
      isActive: u.isActive as boolean,
      receivesOnCallEmails: u.receivesOnCallEmails as boolean,
      emailObservations: u.emailObservations as boolean,
      emailMeetings: u.emailMeetings as boolean,
      emailLeave: u.emailLeave as boolean,
      canApproveAllLoa: u.canApproveAllLoa as boolean,
      loaScopedCount: scoped.length,
    };
  });

  const allTeachers = allUsers
    .filter((u: any) => u.isActive)
    .map((u: any) => ({ id: u.id as string, fullName: u.fullName as string }));

  const shellProps = {
    users: tableUsers,
    allTeachers,
    scopedLoaByUser,
    stats: {
      total: allUsers.length,
      active: activeCount,
      inactive: inactiveCount,
      adminCount,
    },
    canEditSuperUsers: canMutateSuperUsers,
    canAssignSuperAdmin,
    createUserAction: createUser,
    updateUserAction: updateUser,
    updateRoleAction: updateUserRole,
    toggleActiveAction: toggleActive,
    resetPasswordAction: resetPassword,
  };

  if (allUsers.length === 0) {
    return (
      <div className="space-y-6">
        <UserDirectoryPageShell {...shellProps} />
        <EmptyState
          title="No staff yet"
          description="Add someone manually or import a CSV to populate your directory."
          action={
            <Link href="/admin/users/import" className="anx-btn-pill-primary calm-transition">
              Import CSV
            </Link>
          }
        />
      </div>
    );
  }

  return <UserDirectoryPageShell {...shellProps} />;
}
