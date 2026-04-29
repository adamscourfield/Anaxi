"use client";

import { useState, useMemo, useRef, useEffect, useTransition } from "react";

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

// ─── Inline icons ─────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-muted">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
      className={`relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full transition-colors duration-200 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${checked ? "bg-[var(--primary)]" : "bg-gray-200"}`}
    >
      <span
        className={`inline-block h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
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
        className="field w-full !rounded-xl !border-black/[0.06] !bg-[var(--surface-container-highest)] !py-2.5 pl-10 pr-3 text-[0.8125rem] shadow-none disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[180px] overflow-y-auto rounded-xl border border-black/[0.08] bg-[var(--surface-container-lowest)] py-1 shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-[0.8125rem] text-muted">No teachers found</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                className="flex w-full items-center px-4 py-2.5 text-left text-[0.8125rem] text-text calm-transition hover:bg-[var(--surface-container-low)]"
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

  // Local state
  const [role, setRole] = useState(user.role);
  const [onCallRequests, setOnCallRequests] = useState(user.receivesOnCallEmails);
  const [leaveOfAbsence, setLeaveOfAbsence] = useState(user.canApproveAllLoa || scopedLoaTargetIds.length > 0);
  // UI-only toggles (no backend fields yet — shown per design spec)
  const [budgetaryApproval, setBudgetaryApproval] = useState(false);
  const [teacherObservations, setTeacherObservations] = useState(false);

  // Teacher observation scoping (UI-only — no backend fields yet)
  const [obsAllTeachers, setObsAllTeachers] = useState(false);
  const [obsTeacherIds, setObsTeacherIds] = useState<Set<string>>(new Set());

  const [loaAllTeachers, setLoaAllTeachers] = useState(user.canApproveAllLoa);
  const [loaTeacherIds, setLoaTeacherIds] = useState<Set<string>>(new Set(scopedLoaTargetIds));

  // Pre-compute teacher lookup for O(1) access
  const teacherById = useMemo(() => {
    const map = new Map<string, TeacherOption>();
    for (const t of allTeachers) map.set(t.id, t);
    return map;
  }, [allTeachers]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface-container-lowest shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200"
        role="dialog"
        aria-labelledby="edit-user-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#eceef0] px-6 py-5">
          <div className="min-w-0">
            <h2 id="edit-user-title" className="text-[1.0625rem] font-semibold tracking-tight text-text">
              {user.fullName}
            </h2>
            <p className="mt-1 truncate text-[0.8125rem] text-muted">{user.email}</p>
            {readOnly ? (
              <p className="mt-2 text-[0.8125rem] leading-snug text-muted">
                Platform super admins can only be edited by another platform super admin.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="calm-transition shrink-0 rounded-xl p-2 text-muted hover:bg-[var(--surface-container-low)] hover:text-text"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-1.5">
            <label htmlFor="edit-user-role" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Institutional role
            </label>
            <div className="relative">
              <select
                id="edit-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={readOnly}
                className="field w-full appearance-none !rounded-xl !border-black/[0.06] !bg-[var(--surface-container-highest)] pr-10 text-[0.8125rem] disabled:cursor-not-allowed disabled:opacity-60"
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

          <div className="mt-8">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Scoped approvals</h3>
            <ul className="mt-3 divide-y divide-[#eceef0] border-y border-[#eceef0]">
              <li className="flex items-center justify-between py-3.5">
                <span className="text-[0.8125rem] text-text">On-call requests</span>
                <Toggle checked={onCallRequests} onChange={setOnCallRequests} disabled={readOnly} />
              </li>
              <li className="flex items-center justify-between py-3.5">
                <span className="text-[0.8125rem] text-text">Leave of absence</span>
                <Toggle checked={leaveOfAbsence} onChange={setLeaveOfAbsence} disabled={readOnly} />
              </li>
              <li className="flex items-center justify-between py-3.5">
                <span className="text-[0.8125rem] text-text">Budgetary approval</span>
                <Toggle checked={budgetaryApproval} onChange={setBudgetaryApproval} disabled={readOnly} />
              </li>
              <li className="flex items-center justify-between py-3.5">
                <span className="text-[0.8125rem] text-text">Teacher observations</span>
                <Toggle checked={teacherObservations} onChange={setTeacherObservations} disabled={readOnly} />
              </li>
            </ul>
          </div>

          <div className="mt-8 space-y-3">
            <h3 className="text-[0.8125rem] font-semibold text-text">Teacher observation scoping</h3>
            <div className="flex items-center justify-between">
              <span className="text-[0.8125rem] text-muted">All teachers</span>
              <Toggle checked={obsAllTeachers} onChange={setObsAllTeachers} disabled={readOnly} />
            </div>
            {!obsAllTeachers && (
              <TeacherSearch
                allTeachers={allTeachers}
                selectedIds={obsTeacherIds}
                onAdd={(id) => setObsTeacherIds((prev) => new Set(prev).add(id))}
                placeholder="Add teachers by name…"
                disabled={readOnly}
              />
            )}
          </div>

          <div className="mt-8 space-y-3">
            <h3 className="text-[0.8125rem] font-semibold text-text">Leave approval scoping</h3>
            <div className="flex items-center justify-between">
              <span className="text-[0.8125rem] text-muted">All teachers</span>
              <Toggle
                checked={loaAllTeachers}
                onChange={(v) => {
                  setLoaAllTeachers(v);
                  if (v) setLoaTeacherIds(new Set());
                }}
                disabled={readOnly}
              />
            </div>
            {!loaAllTeachers && (
              <>
                <TeacherSearch
                  allTeachers={allTeachers}
                  selectedIds={loaTeacherIds}
                  onAdd={(id) => setLoaTeacherIds((prev) => new Set(prev).add(id))}
                  placeholder="Add teachers by name…"
                  disabled={readOnly}
                />
                {loaTeacherIds.size > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Array.from(loaTeacherIds).map((tid) => {
                      const teacher = teacherById.get(tid);
                      if (!teacher) return null;
                      return (
                        <span
                          key={tid}
                          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-[var(--surface-container-low)] px-2.5 py-1 text-[11px] font-medium text-text"
                        >
                          {teacher.fullName}
                          <button
                            type="button"
                            className="text-muted hover:text-text disabled:pointer-events-none disabled:opacity-40"
                            aria-label={`Remove ${teacher.fullName}`}
                            disabled={readOnly}
                            onClick={() =>
                              setLoaTeacherIds((prev) => {
                                const next = new Set(prev);
                                next.delete(tid);
                                return next;
                              })
                            }
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#eceef0] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl px-4 py-2.5 text-[0.8125rem] font-medium text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text disabled:opacity-50"
          >
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-[0.8125rem] font-semibold text-on-primary shadow-ambient calm-transition hover:bg-primary-container disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
