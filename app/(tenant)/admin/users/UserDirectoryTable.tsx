"use client";

import { useState, useMemo, useRef, useEffect, useTransition, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
import { TableScrollRegion } from "@/components/ui/table-scroll-region";
import { TablePagination } from "@/components/ui/table-pagination";
import { toast } from "@/components/toast-provider";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm";
import { EditUserModal, TeacherOption } from "./EditUserModal";
import type { SummaryFilter } from "./UserDirectorySummary";
import type { ActionResult } from "./actions";

export type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  receivesOnCallEmails: boolean;
  receivesFirstAidEmails: boolean;
  emailObservations: boolean;
  emailMeetings: boolean;
  emailLeave: boolean;
  canApproveAllLoa: boolean;
  loaScopedCount: number;
  avatarUrl: string | null;
};

const ADMIN_ROLES = new Set(["ADMIN", "SLT", "SUPER_ADMIN"]);

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  SLT: "Senior Leader",
  HOD: "Head of Dept",
  LEADER: "Leader",
  TEACHER: "Teacher",
  SUPPORT: "Support",
  HR: "HR Officer",
  ON_CALL: "On-Call Staff",
};

const ROLE_OPTIONS_ALL = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m17 17 4 4" strokeLinecap="round" />
    </svg>
  );
}

function AccessBadge({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded-md border border-border/40 bg-surface-container-low px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-muted"
    >
      {children}
    </span>
  );
}

const PAGE_SIZE = 20;
type SortKey = "name" | "role" | "status";
type StatusFilter = "all" | "active" | "inactive";

