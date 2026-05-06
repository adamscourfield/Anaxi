"use client";

import type { ReactNode } from "react";
import { useState, useMemo, useRef, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EditableUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  receivesOnCallEmails: boolean;
  canApproveAllLoa: boolean;
};

export type TeacherOption = {
  id: string;
  fullName: string;
};

export type EditUserModalProps = {
  user: EditableUser;
  allTeachers: TeacherOption[];
  scopedLoaTargetIds: string[];
  onClose: () => void;
  saveAction: (formData: FormData) => void;
  /** When true, viewing only — cannot save changes (e.g. tenant admin viewing a platform super admin). */
  readOnly?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m17 17 4 4" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-muted" aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RoleBadgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="14" y="3" width="7" height="9" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 7h3M16 10h2" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12V7H5a2 2 0 010-4h14v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 5v14a2 2 0 002 2h16v-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12a2 2 0 100 4h4v-4h-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-950 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${checked ? "bg-[var(--primary)]" : "bg-[color-mix(in_srgb,var(--surface-container-high)_95%,var(--outline-variant))]"}`}
    >
      <span
        className={`inline-block h-[20px] w-[20px] rounded-md bg-white shadow-sm transition-transform duration-200 dark:bg-neutral-100 ${
          checked ? "translate-x-[23px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

// ─── Role options ─────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Administrator" },
  { value: "SLT", label: "Senior Leader" },
  { value: "HOD", label: "Head of Dept" },
  { value: "LEADER", label: "Leader" },
  { value: "TEACHER", label: "Teacher" },
  { value: "HR", label: "HR Officer" },
  { value: "ON_CALL", label: "On-Call Staff" },
];

// ─── Teacher search dropdown ──────────────────────────────────────────────────

function TeacherSearch({
  allTeachers,
  selectedIds,
  onAdd,
  placeholder,
  disabled = false,
}: {
  allTeachers: TeacherOption[];
  selectedIds: Set<string>;
  onAdd: (id: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTeachers.filter(
      (t) => !selectedIds.has(t.id) && (q === "" || t.fullName.toLowerCase().includes(q))
    );
  }, [query, allTeachers, selectedIds]);

  return (
    <div ref={ref} className="relative">
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        type="text"
        className="field w-full rounded-xl border-border/40 bg-background py-2.5 pl-10 pr-3 text-[0.8125rem] shadow-none placeholder:text-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim() !== "" && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-[180px] overflow-y-auto rounded-xl border border-border/35 bg-background py-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-[0.8125rem] text-muted">No teachers found</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                className="flex w-full items-center px-4 py-2.5 text-left text-[0.8125rem] text-text calm-transition hover:bg-surface-container-low"
                onClick={() => {
                  onAdd(t.id);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {t.fullName}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const SECTION_LABEL = "mb-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted";

function ScopedRow({
  icon,
  label,
  toggle,
}: {
  icon: ReactNode;
  label: string;
  toggle: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/20 py-3.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted">
          {icon}
        </span>
        <span className="text-[0.8125rem] font-medium text-text">{label}</span>
      </div>
      {toggle}
    </li>
  );
}

function SelectedChips({
  ids,
  teacherById,
  readOnly,
  onRemove,
}: {
  ids: Set<string>;
  teacherById: Map<string, TeacherOption>;
  readOnly: boolean;
  onRemove: (id: string) => void;
}) {
  if (ids.size === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from(ids).map((tid) => {
        const teacher = teacherById.get(tid);
        if (!teacher) return null;
        return (
          <span
            key={tid}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/35 bg-surface-container-low px-2.5 py-1 text-[11px] font-medium text-text"
          >
            {teacher.fullName}
            <button
              type="button"
              className="text-muted hover:text-text disabled:pointer-events-none disabled:opacity-40"
              aria-label={`Remove ${teacher.fullName}`}
              disabled={readOnly}
              onClick={() => onRemove(tid)}
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function EditUserModal({
  user,
  allTeachers,
  scopedLoaTargetIds,
  onClose,
  saveAction,
  readOnly = false,
}: EditUserModalProps) {
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  const [role, setRole] = useState(user.role);
  const [onCallRequests, setOnCallRequests] = useState(user.receivesOnCallEmails);
  const [leaveOfAbsence, setLeaveOfAbsence] = useState(user.canApproveAllLoa || scopedLoaTargetIds.length > 0);
  const [budgetaryApproval, setBudgetaryApproval] = useState(false);
  const [teacherObservations, setTeacherObservations] = useState(false);

  const [obsAllTeachers, setObsAllTeachers] = useState(false);
  const [obsTeacherIds, setObsTeacherIds] = useState<Set<string>>(new Set());

  const [loaAllTeachers, setLoaAllTeachers] = useState(user.canApproveAllLoa);
  const [loaTeacherIds, setLoaTeacherIds] = useState<Set<string>>(new Set(scopedLoaTargetIds));

  const teacherById = useMemo(() => {
    const map = new Map<string, TeacherOption>();
    for (const t of allTeachers) map.set(t.id, t);
    return map;
  }, [allTeachers]);

  const roleSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => roleSelectRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(t);
  }, []);

  function handleSave() {
    if (readOnly) return;
    const fd = new FormData();
    fd.set("userId", user.id);
    fd.set("role", role);
    fd.set("receivesOnCallEmails", String(onCallRequests));
    fd.set("canApproveAllLoa", String(leaveOfAbsence && loaAllTeachers));
    fd.set("scopedLoaTargetIds", leaveOfAbsence && !loaAllTeachers ? Array.from(loaTeacherIds).join(",") : "");

    startTransition(() => {
      saveAction(fd);
      onClose();
    });
  }

  const roleLabel = ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-border/35 bg-background shadow-xl"
        role="dialog"
        aria-labelledby="edit-user-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-6">
          <div className="flex min-w-0 flex-1 gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[rgba(124,105,239,0.35)] text-lg font-bold text-white shadow-sm ring-1 ring-[rgba(124,105,239,0.2)]"
              aria-hidden
            >
              {initialsFromName(user.fullName)}
            </span>
            <div className="min-w-0 pt-0.5">
              <h2 id="edit-user-title" className="truncate text-lg font-bold tracking-tight text-text">
                {user.fullName}
              </h2>
              <p className="mt-0.5 truncate text-[0.8125rem] text-muted">{user.email}</p>
              {readOnly ? (
                <p className="mt-2 text-[0.8125rem] leading-snug text-muted">
                  Platform super admins can only be edited by another platform super admin.
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="calm-transition shrink-0 rounded-lg p-2 text-muted hover:bg-surface-container-low hover:text-text"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {/* Institutional role */}
          <div>
            <label htmlFor="edit-user-role" className={SECTION_LABEL}>
              Institutional role
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-muted">
                <RoleBadgeIcon className="h-5 w-5" />
              </span>
              <select
                ref={roleSelectRef}
                id="edit-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={readOnly}
                className="field w-full appearance-none rounded-xl border-border/40 bg-background py-2.5 pl-11 pr-10 text-[0.8125rem] font-medium text-text disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Institutional role, ${roleLabel}`}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <ChevronDownIcon />
              </span>
            </div>
          </div>

          {/* Scoped approvals */}
          <div className="mt-8">
            <h3 className={SECTION_LABEL}>Scoped approvals</h3>
            <ul className="rounded-xl border border-border/25 px-3">
              <ScopedRow
                icon={<PhoneIcon className="h-[18px] w-[18px]" />}
                label="On-call requests"
                toggle={<Toggle checked={onCallRequests} onChange={setOnCallRequests} disabled={readOnly} />}
              />
              <ScopedRow
                icon={<CalendarIcon className="h-[18px] w-[18px]" />}
                label="Leave of absence"
                toggle={<Toggle checked={leaveOfAbsence} onChange={setLeaveOfAbsence} disabled={readOnly} />}
              />
              <ScopedRow
                icon={<WalletIcon className="h-[18px] w-[18px]" />}
                label="Budgetary approval"
                toggle={<Toggle checked={budgetaryApproval} onChange={setBudgetaryApproval} disabled={readOnly} />}
              />
              <ScopedRow
                icon={<PersonIcon className="h-[18px] w-[18px]" />}
                label="Teacher observations"
                toggle={<Toggle checked={teacherObservations} onChange={setTeacherObservations} disabled={readOnly} />}
              />
            </ul>
          </div>

          {/* Teacher observation scoping */}
          <div className="mt-8 space-y-3">
            <h3 className={SECTION_LABEL}>Teacher observation scoping</h3>
            <div className="flex items-center justify-between">
              <span className="text-[0.8125rem] font-medium text-text">All teachers</span>
              <Toggle checked={obsAllTeachers} onChange={setObsAllTeachers} disabled={readOnly} />
            </div>
            {!obsAllTeachers ? (
              <>
                <TeacherSearch
                  allTeachers={allTeachers}
                  selectedIds={obsTeacherIds}
                  onAdd={(id) => setObsTeacherIds((prev) => new Set(prev).add(id))}
                  placeholder="Add teachers by name..."
                  disabled={readOnly}
                />
                <SelectedChips
                  ids={obsTeacherIds}
                  teacherById={teacherById}
                  readOnly={readOnly}
                  onRemove={(tid) =>
                    setObsTeacherIds((prev) => {
                      const next = new Set(prev);
                      next.delete(tid);
                      return next;
                    })
                  }
                />
              </>
            ) : null}
          </div>

          {/* Leave approval scoping */}
          <div className="mt-8 space-y-3 pb-4">
            <h3 className={SECTION_LABEL}>Leave approval scoping</h3>
            <div className="flex items-center justify-between">
              <span className="text-[0.8125rem] font-medium text-text">All teachers</span>
              <Toggle
                checked={loaAllTeachers}
                onChange={(v) => {
                  setLoaAllTeachers(v);
                  if (v) setLoaTeacherIds(new Set());
                }}
                disabled={readOnly}
              />
            </div>
            {!loaAllTeachers ? (
              <>
                <TeacherSearch
                  allTeachers={allTeachers}
                  selectedIds={loaTeacherIds}
                  onAdd={(id) => setLoaTeacherIds((prev) => new Set(prev).add(id))}
                  placeholder="Add teachers by name..."
                  disabled={readOnly}
                />
                <SelectedChips
                  ids={loaTeacherIds}
                  teacherById={teacherById}
                  readOnly={readOnly}
                  onRemove={(tid) =>
                    setLoaTeacherIds((prev) => {
                      const next = new Set(prev);
                      next.delete(tid);
                      return next;
                    })
                  }
                />
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/20 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg px-2 py-2 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text disabled:opacity-50"
          >
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-xl bg-neutral-950 px-6 py-2.5 text-[0.8125rem] font-semibold text-white shadow-sm calm-transition hover:bg-neutral-900 disabled:opacity-50 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
