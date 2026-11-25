"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatusPill } from "@/components/ui/status-pill";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/toast-provider";
import { formatMeetingDay, formatMeetingSlot, formatMeetingTime, formatMinutes, minutesBetween } from "@/modules/meetings/format";
import { meetingState } from "./meetingStatus";
import styles from "./meeting.module.css";

interface Attendee {
  id: string;
  userId: string;
  user: { id: string; fullName: string; email: string };
}

interface Action {
  id: string;
  description: string;
  ownerUserId: string;
  owner: { id: string; fullName: string };
  dueDate?: Date | string | null;
  status: "OPEN" | "DONE" | "BLOCKED";
}

interface LiveMeetingViewProps {
  meetingId: string;
  title: string;
  /** Meeting type label, e.g. "Department". */
  type: string;
  status: string;
  startDateTime: string;
  endDateTime: string;
  startedAt: string | null;
  endedAt: string | null;
  location: string | null;
  organiser: string;
  attendees: Attendee[];
  initialNotes: string;
  actions: Action[];
  currentUserId: string;
  /** Edit the notes (organiser or meetings:edit). */
  canEdit: boolean;
  /** Start and end the meeting (organiser or meetings:edit). */
  canRun: boolean;
  canAddActions: boolean;
  /** Tick off actions you own. */
  canCompleteOwnActions: boolean;
  canDelete: boolean;
  backHref: string;
}

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

const UK = { timeZone: "Europe/London" } as const;

function dueLabel(action: Action): { text: string; overdue: boolean } | null {
  if (!action.dueDate) return null;
  const due = new Date(action.dueDate);
  const todayKey = new Date().toLocaleDateString("en-CA", UK);
  const dueKey = due.toLocaleDateString("en-CA", UK);
  const overdue = action.status !== "DONE" && dueKey < todayKey;
  const day = formatMeetingDay(due);
  return { text: overdue ? `Overdue · was due ${day}` : `Due ${day.toLowerCase() === "today" ? "today" : day}`, overdue };
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, [active]);
  return now;
}