export function UserDirectoryTable({
  users,
  allTeachers,
  scopedLoaByUser,
  summaryFilter,
  onSummaryFilterChange,
  saveAction,
  updateRoleAction,
  toggleActiveAction,
  resetPasswordAction,
  deleteUserAction,
  avatarAction,
  canEditSuperUsers,
  canAssignSuperAdmin,
}: {
  users: UserRow[];
  allTeachers: TeacherOption[];
  scopedLoaByUser: Record<string, string[]>;
  summaryFilter: SummaryFilter;
  onSummaryFilterChange: (f: SummaryFilter) => void;
  saveAction: (formData: FormData) => Promise<ActionResult>;
  updateRoleAction: (formData: FormData) => Promise<ActionResult>;
  toggleActiveAction: (formData: FormData) => Promise<ActionResult>;
  resetPasswordAction: (formData: FormData) => Promise<ActionResult>;
  deleteUserAction: (formData: FormData) => Promise<ActionResult>;
  avatarAction: (formData: FormData) => Promise<ActionResult>;
  canEditSuperUsers: boolean;
  canAssignSuperAdmin: boolean;
}) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  const roleOptionsInline = canAssignSuperAdmin
    ? ROLE_OPTIONS_ALL
    : ROLE_OPTIONS_ALL.filter((r) => r.value !== "SUPER_ADMIN");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const statusFilter: StatusFilter =
    summaryFilter.status === "active" ? "active" : summaryFilter.status === "inactive" ? "inactive" : "all";

  const filtered = useMemo(() => {
    let list = users;

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          roleLabel(u.role).toLowerCase().includes(q),
      );
    }

    if (statusFilter === "active") list = list.filter((u) => u.isActive);
    else if (statusFilter === "inactive") list = list.filter((u) => !u.isActive);

    if (summaryFilter.roleGroup === "administrators") {
      list = list.filter((u) => ADMIN_ROLES.has(u.role));
    } else if (roleFilter) {
      list = list.filter((u) => u.role === roleFilter);
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "name") return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
      if (sort === "role") return roleLabel(a.role).localeCompare(roleLabel(b.role), undefined, { sensitivity: "base" });
      const sa = a.isActive ? 0 : 1;
      const sb = b.isActive ? 0 : 1;
      return sa - sb;
    });
    return sorted;
  }, [users, debouncedSearch, statusFilter, summaryFilter.roleGroup, roleFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, summaryFilter.roleGroup, roleFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageUsers = filtered.slice(start, start + PAGE_SIZE);

  const triggerWhite = "field-filter-trigger";

  function rowLocked(u: UserRow) {
    return u.role === "SUPER_ADMIN" && !canEditSuperUsers;
  }

  function runRowAction(fn: () => Promise<ActionResult>, successMessage: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast(successMessage, "success");
        setOpenMenuId(null);
      } else {
        toast(result.error, "error");
      }
    });
  }

  function handleRoleChange(userId: string, newRole: string) {
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("role", newRole);
    runRowAction(() => updateRoleAction(fd), "Role updated");
  }

  function handleToggleActive(u: UserRow) {
    const label = u.isActive ? "deactivated" : "activated";
    if (!window.confirm(`${u.isActive ? "Deactivate" : "Activate"} ${u.fullName}?`)) return;
    const fd = new FormData();
    fd.set("id", u.id);
    fd.set("active", String(u.isActive));
    runRowAction(() => toggleActiveAction(fd), `Staff member ${label}`);
  }

  function handleResetPassword(u: UserRow) {
    if (
      !window.confirm(
        `Reset password for ${u.fullName} to the default temporary password (Password123!)? They should change it on next login.`,
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set("id", u.id);
    runRowAction(() => resetPasswordAction(fd), "Password reset");
  }

  function handleDeleteUser(u: UserRow) {
    const fd = new FormData();
    fd.set("id", u.id);
    runRowAction(() => deleteUserAction(fd), "Staff member deleted");
  }

  const sortLabel =
    sort === "name" ? "Name (A–Z)" : sort === "role" ? "Role" : "Status (active first)";

  return (
    <div className="space-y-4">
      <div className="filter-panel rounded-sm shadow-none">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[220px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Search</span>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, or role…"
                className={`field w-full py-2.5 !pl-[3rem] pr-3 text-[0.875rem] ${triggerWhite}`}
              />
            </div>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5 lg:min-w-[140px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Status</span>
            <FormSelect
              key={`status-${summaryFilter.status}-${summaryFilter.roleGroup}`}
              name="_status"
              defaultValue={summaryFilter.status}
              placeholder="All staff"
              triggerClassName={triggerWhite}
              options={[
                { value: "all", label: "All staff" },
                { value: "active", label: "Active only" },
                { value: "inactive", label: "Inactive only" },
              ]}
              onChange={(v) =>
                onSummaryFilterChange({
                  ...summaryFilter,
                  status: v as SummaryFilter["status"],
                })
              }
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5 lg:min-w-[160px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Role</span>
            <FormSelect
              name="_role"
              defaultValue={roleFilter}
              placeholder="All roles"
              triggerClassName={triggerWhite}
              options={[{ value: "", label: "All roles" }, ...roleOptionsInline]}
              onChange={(v) => {
                setRoleFilter(v);
                if (v) onSummaryFilterChange({ ...summaryFilter, roleGroup: "all" });
              }}
            />
          </label>

          <label className="flex min-w-0 flex-col gap-1.5 lg:min-w-[160px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Sort by</span>
            <FormSelect
              name="_sort"
              defaultValue={sort}
              placeholder="Sort…"
              triggerClassName={triggerWhite}
              options={[
                { value: "name", label: "Name (A–Z)" },
                { value: "role", label: "Role" },
                { value: "status", label: "Status (active first)" },
              ]}
              onChange={(v) => setSort(v as SortKey)}
            />
          </label>
        </div>
      </div>

      <p className="text-[0.8125rem] text-muted">
        {filtered.length === users.length ? (
          <>
            <span className="font-medium text-text">{filtered.length}</span> staff · sorted by{" "}
            <span className="font-medium text-text">{sortLabel}</span>
          </>
        ) : (
          <>
            <span className="font-medium text-text">{filtered.length}</span> of{" "}
            <span className="font-medium text-text">{users.length}</span> staff · sorted by{" "}
            <span className="font-medium text-text">{sortLabel}</span>
          </>
        )}
      </p>

      <ul className="space-y-3 md:hidden" aria-label="Staff directory">
        {pageUsers.length === 0 ? (
          <li className="rounded-sm border border-border bg-surface-container-lowest px-4 py-8 text-center text-sm text-muted">
            No staff match your search or filters.
          </li>
        ) : (
          pageUsers.map((u) => {
            const locked = rowLocked(u);
            return (
              <li
                key={u.id}
                className="rounded-sm border border-border bg-surface-container-lowest p-4 shadow-none"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={u.fullName} size="md" avatarUrl={u.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text">{u.fullName}</p>
                    <p className="truncate text-sm text-muted">{u.email}</p>
                    <p className="mt-1 text-sm text-text">{roleLabel(u.role)}</p>
                    <p className="mt-2 text-xs text-muted">{u.isActive ? "Active" : "Inactive"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {u.emailObservations && <AccessBadge title="Observation emails">Obs</AccessBadge>}
                      {u.emailMeetings && <AccessBadge title="Meeting emails">Meet</AccessBadge>}
                      {u.emailLeave && <AccessBadge title="Leave emails">Leave</AccessBadge>}
                      {u.receivesOnCallEmails && <AccessBadge title="On-call emails">On-call</AccessBadge>}
                      {u.receivesFirstAidEmails && <AccessBadge title="First aid emails">First aid</AccessBadge>}
                    </div>
                    {!locked ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-3 w-full"
                        onClick={() => setEditingUser(u)}
                      >
                        Edit staff
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="table-shell hidden rounded-sm shadow-none md:block">
        <TableScrollRegion>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-head-row text-left">
                <th scope="col" className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.1em]">Staff member</th>
                <th scope="col" className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.1em]">Role</th>
                <th scope="col" className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.1em]">Status</th>
                <th scope="col" className="px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.1em]">Access</th>
                <th scope="col" className="px-5 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[0.875rem] text-muted">
                    No staff match your search or filters.
                  </td>
                </tr>
              ) : (
                pageUsers.map((u) => {
                  const locked = rowLocked(u);
                  const loaTitle = u.canApproveAllLoa
                    ? "Approves leave for all teachers"
                    : u.loaScopedCount > 0
                      ? `Approves leave for ${u.loaScopedCount} teacher${u.loaScopedCount === 1 ? "" : "s"}`
                      : undefined;

                  return (
                    <tr
                      key={u.id}
                      className={`group table-row calm-transition ${locked ? "" : "cursor-pointer"}`}
                      onClick={() => !locked && setEditingUser(u)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.fullName} size="md" avatarUrl={u.avatarUrl} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-text">{u.fullName}</p>
                            <p className="truncate text-[0.8125rem] text-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        {locked ? (
                          <span className="text-text">{roleLabel(u.role)}</span>
                        ) : (
                          <select
                            value={u.role}
                            disabled={pending}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="field max-w-[11rem] rounded-lg border-border/50 bg-background py-1.5 pl-2 pr-7 text-[0.8125rem] font-medium text-text"
                            aria-label={`Role for ${u.fullName}`}
                          >
                            {roleOptionsInline.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                              u.isActive ? "bg-scale-strong" : "bg-on-surface-variant/45"
                            }`}
                          />
                          <span className="text-[0.8125rem] font-medium text-text">
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {u.receivesOnCallEmails ? (
                            <AccessBadge title="Receives on-call emails">On-call</AccessBadge>
                          ) : null}
                          {u.receivesFirstAidEmails ? (
                            <AccessBadge title="Receives first aid emails">First aid</AccessBadge>
                          ) : null}
                          {u.canApproveAllLoa || u.loaScopedCount > 0 ? (
                            <AccessBadge title={loaTitle}>
                              LOA{u.canApproveAllLoa ? "" : ` · ${u.loaScopedCount}`}
                            </AccessBadge>
                          ) : null}
                          {!u.receivesOnCallEmails && !u.receivesFirstAidEmails && !u.canApproveAllLoa && u.loaScopedCount === 0 ? (
                            <span className="text-[0.8125rem] text-muted">—</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {locked ? (
                          <span className="text-[0.8125rem] text-muted">—</span>
                        ) : (
                          <div className="relative inline-flex items-center gap-1" ref={openMenuId === u.id ? menuRef : undefined}>
                            <button
                              type="button"
                              onClick={() => setEditingUser(u)}
                              className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-[0.8125rem] font-semibold text-text calm-transition hover:bg-surface-container-low"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              aria-expanded={openMenuId === u.id}
                              aria-haspopup="menu"
                              onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted calm-transition hover:bg-surface-container-low hover:text-text"
                            >
                              ⋮
                            </button>
                            {openMenuId === u.id ? (
                              <div
                                role="menu"
                                className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-lg border border-border/40 bg-background py-1 shadow-lg"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-2 text-left text-[0.8125rem] text-text calm-transition hover:bg-surface-container-low"
                                  onClick={() => handleToggleActive(u)}
                                >
                                  {u.isActive ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-2 text-left text-[0.8125rem] text-text calm-transition hover:bg-surface-container-low"
                                  onClick={() => handleResetPassword(u)}
                                >
                                  Reset password
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="block w-full px-3 py-2 text-left text-[0.8125rem] text-error calm-transition hover:bg-error/10"
                                  onClick={() => {
                                    setDeleteTarget(u);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableScrollRegion>

        <TablePagination
          page={safePage}
          totalPages={totalPages}
          totalItems={filtered.length}
          pageSize={PAGE_SIZE}
          itemLabel="staff"
          onPageChange={setPage}
        />
      </div>

      {editingUser ? (
        <EditUserModal
          user={editingUser}
          allTeachers={allTeachers}
          scopedLoaTargetIds={scopedLoaByUser[editingUser.id] ?? []}
          onClose={() => setEditingUser(null)}
          saveAction={saveAction}
          avatarAction={avatarAction}
          readOnly={editingUser.role === "SUPER_ADMIN" && !canEditSuperUsers}
          canAssignSuperAdmin={canAssignSuperAdmin}
        />
      ) : null}

      <DestructiveConfirmDialog
        open={deleteTarget != null}
        title="Delete staff member?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDeleteUser(deleteTarget);
        }}
      >
        {deleteTarget ? (
          <>
            This will permanently remove &ldquo;{deleteTarget.fullName}&rdquo; and cannot be undone. Staff with
            observations, leave requests, or on-call history can&rsquo;t be deleted — deactivate them instead.
          </>
        ) : null}
      </DestructiveConfirmDialog>
    </div>
  );
}
