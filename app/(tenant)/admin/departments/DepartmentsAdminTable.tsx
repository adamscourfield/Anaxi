"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";

type DeptMember = {
  userId: string;
  isHeadOfDepartment: boolean;
  user: { id: string; fullName: string };
};

type Department = {
  id: string;
  name: string;
  faculty: string | null;
  memberships: DeptMember[];
};

type User = { id: string; fullName: string };

type Props = {
  departments: Department[];
  allUsers: User[];
  deleteDepartmentAction: (formData: FormData) => void;
  addMemberAction: (formData: FormData) => void;
  removeMemberAction: (formData: FormData) => void;
  toggleHodAction: (formData: FormData) => void;
  renameDepartmentAction: (formData: FormData) => void;
};

export function DepartmentsAdminTable({
  departments,
  allUsers,
  deleteDepartmentAction,
  addMemberAction,
  removeMemberAction,
  toggleHodAction,
  renameDepartmentAction,
}: Props) {
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [addingMemberDeptId, setAddingMemberDeptId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");

  function openEdit(dept: Department) {
    setEditingDept(dept);
    setEditName(dept.name);
  }

  function toggleExpand(deptId: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
        if (addingMemberDeptId === deptId) setAddingMemberDeptId(null);
      } else {
        next.add(deptId);
      }
      return next;
    });
  }

  function openAddMember(dept: Department) {
    const existingIds = new Set(dept.memberships.map((m) => m.userId));
    const first = allUsers.find((u) => !existingIds.has(u.id));
    setSelectedUserId(first?.id ?? "");
    setAddingMemberDeptId(dept.id);
    setExpandedDepts((prev) => new Set([...prev, dept.id]));
  }

  return (
    <>
      <div className="space-y-3">
        {departments.map((dept) => {
          const hod = dept.memberships.find((m) => m.isHeadOfDepartment);
          const isExpanded = expandedDepts.has(dept.id);
          const existingIds = new Set(dept.memberships.map((m) => m.userId));
          const availableToAdd = allUsers.filter((u) => !existingIds.has(u.id));

          return (
            <div
              key={dept.id}
              className="overflow-hidden rounded-2xl bg-[var(--surface-container-lowest)] shadow-ambient calm-transition hover:shadow-md"
            >
              {/* Department header row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-5 py-4">
                {/* Expand toggle */}
                <button
                  type="button"
                  onClick={() => toggleExpand(dept.id)}
                  className="shrink-0 rounded-lg p-1.5 text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text"
                  title={isExpanded ? "Collapse" : "Expand staff"}
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className={`h-4 w-4 calm-transition ${isExpanded ? "rotate-90" : ""}`}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 7l3 3 3-3" />
                  </svg>
                </button>

                {/* Dept info */}
                <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
                  <p className="text-[0.875rem] font-semibold tracking-[-0.01em] text-text leading-snug">{dept.name}</p>
                  {dept.faculty && (
                    <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{dept.faculty}</p>
                  )}
                </div>

                {/* HOD + staff + actions — single trailing cluster */}
                <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap sm:gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                    {/* HOD — one compact row */}
                    <div className="hidden min-w-0 sm:block">
                      {hod ? (
                        <div className="flex max-w-[min(100%,16rem)] items-center gap-2 rounded-xl bg-[var(--surface-container-low)] px-2.5 py-1.5">
                          <Avatar name={hod.user?.fullName ?? "?"} size="sm" />
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-sm font-medium text-text">{hod.user?.fullName}</p>
                            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted/80">Head of department</p>
                          </div>
                        </div>
                      ) : (
                        <span className="rounded-xl bg-[var(--surface-container-low)] px-2.5 py-1.5 text-xs italic text-muted">
                          No HOD set
                        </span>
                      )}
                    </div>

                    {/* Staff — inline number + label */}
                    <div
                      className="hidden items-baseline gap-1.5 rounded-xl bg-[var(--surface-container-low)] px-2.5 py-1.5 tabular-nums sm:inline-flex"
                      title="Staff in department"
                    >
                      <span className="text-sm font-semibold text-text">{dept.memberships.length}</span>
                      <span className="text-[11px] font-medium text-muted">staff</span>
                    </div>
                  </div>

                  {/* Mobile: HOD + staff inline */}
                  <div className="flex w-full flex-col gap-2 sm:hidden">
                    {hod ? (
                      <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-container-low)] px-2.5 py-1.5">
                        <Avatar name={hod.user?.fullName ?? "?"} size="sm" />
                        <div className="min-w-0 flex-1 leading-tight">
                          <p className="truncate text-sm font-medium text-text">{hod.user?.fullName}</p>
                          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted/80">Head of department</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-text">
                          {dept.memberships.length}
                          <span className="ml-1 text-[11px] font-medium text-muted">staff</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-container-low)] px-2.5 py-1.5">
                        <span className="text-xs italic text-muted">No HOD set</span>
                        <span className="text-sm font-semibold tabular-nums text-text">
                          {dept.memberships.length}
                          <span className="ml-1 text-[11px] font-medium text-muted">staff</span>
                        </span>
                      </div>
                    )}
                  </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-0.5 border-l border-[var(--surface-container-low)] pl-2 sm:pl-3">
                  <button
                    type="button"
                    onClick={() => openAddMember(dept)}
                    className="rounded-md p-1.5 text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text"
                    title="Add staff member"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 18v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="10" cy="6" r="3" />
                      <path d="M15 9v4M13 11h4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(dept)}
                    className="rounded-md p-1.5 text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text"
                    title="Rename department"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-9.07 9.07-3.87.968.968-3.87 9.144-9.143z" />
                    </svg>
                  </button>
                  <form action={deleteDepartmentAction}>
                    <input type="hidden" name="id" value={dept.id} />
                    <button
                      type="submit"
                      className="rounded-md p-1.5 text-muted calm-transition hover:bg-error/10 hover:text-error"
                      title="Delete department"
                      onClick={(e) => {
                        if (!confirm(`Delete "${dept.name}"? This cannot be undone.`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 6h12M8 6V4h4v2M6 6v10a1 1 0 001 1h6a1 1 0 001-1V6" />
                      </svg>
                    </button>
                  </form>
                </div>
                </div>
              </div>

              {/* Expanded staff panel */}
              {isExpanded && (
                <div className="space-y-2 border-t border-[var(--surface-container-low)] bg-[var(--surface-container-low)]/40 px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted mb-3">
                    Staff in {dept.name}
                  </p>

                  {dept.memberships.length === 0 && addingMemberDeptId !== dept.id && (
                    <p className="text-sm text-muted italic">No staff assigned yet.</p>
                  )}

                  {dept.memberships.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center gap-3 rounded-xl bg-[var(--surface-container-lowest)] px-3 py-2.5 shadow-ambient"
                    >
                      <Avatar name={m.user?.fullName ?? "?"} size="sm" />
                      <span className="flex-1 text-sm font-medium text-text min-w-0 truncate">
                        {m.user?.fullName}
                      </span>

                      {/* HOD toggle */}
                      <form action={toggleHodAction}>
                        <input type="hidden" name="departmentId" value={dept.id} />
                        <input type="hidden" name="userId" value={m.userId} />
                        <input type="hidden" name="current" value={String(m.isHeadOfDepartment)} />
                        <button
                          type="submit"
                          title={m.isHeadOfDepartment ? "Remove as HOD" : "Set as HOD"}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] calm-transition ${
                            m.isHeadOfDepartment
                              ? "bg-accent/10 text-accent border border-accent/30 hover:bg-error/10 hover:text-error hover:border-error/30"
                              : "bg-surface-container-low text-muted border border-border hover:bg-accent/10 hover:text-accent hover:border-accent/30"
                          }`}
                        >
                          {m.isHeadOfDepartment ? (
                            <>
                              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                                <path d="M8 1.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 3a3 3 0 116 0 3 3 0 01-6 0z" />
                                <path d="M8 7a5 5 0 00-4.546 2.916A.75.75 0 004 11h8a.75.75 0 00.546-1.284A5 5 0 008 7z" />
                              </svg>
                              HOD
                            </>
                          ) : (
                            "Set HOD"
                          )}
                        </button>
                      </form>

                      {/* Remove member */}
                      <form action={removeMemberAction}>
                        <input type="hidden" name="departmentId" value={dept.id} />
                        <input type="hidden" name="userId" value={m.userId} />
                        <button
                          type="submit"
                          title="Remove from department"
                          className="rounded-md p-1.5 text-muted calm-transition hover:bg-error/10 hover:text-error"
                        >
                          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 10h12" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  ))}

                  {/* Inline add member row */}
                  {addingMemberDeptId === dept.id && availableToAdd.length > 0 && (
                    <form
                      action={addMemberAction}
                      onSubmit={() => setAddingMemberDeptId(null)}
                      className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.03] px-3 py-2.5"
                    >
                      <input type="hidden" name="departmentId" value={dept.id} />
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-accent" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 18v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="10" cy="6" r="3" />
                        <path d="M15 9v4M13 11h4" />
                      </svg>
                      <select
                        name="userId"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                        required
                      >
                        <option value="">Select staff member…</option>
                        {availableToAdd.map((u) => (
                          <option key={u.id} value={u.id}>{u.fullName}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white calm-transition hover:opacity-90"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingMemberDeptId(null)}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted calm-transition hover:text-text"
                      >
                        Cancel
                      </button>
                    </form>
                  )}

                  {addingMemberDeptId === dept.id && availableToAdd.length === 0 && (
                    <p className="text-sm text-muted italic px-1">All staff are already members of this department.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Edit Department Dialog ─────────────────────────────────────── */}
      {editingDept && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => e.target === e.currentTarget && setEditingDept(null)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-surface-container-lowest p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-text mb-4">Rename Department</h2>
            <form action={renameDepartmentAction} onSubmit={() => setEditingDept(null)}>
              <input type="hidden" name="id" value={editingDept.id} />
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-1.5">
                Department Name
              </label>
              <input
                name="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="field w-full"
                required
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:text-text calm-transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90 calm-transition"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
