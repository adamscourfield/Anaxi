"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";
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

function FilterIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5h14M5 10h10M7 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6h14M3 10h10M3 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

function ChevronsLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 4l-4 4 4 4M12 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronsRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4l4 4-4 4M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const hasPanelFilters = statusFilter !== "all" || !!roleFilter;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = users;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          roleLabel(u.role).toLowerCase().includes(q)
      );
    }

    if (statusFilter === "active") list = list.filter((u) => u.isActive);
    else if (statusFilter === "inactive") list = list.filter((u) => !u.isActive);

    if (roleFilter) list = list.filter((u) => u.role === roleFilter);

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === "name") return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
      if (sortBy === "role") return roleLabel(a.role).localeCompare(roleLabel(b.role), undefined, { sensitivity: "base" });
      const sa = a.isActive ? 0 : 1;
      const sb = b.isActive ? 0 : 1;
      return sa - sb;
    });
    return sorted;
  }, [users, search, statusFilter, roleFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageUsers = filtered.slice(start, start + PAGE_SIZE);

  // Reset to page 1 when search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

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
    sortBy === "name" ? "Name (A–Z)" : sortBy === "role" ? "Institutional role" : "Status";

  return (
    <div className="space-y-0">
      {/* ── Toolbar (aligned with Leave / Students patterns) ─────── */}
      <div className="mb-4 space-y-3">
        <div className="filter-bar items-center">
          <div className="relative min-w-[200px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name, email, or institutional role..."
              className="field w-full !rounded-xl !border-black/[0.06] !bg-white !py-2.5 pl-11 pr-4 text-[0.9375rem] shadow-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] font-medium calm-transition ${
              showFilters || hasPanelFilters
                ? "border-black/[0.08] bg-[#F1F3F5] text-text"
                : "border-black/[0.06] bg-[#F1F3F5] text-muted hover:border-black/[0.1] hover:text-text"
            }`}
          >
            <FilterIcon />
            Filter
            {hasPanelFilters ? (
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
            ) : null}
          </button>

          <div className="relative shrink-0" ref={sortMenuRef}>
            <button
              type="button"
              onClick={() => setShowSortMenu((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-black/[0.06] bg-[#F1F3F5] px-3.5 py-2.5 text-[0.8125rem] font-medium text-muted calm-transition hover:border-black/[0.1] hover:text-text"
              aria-expanded={showSortMenu}
              aria-haspopup="listbox"
            >
              <SortIcon />
              Sort
            </button>
            {showSortMenu && (
              <div
                className="absolute right-0 top-full z-40 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-black/[0.08] bg-white py-1 shadow-lg"
                role="listbox"
              >
                {(
                  [
                    ["name", "Name (A–Z)"],
                    ["role", "Institutional role"],
                    ["status", "Status (active first)"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={sortBy === key ? true : false}
                    className={`w-full px-4 py-2.5 text-left text-[0.8125rem] calm-transition ${
                      sortBy === key ? "bg-[#fafbfc] font-semibold text-text" : "text-muted hover:bg-[#fafbfc] hover:text-text"
                    }`}
                    onClick={() => {
                      setSortBy(key);
                      setShowSortMenu(false);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-black/[0.06] bg-white px-4 py-4 shadow-sm">
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilter);
                  setPage(1);
                }}
                className="field w-full !rounded-xl !border-black/[0.06] !bg-[#fafbfc] !py-2 text-[0.8125rem]"
              >
                <option value="all">All staff</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Institutional role</label>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="field w-full !rounded-xl !border-black/[0.06] !bg-[#fafbfc] !py-2 text-[0.8125rem]"
              >
                <option value="">All roles</option>
                {Object.keys(ROLE_LABELS).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setRoleFilter("");
                setPage(1);
              }}
              className="inline-flex items-center justify-center rounded-xl border border-black/[0.08] bg-[#F1F3F5] px-4 py-2.5 text-[0.8125rem] font-medium text-text calm-transition hover:border-black/[0.12] hover:bg-[#e8eaed]"
            >
              Clear filters
            </button>
          </div>
        )}
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

      {/* ── Table (Leave of Absence card style) ───────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[#F1F3F5]">
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Staff member</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                  Institutional role
                </th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Status</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Actions</th>
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
                    <tr key={u.id} className="border-t border-[#eceef0] calm-transition hover:bg-[#fafbfc]">
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
      </div>

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="mt-5 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-[13px] text-muted">
            Showing <span className="font-semibold text-text">{start + 1} - {Math.min(start + PAGE_SIZE, filtered.length)}</span>{" "}
            of <span className="font-semibold text-text">{filtered.length.toLocaleString()}</span> ledger entries
          </p>

          <div className="flex items-center gap-1">
            {/* First page */}
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="First page"
            >
              <ChevronsLeftIcon />
            </button>

            {/* Previous page */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>

            {/* Page numbers */}
            {getPageNumbers().map((p, idx) =>
              p === "ellipsis" ? (
                <span key={`e-${idx}`} className="inline-flex h-9 w-9 items-center justify-center text-[13px] text-muted">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-medium calm-transition ${
                    p === safePage
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "text-text hover:bg-[var(--surface-container-low)]"
                  }`}
                >
                  {p}
                </button>
              )
            )}

            {/* Next page */}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>

            {/* Last page */}
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Last page"
            >
              <ChevronsRightIcon />
            </button>
          </div>
        </div>
      )}

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