export function LiveMeetingView({
  meetingId,
  title,
  type,
  status,
  startDateTime,
  endDateTime,
  startedAt,
  endedAt,
  location,
  organiser,
  attendees,
  initialNotes,
  actions: initialActions,
  currentUserId,
  canEdit,
  canRun,
  canAddActions,
  canCompleteOwnActions,
  canDelete,
  backHref,
}: LiveMeetingViewProps) {
  const router = useRouter();
  const isCancelled = status === "CANCELLED";
  const hasStarted = startedAt != null;
  const hasEnded = endedAt != null;
  const isLive = hasStarted && !hasEnded && !isCancelled;
  const now = useNow(isLive);
  const state = meetingState({ status, startedAt, endedAt, startDateTime });

  /* ── Notes: autosave, and never lose the last few keystrokes ─────────── */
  const [notes, setNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const pendingNotes = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  const saveNotes = useCallback(
    async (value: string, opts: { keepalive?: boolean } = {}) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      setSaveState("saving");
      try {
        const res = await fetch(`/api/meetings/${meetingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: value }),
          keepalive: opts.keepalive,
        });
        if (!res.ok) throw new Error();
        if (pendingNotes.current === value) pendingNotes.current = null;
        setSaveState(pendingNotes.current === null ? "saved" : "pending");
        setSavedAt(new Date());
        return true;
      } catch {
        setSaveState("error");
        return false;
      }
    },
    [meetingId],
  );

  const flushNotes = useCallback(
    async (opts: { keepalive?: boolean } = {}) => (pendingNotes.current !== null ? saveNotes(pendingNotes.current, opts) : true),
    [saveNotes],
  );

  function onNotesChange(value: string) {
    setNotes(value);
    pendingNotes.current = value;
    setSaveState("pending");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveNotes(value), 1000);
  }

  useEffect(() => {
    // Save on the way out, and warn if a save hasn't gone through yet.
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushNotes({ keepalive: true });
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingNotes.current !== null) {
        void flushNotes({ keepalive: true });
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flushNotes]);

  /* ── Start / end / delete ────────────────────────────────────────────── */
  const [busy, setBusy] = useState<null | "start" | "end" | "delete">(null);
  const [endOpen, setEndOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function patch(body: Record<string, unknown>, failure: string) {
    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(typeof data?.error === "string" ? data.error : failure);
    }
  }

  async function startMeeting() {
    setBusy("start");
    try {
      await patch({ startedAt: new Date().toISOString(), status: "CONFIRMED" }, "The meeting didn't start. Try again.");
      toast("Meeting started.", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function endMeeting() {
    setEndOpen(false);
    setBusy("end");
    try {
      if (!(await flushNotes())) throw new Error("Your latest notes didn't save, so the meeting is still open. Try again.");
      await patch({ endedAt: new Date().toISOString() }, "The meeting didn't end. Try again.");
      toast("Meeting ended. The minutes are ready to download.", "success");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function deleteMeeting() {
    setDeleteOpen(false);
    setBusy("delete");
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data?.error === "string" ? data.error : "The meeting wasn't deleted. Try again.");
      }
      pendingNotes.current = null;
      toast("Meeting deleted. Attendees have been told it's cancelled.", "success");
      router.push("/meetings");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(null);
    }
  }

  /* ── Actions ──────────────────────────────────────────────────────────── */
  const [actions, setActions] = useState<Action[]>(initialActions);
  const [desc, setDesc] = useState("");
  const [ownerId, setOwnerId] = useState(
    attendees.some((a) => a.userId === currentUserId) ? currentUserId : (attendees[0]?.userId ?? ""),
  );
  const [due, setDue] = useState("");
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  async function addAction(e: React.FormEvent) {
    e.preventDefault();
    if (!desc.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc.trim(), ownerUserId: ownerId, dueDate: due || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "The action wasn't added. Try again.");
      setActions((prev) => [
        ...prev,
        { id: data.id, description: data.description, ownerUserId: data.ownerUserId, owner: data.owner, dueDate: data.dueDate ?? null, status: data.status },
      ]);
      setDesc("");
      setDue("");
      toast(`Action added for ${data.owner?.fullName ?? "them"}.`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setAdding(false);
    }
  }

  async function completeAction(action: Action) {
    setCompleting(action.id);
    try {
      const res = await fetch(`/api/actions/${action.id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error();
      setActions((prev) => prev.map((a) => (a.id === action.id ? { ...a, status: "DONE" } : a)));
      toast("Action done.", "success");
    } catch {
      toast("That action wasn't updated. Try again.", "error");
    } finally {
      setCompleting(null);
    }
  }

  const openCount = actions.filter((a) => a.status !== "DONE").length;
  const runningFor = isLive ? formatMinutes(minutesBetween(startedAt!, new Date(now))) : null;
  const lasted = hasStarted && hasEnded ? formatMinutes(minutesBetween(startedAt!, endedAt!)) : null;

  const saveLabel =
    saveState === "pending" || saveState === "saving"
      ? "Saving…"
      : saveState === "saved" && savedAt
        ? `Saved at ${formatMeetingTime(savedAt)}`
        : saveState === "error"
          ? null
          : canEdit
            ? "Changes save automatically"
            : "Only the organiser can edit these notes";

  return (
    <div className={`${styles.page} space-y-8`}>
      <header className="space-y-4 border-b border-[#e5e5e6] pb-7">
        <Breadcrumb items={[{ label: "Meetings", href: backHref }, { label: title }]} />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.04em] text-[#1c1c1e]">
              {title}
              <span className="text-[#ff6a52]">.</span>
            </h1>
            <p className="mt-1 text-[15px] text-[#6e6e73]">
              {[type, formatMeetingSlot(startedAt ?? startDateTime, hasStarted ? endedAt : endDateTime), location].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-[#6e6e73]">
              <StatusPill variant={state.variant} size="md">
                {state.label}
              </StatusPill>
              {runningFor ? (
                <span className="tabular-nums">
                  Started {formatMeetingTime(startedAt!)} · running {runningFor}
                </span>
              ) : lasted ? (
                <span className="tabular-nums">
                  {formatMeetingTime(startedAt!)}–{formatMeetingTime(endedAt!)} · lasted {lasted}
                </span>
              ) : null}
              <span>Organised by {organiser}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasEnded ? (
              <Button asChild variant="secondary" className="h-10 min-h-0 gap-2 px-5">
                <a href={`/api/meetings/${meetingId}/download`} download>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Download minutes
                </a>
              </Button>
            ) : null}
            {canRun && !isCancelled && !hasStarted ? (
              <Button type="button" className="h-10 min-h-0 px-5" disabled={busy !== null} onClick={() => void startMeeting()}>
                {busy === "start" ? "Starting…" : "Start meeting"}
              </Button>
            ) : null}
            {canRun && isLive ? (
              <Button type="button" className="h-10 min-h-0 px-5" disabled={busy !== null} onClick={() => setEndOpen(true)}>
                {busy === "end" ? "Ending…" : "End meeting"}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* ── Notes ─────────────────────────────────────────────────── */}
        <section className={styles.card} aria-labelledby="meeting-notes-heading">
          <div className="flex items-baseline justify-between gap-3 px-6 pt-5">
            <h2 id="meeting-notes-heading" className="text-[15px] font-semibold">
              {hasStarted ? "Minutes" : "Agenda and notes"}
            </h2>
            <span className="text-[12px] text-[#6e6e73]" aria-live="polite">
              {saveState === "error" ? (
                <span className="text-[var(--pill-error-text)]">
                  Not saved.{" "}
                  <button type="button" className="font-medium underline underline-offset-2" onClick={() => void flushNotes()}>
                    Try again
                  </button>
                </span>
              ) : (
                saveLabel
              )}
            </span>
          </div>
          {canEdit ? (
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={() => void flushNotes()}
              aria-labelledby="meeting-notes-heading"
              className={styles.notes}
              placeholder={
                hasStarted
                  ? "Write the minutes as you go: decisions, discussion points, anything to follow up."
                  : "Set out the agenda so people know what to expect. You'll take minutes here once the meeting starts."
              }
            />
          ) : (
            <div className={`${styles.notes} whitespace-pre-wrap`}>
              {notes.trim() ? notes : <span className="text-[#a1a1aa]">No notes yet.</span>}
            </div>
          )}
        </section>

        <div className="space-y-6">
          {/* ── Actions ───────────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="meeting-actions-heading">
            <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
              <h2 id="meeting-actions-heading" className="text-[15px] font-semibold">
                Actions
              </h2>
              <span className="text-[12px] text-[#6e6e73]">
                {actions.length ? `${openCount} of ${actions.length} still to do` : "None yet"}
              </span>
            </div>
            {actions.length ? (
              <ul className="mt-2">
                {actions.map((a) => {
                  const dueInfo = dueLabel(a);
                  const mineToTick = canCompleteOwnActions && a.ownerUserId === currentUserId && a.status !== "DONE";
                  return (
                    <li key={a.id} className={styles.action} data-done={a.status === "DONE" || undefined}>
                      {mineToTick ? (
                        <button
                          type="button"
                          className={styles.tick}
                          disabled={completing === a.id}
                          onClick={() => void completeAction(a)}
                          aria-label={`Mark "${a.description}" as done`}
                          title="Mark as done"
                        />
                      ) : (
                        <span className={styles.tick} data-state={a.status === "DONE" ? "done" : "open"} aria-hidden>
                          {a.status === "DONE" ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : null}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-[14px] leading-snug">{a.description}</p>
                        <p className="mt-0.5 text-[12px] text-[#6e6e73]">
                          {a.owner.fullName}
                          {a.status === "DONE" ? " · Done" : a.status === "BLOCKED" ? " · Blocked" : ""}
                          {dueInfo && a.status !== "DONE" ? (
                            <span className={dueInfo.overdue ? "font-medium text-[var(--pill-error-text)]" : undefined}> · {dueInfo.text}</span>
                          ) : null}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 pb-1 pt-2 text-[13px] text-[#6e6e73]">Agree who&rsquo;s doing what, and it&rsquo;ll land in their My Actions.</p>
            )}
            {canAddActions && !isCancelled ? (
              addOpen ? (
                <form onSubmit={addAction} className="space-y-3 border-t border-[#f0f0f1] px-5 py-4">
                  <label className="block">
                    <span className={styles.label}>What needs doing</span>
                    <input
                      autoFocus
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      className={styles.input}
                      placeholder="e.g. Share the revised Year 11 mock timetable"
                      required
                    />
                  </label>
                  <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
                    <label className="block min-w-0">
                      <span className={styles.label}>Who</span>
                      <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={styles.input}>
                        {attendees.map((a) => (
                          <option key={a.userId} value={a.userId}>
                            {a.userId === currentUserId ? `${a.user.fullName} (you)` : a.user.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={styles.label}>By (optional)</span>
                      <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={styles.input} />
                    </label>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" className="h-9 min-h-0 px-3 text-[13px]" onClick={() => setAddOpen(false)}>
                      Done
                    </Button>
                    <Button type="submit" variant="secondary" className="h-9 min-h-0 px-4 text-[13px]" disabled={adding || !desc.trim()}>
                      {adding ? "Adding…" : "Add action"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="border-t border-[#f0f0f1] px-5 py-3">
                  <button type="button" className="text-[13px] font-medium text-[#1c1c1e] underline-offset-4 hover:underline" onClick={() => setAddOpen(true)}>
                    + Add an action
                  </button>
                </div>
              )
            ) : (
              <div className="h-3" />
            )}
          </section>

          {/* ── People ────────────────────────────────────────────── */}
          <section className={styles.card} aria-labelledby="meeting-people-heading">
            <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
              <h2 id="meeting-people-heading" className="text-[15px] font-semibold">
                People
              </h2>
              <span className="text-[12px] text-[#6e6e73]">{attendees.length} invited</span>
            </div>
            <ul className="px-5 pb-4 pt-2 text-[14px]">
              {attendees.map((a) => (
                <li key={a.userId} className="py-1.5">
                  {a.user.fullName}
                  {a.user.fullName === organiser ? <span className="text-[12px] text-[#6e6e73]"> · organiser</span> : null}
                </li>
              ))}
            </ul>
          </section>

          {canDelete ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setDeleteOpen(true)}
              className="text-[13px] font-medium text-[var(--pill-error-text)] underline-offset-4 hover:underline disabled:opacity-40"
            >
              {busy === "delete" ? "Deleting…" : "Delete this meeting"}
            </button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={endOpen}
        title="End the meeting?"
        confirmLabel="End meeting"
        cancelLabel="Keep going"
        onClose={() => setEndOpen(false)}
        onConfirm={() => void endMeeting()}
      >
        The minutes and actions are saved and ready to download. You can still tidy up the notes afterwards.
      </ConfirmDialog>
      <DestructiveConfirmDialog
        open={deleteOpen}
        title="Delete this meeting?"
        confirmLabel="Delete meeting"
        cancelLabel="Keep it"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteMeeting()}
      >
        Its notes and actions are removed for everyone, and attendees get a cancellation email. This can&rsquo;t be undone.
      </DestructiveConfirmDialog>
    </div>
  );
}
