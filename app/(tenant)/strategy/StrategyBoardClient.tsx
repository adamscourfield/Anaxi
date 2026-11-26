"use client";

import styles from "./page.module.css";
import { useState, useTransition, useEffect, useId, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/toast-provider";
import {
  createStrategyArea,
  updateStrategyArea,
  toggleStrategyAreaComplete,
  deleteStrategyArea,
  createStrategyNote,
  deleteStrategyNote,
  type StrategyActionResult,
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

const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Run a server action, and say so when it fails rather than leaving the page in an error state. */
async function attempt(run: () => Promise<StrategyActionResult>, success?: string): Promise<boolean> {
  try {
    const result = await run();
    if (!result.ok) {
      toast(result.error, "error");
      return false;
    }
    if (success) toast(success, "success");
    return true;
  } catch {
    toast("Couldn't save. Check your connection and try again.", "error");
    return false;
  }
}

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
          className="fixed z-[200] max-h-[200px] overflow-y-auto rounded-xl border border-border/70 bg-background shadow-lg"
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
      <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-muted" aria-hidden>
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="pointer-events-none absolute right-3.5 top-1/2 z-[1] -translate-y-1/2 text-muted" aria-hidden>
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search staff"
        maxLength={60}
        className={`${styles.input} pl-10 pr-9`}
        aria-label="Lead"
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
  const [descLen, setDescLen] = useState(() => (area?.description ?? "").length);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    previouslyFocused.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus(), 0);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
      const prev = previouslyFocused.current;
      if (prev instanceof HTMLElement) requestAnimationFrame(() => prev.focus());
    };
  }, [mounted]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const ok = await attempt(
        () => (area ? updateStrategyArea(area.id, fd) : createStrategyArea(fd)),
        area ? "Strategy saved" : "Strategy added",
      );
      if (ok) onClose();
    });
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain" role="presentation">
      <button
        type="button"
        className="fixed inset-0 bg-black/45 calm-transition"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => !pending && onClose()}
      />
      <div className="relative mx-auto flex min-h-full w-full justify-center px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-10">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`${styles.dialog} relative z-10 my-auto flex max-h-[min(90vh,calc(100dvh-2.5rem))] w-full max-w-lg flex-col overflow-hidden`}
          tabIndex={-1}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#efeff0] px-6 pb-4 pt-5">
            <div>
              <h2 id={titleId} className="text-[19px] font-semibold tracking-[-0.02em]">
                {area ? "Edit strategy" : "New strategy"}
              </h2>
              <p className="mt-1 text-[13px] text-[#6e6e73]">
                {area ? "Change the details. Actions stay as they are." : "A school priority, its target and who leads it."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="calm-transition -mr-1 rounded-lg p-2 text-[#6e6e73] hover:bg-[#f4f4f5] hover:text-[#1c1c1e]"
              aria-label="Close"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <label className="block">
                <span className={styles.label}>Name</span>
                <input
                  name="title"
                  required
                  defaultValue={area?.title ?? ""}
                  placeholder="e.g. KS3 reading fluency"
                  maxLength={80}
                  className={styles.input}
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={styles.label}>
                    Target <span className="font-normal text-[#6e6e73]">(optional)</span>
                  </span>
                  <input
                    name="category"
                    defaultValue={area?.category ?? ""}
                    placeholder="e.g. Attendance 95%"
                    maxLength={40}
                    className={styles.input}
                  />
                </label>
                <label className="block">
                  <span className={styles.label}>Priority</span>
                  <select name="priority" defaultValue={area?.priority ?? "medium"} className={styles.input}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>

              <div>
                <span className={styles.label}>
                  Lead <span className="font-normal text-[#6e6e73]">(optional)</span>
                </span>
                <StaffSearchInput staffList={staffList} defaultValue={area?.owner ?? ""} />
              </div>

              <label className="block">
                <span className={styles.label}>
                  What it involves <span className="font-normal text-[#6e6e73]">(optional)</span>
                </span>
                <textarea
                  name="description"
                  defaultValue={area?.description ?? ""}
                  placeholder="What you'll do, and how you'll know it's working."
                  rows={5}
                  maxLength={1000}
                  onChange={(e) => setDescLen(e.target.value.length)}
                  className={`${styles.input} ${styles.textarea}`}
                />
                <span className="mt-1 block text-right text-[11px] tabular-nums text-[#a1a1aa]">{descLen} / 1000</span>
              </label>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#efeff0] px-6 py-4">
              <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving…" : area ? "Save changes" : "Add strategy"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Options menu ─────────────────────────────────────────────────────────────

function ActionMenu({ area, onEdit }: { area: StrategyArea; onEdit: (area: StrategyArea) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "calm-transition flex w-full items-center px-4 py-2.5 text-left text-[14px] hover:bg-[#f4f4f5] focus-visible:bg-[#f4f4f5] focus-visible:outline-none";

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Options for ${area.title}`}
        className="calm-transition flex h-8 w-8 items-center justify-center rounded-lg text-[#6e6e73] hover:bg-[#f4f4f5] hover:text-[#1c1c1e] disabled:opacity-40"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-[10px] border border-[#e5e5e6] bg-white py-1 shadow-lg"
        >
          <button type="button" role="menuitem" className={item} onClick={() => { setOpen(false); onEdit(area); }}>
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              startTransition(async () => {
                await attempt(
                  () => toggleStrategyAreaComplete(area.id),
                  area.completed ? "Moved back to active" : "Marked as complete",
                );
              });
            }}
          >
            {area.completed ? "Move back to active" : "Mark as complete"}
          </button>
          <div className="my-1 border-t border-[#efeff0]" />
          <button
            type="button"
            role="menuitem"
            className={`${item} text-[#b42318]`}
            onClick={() => { setOpen(false); setConfirmDeleteOpen(true); }}
          >
            Delete
          </button>
        </div>
      )}
      <DestructiveConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this strategy?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => startTransition(async () => { await attempt(() => deleteStrategyArea(area.id), "Strategy deleted"); })}
      >
        This deletes &ldquo;{area.title}&rdquo; and its actions. It can&apos;t be undone. To keep a record, mark it as
        complete instead.
      </DestructiveConfirmDialog>
    </div>
  );
}

