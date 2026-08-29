"use client";

import { useState } from "react";
import { UserDirectorySummary, type SummaryFilter } from "./UserDirectorySummary";
import { UserDirectoryTable, type UserRow } from "./UserDirectoryTable";
import { AddUserModal } from "./AddUserModal";
import type { TeacherOption } from "./EditUserModal";
import type { ActionResult } from "./actions";

export function UserDirectoryClient({
  users,
  allTeachers,
  scopedLoaByUser,
  stats,
  canEditSuperUsers,
  canAssignSuperAdmin,
  addModalOpen,
  onAddModalOpenChange,
  createUserAction,
  updateUserAction,
  updateRoleAction,
  toggleActiveAction,
  resetPasswordAction,
  deleteUserAction,
  avatarAction,
}: {
  users: UserRow[];
  allTeachers: TeacherOption[];
  scopedLoaByUser: Record<string, string[]>;
  stats: { total: number; active: number; inactive: number; adminCount: number };
  canEditSuperUsers: boolean;
  canAssignSuperAdmin: boolean;
  addModalOpen: boolean;
  onAddModalOpenChange: (open: boolean) => void;
  createUserAction: (formData: FormData) => Promise<ActionResult>;
  updateUserAction: (formData: FormData) => Promise<ActionResult>;
  updateRoleAction: (formData: FormData) => Promise<ActionResult>;
  toggleActiveAction: (formData: FormData) => Promise<ActionResult>;
  resetPasswordAction: (formData: FormData) => Promise<ActionResult>;
  deleteUserAction: (formData: FormData) => Promise<ActionResult>;
  avatarAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>({ status: "all", roleGroup: "all" });

  return (
    <>
      {stats.total > 0 ? (
        <UserDirectorySummary
          total={stats.total}
          active={stats.active}
          inactive={stats.inactive}
          adminCount={stats.adminCount}
          filter={summaryFilter}
          onFilterChange={setSummaryFilter}
        />
      ) : null}

      {users.length > 0 ? (
      <UserDirectoryTable
        users={users}
        allTeachers={allTeachers}
        scopedLoaByUser={scopedLoaByUser}
        summaryFilter={summaryFilter}
        onSummaryFilterChange={setSummaryFilter}
        saveAction={updateUserAction}
        updateRoleAction={updateRoleAction}
        toggleActiveAction={toggleActiveAction}
        resetPasswordAction={resetPasswordAction}
        deleteUserAction={deleteUserAction}
        avatarAction={avatarAction}
        canEditSuperUsers={canEditSuperUsers}
        canAssignSuperAdmin={canAssignSuperAdmin}
      />
      ) : null}

      {addModalOpen ? (
        <AddUserModal
          onClose={() => onAddModalOpenChange(false)}
          createAction={async (fd) => {
            const result = await createUserAction(fd);
            if (result.ok) onAddModalOpenChange(false);
            return result;
          }}
          canAssignSuperAdmin={canAssignSuperAdmin}
        />
      ) : null}
    </>
  );
}
