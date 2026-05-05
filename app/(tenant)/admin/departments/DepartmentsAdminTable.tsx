"use client";

import { useState, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm";

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

const DEPT_CARD =
  "overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] shadow-[0_4px_24px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.04)]";

const ICON_ACTION =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[var(--surface-container-lowest)] text-[#6B7280] calm-transition hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827]";

function PersonGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);

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
      <div className="space-y-4">
        {departments.map((dept) => {
          const hod = dept.memberships.find((m) => m.isHeadOfDepartment);
          const isExpanded = expandedDepts.has(dept.id);
          const existingIds = new Set(dept.memberships.map((m) => m.userId));
          const availableToAdd = allUsers.filter((u) => !existingIds.has(u.id));
          const staffCount = dept.memberships.length;

          return (
            <div key={dept.id} className={DEPT_CARD}>
              {/* Collapsed header */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-4 px-5 py-5 sm:px-6">
                <button
                  type="button"
                  onClick={() => toggleExpand(dept.id)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[var(--surface-container-lowest)] text-[#6B7280] calm-transition hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827]"
                  title={isExpanded ? "Collapse" : "Expand"}
                  aria-expanded={isExpanded}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={`h-5 w-5 calm-transition ${isExpanded ? "rotate-180" : ""}`}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
                  <p className="text-base font-bold tracking-tight text-[#111827]">{dept.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[#6B7280]">
                      <PersonGlyph className="h-4 w-4 shrink-0 opacity-80" />
                      <span className="tabular-nums">{staffCount}</span>
                      <span>staff</span>
                    </span>
                    {dept.faculty ? (
                      <span className="text-[0.75rem] text-[#9CA3AF]">{dept.faculty}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:ml-auto sm:w-auto sm:justify-end">
                  <div className="flex min-w-0 max-w-full items-center gap-3">
                    {hod ? (
                      <>
                        <Avatar name={hod.user?.fullName ?? "?"} size="md" />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[0.9375rem] font-bold text-[#111827]">{hod.user?.fullName}</p>
                          <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Head of department</p>
                        </div>
                      </>
                    ) : (
                      <div className="text-[0.8125rem] italic text-[#6B7280]">No head assigned</div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => openAddMember(dept)} className={ICON_ACTION} title="Add staff member">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M19 8v6M22 11h-6" />
                      </svg>
                    </button>
                    <button type="button" onClick={() => openEdit(dept)} className={ICON_ACTION} title="Rename department">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: dept.id, name: dept.name })}
                      className={`${ICON_ACTION} hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
                      title="Delete department"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {isExpanded ? (
                <div className="border-t border-[#E5E7EB] px-5 pb-6 pt-5 sm:px-6">
                  <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Head of department</p>
                  <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-4 py-3.5">
                    {hod ? (
                      <div className="flex items-center gap-3">
                        <Avatar name={hod.user?.fullName ?? "?"} size="md" />
                        <div className="min-w-0">
                          <p className="font-bold text-[#111827]">{hod.user?.fullName}</p>
                          <p className="text-[0.8125rem] text-[#6B7280]">Head of Department</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[0.8125rem] italic text-[#6B7280]">No head of department assigned yet.</p>
                    )}
                  </div>

                  <p className="mt-8 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
                    Staff in {dept.name}
                  </p>

                  <div className="mt-3 overflow-x-auto rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)]">
                    <table className="w-full min-w-[320px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] bg-transparent">
                          <th className="px-4 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Staff member</th>
                          <th className="px-4 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Role</th>
                          <th className="w-[1%] whitespace-nowrap px-4 py-3 text-right text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dept.memberships.length === 0 && addingMemberDeptId !== dept.id ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-[0.8125rem] italic text-[#6B7280]">
                              No staff assigned yet.
                            </td>
                          </tr>
                        ) : null}
                        {dept.memberships.map((m) => (
                          <tr key={m.userId} className="border-b border-[#E5E7EB] last:border-b-0">
                            <td className="px-4 py-3.5">
                              <div className="flex min-w-0 items-center gap-3">
                                <Avatar name={m.user?.fullName ?? "?"} size="sm" />
                                <span className="truncate text-[0.8125rem] font-semibold text-[#111827]">{m.user?.fullName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-[0.8125rem] text-[#6B7280]">
                              {m.isHeadOfDepartment ? "Head of Department" : "Subject Teacher"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <form action={toggleHodAction} className="inline">
                                  <input type="hidden" name="departmentId" value={dept.id} />
                                  <input type="hidden" name="userId" value={m.userId} />
                                  <input type="hidden" name="current" value={String(m.isHeadOfDepartment)} />
                                  <button
                                    type="submit"
                                    className={ICON_ACTION}
                                    title={m.isHeadOfDepartment ? "Remove as head of department" : "Set as head of department"}
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                  </button>
                                </form>
                                <form action={removeMemberAction} className="inline">
                                  <input type="hidden" name="departmentId" value={dept.id} />
                                  <input type="hidden" name="userId" value={m.userId} />
                                  <button type="submit" className={`${ICON_ACTION} hover:border-red-200 hover:bg-red-50 hover:text-red-600`} title="Remove from department">
                                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6" />
                                    </svg>
                                  </button>
                                </form>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {addingMemberDeptId === dept.id && availableToAdd.length > 0 ? (
                    <form
                      action={addMemberAction}
                      onSubmit={() => setAddingMemberDeptId(null)}
                      className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3"
                    >
                      <input type="hidden" name="departmentId" value={dept.id} />
                      <PersonGlyph className="h-5 w-5 shrink-0 text-[#9CA3AF]" />
                      <select
                        name="userId"
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="min-h-[2.5rem] min-w-[12rem] flex-1 rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3 text-sm text-[#111827] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
                        required
                      >
                        <option value="">Select staff member…</option>
                        {availableToAdd.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-xl bg-[#111827] px-4 py-2 text-[0.8125rem] font-semibold text-white shadow-sm calm-transition hover:bg-[#1e293b]"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingMemberDeptId(null)}
                        className="rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-4 py-2 text-[0.8125rem] font-semibold text-[#6B7280] calm-transition hover:bg-[#F9FAFB] hover:text-[#111827]"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : null}

                  {addingMemberDeptId === dept.id && availableToAdd.length === 0 ? (
                    <p className="mt-4 text-[0.8125rem] italic text-[#6B7280]">All staff are already members of this department.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {editingDept ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => e.target === e.currentTarget && setEditingDept(null)}
          role="presentation"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] p-6 shadow-[0_8px_30px_rgba(15,23,42,0.12)]" role="dialog" aria-modal="true" aria-labelledby="dept-rename-title">
            <h2 id="dept-rename-title" className="mb-4 text-lg font-bold text-[#111827]">
              Rename department
            </h2>
            <form action={renameDepartmentAction} onSubmit={() => setEditingDept(null)}>
              <input type="hidden" name="id" value={editingDept.id} />
              <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Department name</label>
              <input name="name" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm text-[#111827] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]" required />
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-4 py-2 text-[0.8125rem] font-semibold text-[#6B7280] calm-transition hover:bg-[#F9FAFB] hover:text-[#111827]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#111827] px-4 py-2 text-[0.8125rem] font-semibold text-white calm-transition hover:bg-[#1e293b]"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <form ref={deleteFormRef} action={deleteDepartmentAction} className="hidden" aria-hidden="true">
        {deleteTarget ? <input type="hidden" name="id" value={deleteTarget.id} /> : null}
      </form>
      <DestructiveConfirmDialog
        open={deleteTarget != null}
        title="Delete department?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteFormRef.current) deleteFormRef.current.requestSubmit();
        }}
      >
        {deleteTarget ? `This will permanently remove "${deleteTarget.name}" and cannot be undone.` : null}
      </DestructiveConfirmDialog>
    </>
  );
}
