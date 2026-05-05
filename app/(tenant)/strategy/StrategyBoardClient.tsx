"use client";

import { useState, useTransition, useEffect, useId, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createStrategyArea,
  updateStrategyArea,
  toggleStrategyAreaComplete,
  deleteStrategyArea,
  createStrategyNote,
  deleteStrategyNote,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Priority = "critical" | "high" | "medium" | "low";

interface StrategyNote {
  id: string;
  text: string;
  createdAt: Date | string;
}

interface StrategyArea {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  priority: Priority;
  owner: string | null;
  completed: boolean;
  createdAt: Date | string;
  notes: StrategyNote[];
}

interface Props {
  areas: StrategyArea[];
  canManage: boolean;
  staffList: { id: string; fullName: string }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CHIP: Record<Priority, string> = {
  critical: "bg-[var(--pill-error-bg)] text-[var(--pill-error-text)] ring-1 ring-[var(--pill-error-ring)]/60",
  high:     "bg-[var(--pill-error-bg)] text-[var(--pill-error-text)] ring-1 ring-[var(--pill-error-ring)]/60",
  medium:   "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-text)] ring-1 ring-[var(--pill-warning-ring)]/50",
  low:      "bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-text)] ring-1 ring-[var(--pill-neutral-ring)]/40",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical Priority",
  high:     "High Priority",
  medium:   "Medium Priority",
  low:      "Low Priority",
};

// ─── Staff search input ───────────────────────────────────────────────────────

function StaffSearchInput({
  staffList,
  defaultValue,
}: {
  staffList: { id: string; fullName: string }[];
  defaultValue: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const filtered = query.trim()
    ? staffList.filter((s) =>
        s.fullName.toLowerCase().includes(query.trim().toLowerCase())
      ).slice(0, 8)
    : staffList.slice(0, 8);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) {
      setMenuPos(null);
      return;
    }
    const el = wrapRef.current;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
    function sync() {
      if (!wrapRef.current) return;
      const b = wrapRef.current.getBoundingClientRect();
      setMenuPos({ top: b.bottom + 4, left: b.left, width: b.width });
    }
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [open, query]);

  const menu =
    open &&
    filtered.length > 0 &&
    menuPos &&
    typeof document !== "undefined" ? (
      createPortal(
        <ul
          className="fixed z-[200] max-h-[200px] overflow-y-auto rounded-xl border border-border/70 bg-surface-container-lowest shadow-lg"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
          }}
        >
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="calm-transition w-full cursor-pointer px-3 py-2.5 text-left text-sm text-text hover:bg-divider/50"
                onMouseDown={() => {
                  setQuery(s.fullName);
                  setOpen(false);
                }}
              >
                {s.fullName}
              </button>
            </li>
          ))}
        </ul>,
        document.body,
      )
    ) : null;

  return (
    <div className="relative" ref={wrapRef}>
      <input type="hidden" name="owner" value={query} />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search staff member..."
        maxLength={40}
        className="field"
        autoComplete="off"
      />
      {menu}
    </div>
  );
}

// ─── Area modal ───────────────────────────────────────────────────────────────

