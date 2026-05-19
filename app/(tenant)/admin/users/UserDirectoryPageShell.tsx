"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { UserDirectoryClient } from "./UserDirectoryClient";
import { UserDirectoryHeaderActions } from "./UserDirectoryHeaderActions";
import type { UserRow } from "./UserDirectoryTable";
import type { TeacherOption } from "./EditUserModal";
import type { ActionResult } from "./actions";

export function UserDirectoryPageShell({
  users,
  allTeachers,
  scopedLoaByUser,
  stats,
  canEditSuperUsers,
  canAssignSuperAdmin,
  createUserAction,
  updateUserAction,
  updateRoleAction,
  toggleActiveAction,
  resetPasswordAction,
}: {
  users: UserRow[];
  allTeachers: TeacherOption[];
  scopedLoaByUser: Record<string, string[]>;
  stats: { total: number; active: number; inactive: number; adminCount: number };
  canEditSuperUsers: boolean;
  canAssignSuperAdmin: boolean;
  createUserAction: (formData: FormData) => Promise<ActionResult>;
  updateUserAction: (formData: FormData) => Promise<ActionResult>;
  updateRoleAction: (formData: FormData) => Promise<ActionResult>;
  toggleActiveAction: (formData: FormData) => Promise<ActionResult>;
  resetPasswordAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        variant="ledger"
        eyebrow={<>Administration&ensp;›&ensp;User management</>}
        title="User management"
        subtitle="Manage staff accounts, roles, and access permissions."
        actions={<UserDirectoryHeaderActions onAddStaff={() => setAddOpen(true)} />}
      />

      <UserDirectoryClient
        users={users}
        allTeachers={allTeachers}
        scopedLoaByUser={scopedLoaByUser}
        stats={stats}
        canEditSuperUsers={canEditSuperUsers}
        canAssignSuperAdmin={canAssignSuperAdmin}
        addModalOpen={addOpen}
        onAddModalOpenChange={setAddOpen}
        createUserAction={createUserAction}
        updateUserAction={updateUserAction}
        updateRoleAction={updateRoleAction}
        toggleActiveAction={toggleActiveAction}
        resetPasswordAction={resetPasswordAction}
      />
    </div>
  );
}
