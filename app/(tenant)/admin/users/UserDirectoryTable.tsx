"use client";

import { useState, useMemo, type FormEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FormSelect } from "@/components/ui/form-select";
import { EditUserModal, TeacherOption } from "./EditUserModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  receivesOnCallEmails: boolean;
  canApproveAllLoa: boolean;
};

// ─── Inline icons ─────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m17 17 4 4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  SLT: "Senior Leader",
  HOD: "Head of Dept",
  LEADER: "Leader",
  TEACHER: "Teacher",
  HR: "HR Officer",
  ON_CALL: "On-Call Staff",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] || role.charAt(0) + role.slice(1).toLowerCase();
}

function statusInfo(user: UserRow): { label: string; color: string; dotClass: string } {
  if (user.isActive) {
    return { label: "Active", color: "text-text", dotClass: "bg-emerald-500" };
  }
  return { label: "Inactive", color: "text-text", dotClass: "bg-gray-400" };
}

const PAGE_SIZE = 20;

type StatusFilter = "all" | "active" | "inactive";
type SortKey = "name" | "role" | "status";

// ─── Component ────────────────────────────────────────────────────────────────

export function UserDirectoryTable({
  users,
  allTeachers,
  scopedLoaByUser,
  saveAction,
}: {
  users: UserRow[];
  allTeachers: TeacherOption[];
  scopedLoaByUser: Record<string, string[]>;
  saveAction: (formData: FormData) => void;
}) {
  const [appliedSearch, setAppliedSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [appliedStatus, setAppliedStatus] = useState<StatusFilter>("all");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("all");
  const [appliedRole, setAppliedRole] = useState("");
  const [draftRole, setDraftRole] = useState("");
  const [appliedSort, setAppliedSort] = useState<SortKey>("name");
  const [draftSort, setDraftSort] = useState<SortKey>("name");
  const [filterFormKey, setFilterFormKey] = useState(0);

  const hasAppliedFilters = !!appliedSearch.trim() || appliedStatus !== "all" || !!appliedRole;

  const triggerWhite = "!bg-surface-container-lowest rounded-[10px]";

  // Filter + sort (applied values only — matches Observation History “Apply filters” pattern)
  const filtered = useMemo(() => {
    let list = users;

    if (appliedSearch.trim()) {
      const q = appliedSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          roleLabel(u.role).toLowerCase().includes(q)
      );
    }

    if (appliedStatus === "active") list = list.filter((u) => u.isActive);
    else if (appliedStatus === "inactive") list = list.filter((u) => !u.isActive);

    if (appliedRole) list = list.filter((u) => u.role === appliedRole);

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (appliedSort === "name") return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
      if (appliedSort === "role") return roleLabel(a.role).localeCompare(roleLabel(b.role), undefined, { sensitivity: "base" });
      const sa = a.isActive ? 0 : 1;
      const sb = b.isActive ? 0 : 1;
      return sa - sb;
    });
    return sorted;
  }, [users, appliedSearch, appliedStatus, appliedRole, appliedSort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageUsers = filtered.slice(start, start + PAGE_SIZE);

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    setAppliedSearch(draftSearch);
    setAppliedStatus(draftStatus);
    setAppliedRole(draftRole);
    setAppliedSort(draftSort);
    setPage(1);
  }

  function clearFilters() {
    setDraftSearch("");
    setAppliedSearch("");
    setDraftStatus("all");
    setAppliedStatus("all");
    setDraftRole("");
    setAppliedRole("");
    setDraftSort("name");
    setAppliedSort("name");
    setPage(1);
    setFilterFormKey((k) => k + 1);
  }

  // Generate page numbers to display
  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis")[] = [];
    pages.push(1);
    if (safePage > 3) pages.push("ellipsis");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
      pages.push(i);
    }
    if (safePage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
  }

  const sortLabel =
    appliedSort === "name" ? "Name (A–Z)" : appliedSort === "role" ? "Institutional role" : "Status (active first)";

  return (
    <div className="space-y-0">
      {/* ── Filters (aligned with Observation History) ───────────── */}
      <div className="mb-6 w-full rounded-2xl bg-surface-container-low p-5 shadow-ambient md:p-6">
        <form
          key={filterFormKey}
          onSubmit={applyFilters}
          className="flex w-full flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-4 lg:gap-y-4"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[200px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Search</span>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="Name, email, or role…"
                className={`field w-full py-2.5 pl-10 pr-3 text-[0.875rem] ${triggerWhite}`}
              />
            </div>
          </label>

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[140px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Status</span>
            <FormSelect
              name="_status"
              defaultValue={draftStatus}
              placeholder="All staff"
              triggerClassName={triggerWhite}
              options={[
                { value: "all", label: "All staff" },
                { value: "active", label: "Active only" },
                { value: "inactive", label: "Inactive only" },
              ]}
              onChange={(v) => setDraftStatus(v as StatusFilter)}
            />
          </label>

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[160px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Institutional role</span>
            <FormSelect
              name="_role"
              defaultValue={draftRole}
              placeholder="All roles"
              triggerClassName={triggerWhite}
              options={[
                { value: "", label: "All roles" },
                ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
              ]}
              onChange={setDraftRole}
            />
          </label>

          <label className="flex min-w-0 flex-1 flex-col gap-1.5 lg:min-w-[180px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Sort by</span>
            <FormSelect
              name="_sort"
              defaultValue={draftSort}
              placeholder="Sort…"
              triggerClassName={triggerWhite}
              options={[
                { value: "name", label: "Name (A–Z)" },
                { value: "role", label: "Institutional role" },
                { value: "status", label: "Status (active first)" },
              ]}
              onChange={(v) => setDraftSort(v as SortKey)}
            />
          </label>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto lg:w-auto lg:flex-none">
            <button
              type="submit"
              className="field flex w-full items-center justify-center border-0 bg-primary py-2.5 text-[0.8125rem] font-bold text-on-primary calm-transition hover:opacity-90 sm:min-w-[140px] lg:w-auto lg:min-w-[160px]"
            >
              Apply Filters
            </button>
            {hasAppliedFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="field flex w-full items-center justify-center border border-border/40 bg-surface-container-lowest py-2.5 text-center text-[0.8125rem] font-medium text-muted calm-transition hover:bg-surface-container-low hover:text-text sm:min-w-[100px] lg:w-auto"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      <p className="mb-3 text-[0.8125rem] text-muted">
        Sorted by <span className="font-medium text-text">{sortLabel}</span>
        {filtered.length !== users.length ? (
          <>
            {" "}
            · <span className="font-medium text-text">{filtered.length}</span> of {users.length} shown
          </>
        ) : null}
      </p>

      {/* ── Table (Observation History table-shell) ───────────────── */}
      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="table-head-row text-left">
                <th className="px-5 py-3.5">Staff member</th>
                <th className="px-5 py-3.5">Institutional role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[0.875rem] text-muted">
                    No users match your search or filters.
                  </td>
                </tr>
              ) : (
                pageUsers.map((u) => {
                  const status = statusInfo(u);
                  return (
                    <tr key={u.id} className="group table-row calm-transition">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.fullName} size="md" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-text">{u.fullName}</p>
                            <p className="truncate text-[0.8125rem] text-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-text">{roleLabel(u.role)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${status.dotClass}`} />
                          <span className="text-[0.8125rem] font-medium text-text">{status.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setEditingUser(u)}
                          className="inline-flex rounded-xl border border-black/[0.08] bg-[#F1F3F5] px-4 py-2 text-[0.8125rem] font-semibold text-text calm-transition hover:border-black/[0.12] hover:bg-[#e8eaed]"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination (aligned with Observation History) ───────── */}
        {filtered.length > 0 && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/20 px-5 py-3.5">
            <p className="text-[0.8125rem] text-muted">
              Showing{" "}
              <span className="font-semibold text-text">
                {start + 1}-{Math.min(start + PAGE_SIZE, filtered.length)}
              </span>{" "}
              of <span className="font-semibold text-text">{filtered.length.toLocaleString()}</span> staff
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text disabled:pointer-events-none disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeftIcon />
              </button>
              {getPageNumbers().map((p, idx) =>
                p === "ellipsis" ? (
                  <span key={`e-${idx}`} className="inline-flex h-8 w-8 items-center justify-center text-[0.8125rem] text-muted">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[0.8125rem] calm-transition ${
                      p === safePage
                        ? "bg-accent font-semibold text-on-primary"
                        : "text-muted hover:bg-surface-container-low hover:text-text"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-surface-container-low hover:text-text disabled:pointer-events-none disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit User Modal ─────────────────────────────────────── */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          allTeachers={allTeachers}
          scopedLoaTargetIds={scopedLoaByUser[editingUser.id] ?? []}
          onClose={() => setEditingUser(null)}
          saveAction={saveAction}
        />
      )}
    </div>
  );
}