function AreaModal({
  area,
  onClose,
  staffList,
}: {
  area: StrategyArea | null;
  onClose: () => void;
  staffList: { id: string; fullName: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    previouslyFocused.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>("input, textarea, select, button");
      first?.focus();
    }, 0);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      const prev = previouslyFocused.current;
      if (prev instanceof HTMLElement) requestAnimationFrame(() => prev.focus());
    };
  }, [mounted]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      if (area) {
        await updateStrategyArea(area.id, fd);
      } else {
        await createStrategyArea(fd);
      }
      onClose();
    });
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain"
      role="presentation"
    >
      <button
        type="button"
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] calm-transition dark:bg-black/60"
        aria-label="Dismiss dialog"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="relative mx-auto flex min-h-full w-full justify-center px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pb-12 sm:pt-10">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/40 bg-surface-container-lowest shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-200 max-h-[min(90vh,calc(100dvh-2.5rem))] my-auto"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/25 px-6 pb-4 pt-5 sm:px-7 sm:pb-4 sm:pt-6">
            <h2 id={titleId} className="pr-2 text-[1.125rem] font-bold leading-snug tracking-tight text-text sm:text-xl">
              {area ? "Edit Strategy" : "Propose New Strategy"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="calm-transition -mr-1 -mt-0.5 shrink-0 rounded-lg p-2 text-muted hover:bg-surface-container-low hover:text-text"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 sm:px-7">
              {/* Strategic Area Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                  Strategic Area Name
                </label>
                <input
                  name="title"
                  required
                  defaultValue={area?.title ?? ""}
                  placeholder="e.g., KS3 Literacy Intervention"
                  maxLength={80}
                  className="field"
                />
              </div>

              {/* Target Metric + Priority Level */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                    Target Metric
                  </label>
                  <input
                    name="category"
                    defaultValue={area?.category ?? ""}
                    placeholder="e.g., 97.5% or Gold Standard"
                    maxLength={30}
                    className="field"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                    Priority Level
                  </label>
                  <select name="priority" defaultValue={area?.priority ?? "high"} className="field">
                    <option value="critical">Critical Priority</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              {/* Lead Person */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                  Lead Person
                </label>
                <StaffSearchInput staffList={staffList} defaultValue={area?.owner ?? ""} />
              </div>

              {/* Strategic Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-muted">
                  Strategic Description
                </label>
                <textarea
                  name="description"
                  defaultValue={area?.description ?? ""}
                  placeholder="Outline the primary objectives and key performance indicators..."
                  rows={4}
                  className="field min-h-[100px] resize-y"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border/25 bg-surface-container-lowest px-6 py-4 sm:px-7">
              <button
                type="button"
                onClick={onClose}
                className="calm-transition rounded-lg px-5 py-2.5 text-[0.8125rem] font-semibold uppercase tracking-[0.04em] text-muted hover:text-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="calm-transition rounded-xl bg-neutral-950 px-6 py-2.5 text-[0.8125rem] font-semibold uppercase tracking-[0.04em] text-white shadow-sm hover:bg-neutral-900 disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
              >
                {pending ? "Saving…" : area ? "Save Changes" : "Submit Proposal"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Three-dot menu ───────────────────────────────────────────────────────────

function ActionMenu({
  area,
  canManage,
  onEdit,
}: {
  area: StrategyArea;
  canManage: boolean;
  onEdit: (area: StrategyArea) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (!canManage) return null;

  function handleToggleComplete() {
    setOpen(false);
    startTransition(() => toggleStrategyAreaComplete(area.id));
  }

  function handleDelete() {
    setOpen(false);
    setConfirmDeleteOpen(true);
  }

  function confirmDelete() {
    startTransition(() => deleteStrategyArea(area.id));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={pending}
        className="calm-transition flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-container-low hover:text-text disabled:opacity-40"
        title="Options"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-border/70 bg-surface-container-lowest shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            type="button"
            className="calm-transition flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-container-low"
            onMouseDown={() => { onEdit(area); setOpen(false); }}
          >
            <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit strategy
          </button>
          <button
            type="button"
            className="calm-transition flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-text hover:bg-surface-container-low"
            onMouseDown={handleToggleComplete}
          >
            <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            {area.completed ? "Mark active" : "Mark complete"}
          </button>
          <div className="my-1 border-t border-border/40" />
          <button
            type="button"
            className="calm-transition flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-error hover:bg-surface-container-low"
            onMouseDown={handleDelete}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
      <DestructiveConfirmDialog
        open={confirmDeleteOpen}
        title="Remove strategy area?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
      >
        This removes &ldquo;{area.title}&rdquo; and its notes from the board. This cannot be undone.
      </DestructiveConfirmDialog>
    </div>
  );
}

// ─── Action item row ──────────────────────────────────────────────────────────

function ActionItem({ note, canManage }: { note: StrategyNote; canManage: boolean }) {
  const [pending, startTransition] = useTransition();

  // Support "Action text | Assignee" format in note text
  const parts = note.text.split(" | ");
  const actionText = parts[0]?.trim() ?? note.text;
  const assignee = parts[1]?.trim() ?? null;

  function handleDelete() {
    startTransition(() => deleteStrategyNote(note.id));
  }

  return (
    <div className="group flex items-center justify-between gap-2 py-1.5">
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-text">{actionText}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        {assignee && (
          <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[0.6875rem] font-medium text-muted">
            {assignee}
          </span>
        )}
        {canManage && (
          <button
            onClick={handleDelete}
            disabled={pending}
            className="calm-transition opacity-0 group-hover:opacity-100 text-muted hover:text-error disabled:opacity-40"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Add action inline ────────────────────────────────────────────────────────

function AddActionInline({
  areaId,
  onClose,
}: {
  areaId: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const t = text.trim();
    if (!t) return;
    startTransition(async () => {
      await createStrategyNote(areaId, t);
      setText("");
      onClose();
    });
  }

  return (
    <div className="mt-1 flex gap-1.5">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='e.g. "Home Visit Protocol | M. Davies"'
        autoFocus
        className="field flex-1 text-[0.8rem]"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onClose();
        }}
      />
      <button
        onClick={handleSave}
        disabled={!text.trim() || pending}
        className="calm-transition rounded-lg bg-accent px-3 py-1.5 text-[0.75rem] font-semibold text-on-primary hover:bg-accentHover disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}

// ─── Strategy tile ────────────────────────────────────────────────────────────

function StrategyTile({
  area,
  canManage,
  onEdit,
}: {
  area: StrategyArea;
  canManage: boolean;
  onEdit: (area: StrategyArea) => void;
}) {
  const [showAddAction, setShowAddAction] = useState(false);

  return (
    <div
      className={`flex flex-col rounded-2xl border border-border/30 bg-surface-container-lowest p-5 shadow-ambient calm-transition motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg ${
        area.completed ? "opacity-50" : ""
      }`}
    >
      {/* Top row: priority badge + menu */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${PRIORITY_CHIP[area.priority]}`}
        >
          {PRIORITY_LABEL[area.priority]}
        </span>
        <ActionMenu area={area} canManage={canManage} onEdit={onEdit} />
      </div>

      {/* Title */}
      <h3 className={`mb-2 text-[0.9375rem] font-bold leading-snug tracking-tight text-text ${area.completed ? "line-through text-muted" : ""}`}>
        {area.title}
      </h3>

      {/* Target metric */}
      {area.category && (
        <div className="mb-2 flex items-center gap-1.5 text-[0.8125rem] text-muted">
          <svg className="h-3.5 w-3.5 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
          </svg>
          <span>
            <span className="font-medium text-muted">Target:</span>{" "}
            <span className="font-semibold text-text">{area.category}</span>
          </span>
        </div>
      )}

      {/* Description */}
      {area.description && (
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-muted">{area.description}</p>
      )}

      {/* Active Actions */}
      <div className="mt-auto">
        <div className="border-t border-divider pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-muted">
              Active Actions{area.notes.length > 0 ? ` · ${area.notes.length}` : ""}
            </span>
            {canManage && !showAddAction && (
              <button
                onClick={() => setShowAddAction(true)}
                className="calm-transition text-[0.6875rem] font-medium text-accent hover:text-accentHover"
              >
                + Add
              </button>
            )}
          </div>

          {showAddAction && (
            <AddActionInline areaId={area.id} onClose={() => setShowAddAction(false)} />
          )}

          {area.notes.length === 0 && !showAddAction ? (
            <p className="text-[0.75rem] text-muted/60 italic">No active actions</p>
          ) : (
            <div className="divide-y divide-divider">
              {area.notes.map((note) => (
                <ActionItem key={note.id} note={note} canManage={canManage} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Propose placeholder tile ─────────────────────────────────────────────────

function ProposeTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/50 bg-transparent text-muted calm-transition hover:border-accent/40 hover:text-accent"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-current calm-transition group-hover:scale-105">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <span className="text-[0.8125rem] font-semibold">Propose New Strategy</span>
    </button>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function StrategyBoardClient({ areas, canManage, staffList }: Props) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingArea, setEditingArea] = useState<StrategyArea | null | undefined>(undefined);

  const visible = areas.filter((a) => showCompleted || !a.completed);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-[0.75rem] font-medium text-muted calm-transition hover:border-outline-variant hover:text-text">
          <input
            type="checkbox"
            className="sr-only"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          <span
            className={`relative inline-block h-4 w-[30px] rounded-full transition-colors duration-200 ${
              showCompleted ? "bg-accent" : "bg-surface-container-high"
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-surface-container-lowest shadow transition-transform duration-200 ${
                showCompleted ? "translate-x-[14px]" : "translate-x-0.5"
              }`}
            />
          </span>
          Show completed
        </label>
      </div>

      {/* Grid */}
      {visible.length === 0 && !canManage ? (
        <div className="panel p-8">
          <EmptyState
            title={areas.length === 0 ? "No strategies proposed yet" : "All strategies complete"}
            description={
              areas.length === 0
                ? "No strategies have been proposed yet."
                : "Toggle Show completed to review them."
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((area) => (
            <StrategyTile
              key={area.id}
              area={area}
              canManage={canManage}
              onEdit={setEditingArea}
            />
          ))}
          {canManage && (
            <ProposeTile onClick={() => setEditingArea(null)} />
          )}
        </div>
      )}

      {/* Modal */}
      {editingArea !== undefined && (
        <AreaModal
          area={editingArea}
          onClose={() => setEditingArea(undefined)}
          staffList={staffList}
        />
      )}
    </>
  );
}