// ─── Action rows ──────────────────────────────────────────────────────────────

function ActionItem({ note, canManage }: { note: StrategyNote; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  // "Action | Who" puts the person in a tag.
  const [actionText, assignee] = (() => {
    const i = note.text.lastIndexOf(" | ");
    return i > 0 ? [note.text.slice(0, i).trim(), note.text.slice(i + 3).trim() || null] : [note.text, null];
  })();

  return (
    <li className={`${styles.action} group`} data-busy={pending ? "" : undefined}>
      <span className="min-w-0 flex-1 text-[13px] leading-snug">{actionText}</span>
      {assignee && <span className={styles.assignee}>{assignee}</span>}
      {canManage && (
        <button
          type="button"
          onClick={() => startTransition(async () => { await attempt(() => deleteStrategyNote(note.id), "Action removed"); })}
          disabled={pending}
          aria-label={`Remove action: ${actionText}`}
          className={styles.removeAction}
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </li>
  );
}

function AddActionInline({ areaId, onClose }: { areaId: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const t = text.trim();
    if (!t || pending) return;
    startTransition(async () => {
      if (await attempt(() => createStrategyNote(areaId, t))) {
        setText("");
        onClose();
      }
    });
  }

  return (
    <div className="mb-2">
      <div className="flex gap-1.5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Home visit protocol | M. Davies"
          aria-label="New action"
          maxLength={200}
          autoFocus
          className={`${styles.input} ${styles.inputSmall} flex-1`}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") onClose();
          }}
        />
        <Button type="button" className="h-9 min-h-0 px-3 text-[13px]" onClick={handleSave} disabled={!text.trim() || pending}>
          Add
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-[#a1a1aa]">Add “| name” to show who&apos;s doing it.</p>
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
    <article className={styles.tile} data-completed={area.completed ? "" : undefined} aria-label={area.title}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={styles.priority} data-priority={area.completed ? "done" : area.priority}>
          {area.completed ? "Complete" : `${PRIORITY_LABEL[area.priority]} priority`}
        </span>
        {canManage && <ActionMenu area={area} onEdit={onEdit} />}
      </div>

      <h3 className="text-[16px] font-semibold leading-snug tracking-[-0.015em]">{area.title}</h3>

      <dl className={styles.meta}>
        {area.category ? (
          <div>
            <dt>Target</dt>
            <dd>{area.category}</dd>
          </div>
        ) : null}
        <div>
          <dt>Lead</dt>
          <dd>{area.owner || <span className="font-normal text-[#a1a1aa]">Not set</span>}</dd>
        </div>
      </dl>

      {area.description && <p className="mt-3 text-[13px] leading-relaxed text-[#6e6e73]">{area.description}</p>}

      <div className="mt-auto pt-4">
        <div className="border-t border-[#efeff0] pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold">
              Actions{area.notes.length > 0 ? <span className="ml-1 font-normal text-[#6e6e73]">{area.notes.length}</span> : null}
            </span>
            {canManage && !area.completed && !showAddAction && (
              <button type="button" onClick={() => setShowAddAction(true)} className={styles.addAction}>
                Add action
              </button>
            )}
          </div>

          {showAddAction && <AddActionInline areaId={area.id} onClose={() => setShowAddAction(false)} />}

          {area.notes.length === 0 && !showAddAction ? (
            <p className="text-[12px] text-[#a1a1aa]">No actions yet.</p>
          ) : (
            <ul>
              {area.notes.map((note) => (
                <ActionItem key={note.id} note={note} canManage={canManage} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function StrategyBoardClient({ areas, canManage, staffList }: Props) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [editingArea, setEditingArea] = useState<StrategyArea | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = areas
    .filter((a) => showCompleted || !a.completed)
    .filter((a) => !priority || a.priority === priority)
    .filter((a) => {
      const hay = `${a.title} ${a.owner ?? ""} ${a.category ?? ""} ${a.description ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    // Active before complete, then most urgent first.
    .sort((a, b) => Number(a.completed) - Number(b.completed) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const active = areas.filter((a) => !a.completed).length;
  const done = areas.length - active;

  return (
    <>
      <div className={styles.boardHeading}>
        <div>
          <h2>School priorities</h2>
          <p>
            {active} active{done ? `, ${done} complete` : ""}
          </p>
        </div>
        {canManage && (
          <button type="button" className={styles.newButton} onClick={() => setEditingArea(null)}>
            New strategy
          </button>
        )}
      </div>

      {areas.length > 0 ? (
        <div className={styles.toolbar}>
          <label>
            Search
            <input
              type="search"
              placeholder="Name, lead, target"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            Priority
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">All priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          {done > 0 ? (
            <label className={styles.completedToggle}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
              />
              Show complete ({done})
            </label>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            title={
              areas.length === 0
                ? "No priorities yet"
                : active === 0 && !showCompleted && !search && !priority
                  ? "Everything here is complete"
                  : "No strategies match"
            }
            description={
              areas.length === 0
                ? canManage
                  ? "Add a strategy to bring its target, lead and actions together in one place."
                  : "Senior leaders add the school's priorities here."
                : active === 0 && !showCompleted && !search && !priority
                  ? "Tick “Show complete” to see them, or add a new strategy."
                  : "Clear the search or priority filter to see more."
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((area) => (
            <StrategyTile key={area.id} area={area} canManage={canManage} onEdit={setEditingArea} />
          ))}
        </div>
      )}

      {editingArea !== undefined && (
        <AreaModal
          key={editingArea === null ? "new-strategy" : editingArea.id}
          area={editingArea}
          onClose={() => setEditingArea(undefined)}
          staffList={staffList}
        />
      )}
    </>
  );
}
