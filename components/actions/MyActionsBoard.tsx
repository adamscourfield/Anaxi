"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";
import { dueBucket, formatDue, type DueBucket } from "@/modules/actions/dates";
import styles from "./actions.module.css";

export type MyAction = {
  id: string;
  description: string;
  status: "OPEN" | "BLOCKED" | "DONE";
  dueDate: string | null;
  blockReason: string | null;
  completedAt: string | null;
  meeting: { id: string; title: string } | null;
};

type View = "todo" | "done";

const GROUPS: { key: DueBucket; title: string }[] = [
  { key: "overdue", title: "Overdue" },
  { key: "today", title: "Due today" },
  { key: "week", title: "Next 7 days" },
  { key: "later", title: "Later" },
  { key: "none", title: "No due date" },
];

const UK_DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "Europe/London" };

async function send(url: string, init: RequestInit): Promise<{ ok: true; action: any } | { ok: false; message: string }> {
  try {
    const res = await fetch(url, { ...init, keepalive: true, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: res.status === 404 ? "That action no longer exists." : body?.error || "Couldn't save. Try again." };
    return { ok: true, action: body };
  } catch {
    return { ok: false, message: "You're offline. Try again when you're connected." };
  }
}

export function MyActionsBoard({
  initialActions,
  doneTotal,
}: {
  initialActions: MyAction[];
  doneTotal: number;
}) {
  const [actions, setActions] = useState(initialActions);
  const [view, setView] = useState<View>("todo");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [blocking, setBlocking] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Work out "today" in the browser after mount; the server render uses no clock-dependent text.
  useEffect(() => {
    setNow(new Date());
    const sync = () => setView(window.location.hash === "#done" ? "done" : "todo");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const chooseView = (next: View) => {
    setView(next);
    window.history.replaceState(null, "", next === "done" ? "#done" : window.location.pathname + window.location.search);
  };

  const todo = useMemo(() => actions.filter((a) => a.status !== "DONE"), [actions]);
  const done = useMemo(
    () =>
      actions
        .filter((a) => a.status === "DONE")
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [actions],
  );
  const extraDone = Math.max(0, doneTotal - initialActions.filter((a) => a.status === "DONE").length);

  const setBusyFor = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const patchLocal = (id: string, patch: Partial<MyAction>) =>
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const run = useCallback(
    async (action: MyAction, optimistic: Partial<MyAction>, request: () => ReturnType<typeof send>, success: string) => {
      if (busy.has(action.id)) return false;
      setBusyFor(action.id, true);
      const before = { ...action };
      patchLocal(action.id, optimistic);
      const result = await request();
      setBusyFor(action.id, false);
      if (!result.ok) {
        patchLocal(action.id, before);
        toast(result.message, "error");
        return false;
      }
      patchLocal(action.id, {
        status: result.action.status,
        blockReason: result.action.blockReason ?? null,
        completedAt: result.action.completedAt ?? null,
      });
      toast(success, "success");
      return true;
    },
    [busy],
  );

  const complete = (a: MyAction) =>
    run(
      a,
      { status: "DONE", completedAt: new Date().toISOString(), blockReason: null },
      () => send(`/api/actions/${a.id}/complete`, { method: "POST" }),
      "Marked as done",
    );

  const reopen = (a: MyAction) =>
    run(
      a,
      { status: "OPEN", completedAt: null, blockReason: null },
      () => send(`/api/actions/${a.id}`, { method: "PATCH", body: JSON.stringify({ status: "OPEN" }) }),
      a.status === "DONE" ? "Moved back to your list" : "Unblocked",
    );

  const block = async (a: MyAction, reason: string) => {
    const ok = await run(
      a,
      { status: "BLOCKED", blockReason: reason },
      () => send(`/api/actions/${a.id}/block`, { method: "POST", body: JSON.stringify({ reason }) }),
      "Marked as blocked",
    );
    if (ok) setBlocking(null);
  };

  const groups = useMemo(() => {
    if (!now) return [{ key: "none" as DueBucket, title: "", items: todo }];
    return GROUPS.map((g) => ({ ...g, items: todo.filter((a) => dueBucket(a.dueDate, now) === g.key) })).filter(
      (g) => g.items.length,
    );
  }, [todo, now]);

  const renderRow = (a: MyAction) => {
    const isBusy = busy.has(a.id);
    const bucket = now ? dueBucket(a.dueDate, now) : "none";
    return (
      <li key={a.id} className={styles.row} data-status={a.status} data-leaving={isBusy ? "" : undefined}>
        <button
          type="button"
          className={styles.tick}
          data-done={a.status === "DONE" ? "" : undefined}
          disabled={isBusy}
          aria-label={a.status === "DONE" ? `Move “${a.description}” back to your list` : `Mark “${a.description}” as done`}
          onClick={() => (a.status === "DONE" ? reopen(a) : complete(a))}
        >
          <svg viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className={styles.text}>{a.description}</p>
          <div className={styles.meta}>
            {a.status === "DONE" ? (
              a.completedAt ? <span>Done {new Date(a.completedAt).toLocaleDateString("en-GB", UK_DAY)}</span> : <span>Done</span>
            ) : a.dueDate && now ? (
              <span className={bucket === "overdue" ? styles.overdue : bucket === "today" ? styles.soon : undefined}>
                {formatDue(a.dueDate, now)}
              </span>
            ) : null}
            {a.meeting ? (
              <span>
                From <Link href={`/meetings/${a.meeting.id}`}>{a.meeting.title}</Link>
              </span>
            ) : null}
            {a.status === "BLOCKED" ? (
              <span className={styles.blocked}>
                <b>Blocked</b>
                {a.blockReason ? <span>{a.blockReason}</span> : null}
              </span>
            ) : null}
            {a.status === "OPEN" && blocking !== a.id ? (
              <button type="button" className={styles.linkButton} onClick={() => setBlocking(a.id)} disabled={isBusy}>
                Mark as blocked
              </button>
            ) : null}
            {a.status === "BLOCKED" ? (
              <button type="button" className={styles.linkButton} onClick={() => reopen(a)} disabled={isBusy}>
                Unblock
              </button>
            ) : null}
          </div>
          {blocking === a.id ? <BlockForm busy={isBusy} onCancel={() => setBlocking(null)} onSave={(r) => block(a, r)} /> : null}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={styles.segmented} role="group" aria-label="Show">
          <button type="button" aria-pressed={view === "todo"} onClick={() => chooseView("todo")}>
            To do <span>{todo.length}</span>
          </button>
          <button type="button" aria-pressed={view === "done"} onClick={() => chooseView("done")}>
            Done <span>{done.length + extraDone}</span>
          </button>
        </div>
      </div>

      {view === "todo" ? (
        todo.length === 0 ? (
          <div className={styles.empty}>
            <p className="text-[15px] font-semibold">You&apos;re all caught up</p>
            <p className="mt-1 text-[13px] text-[#6e6e73]">Actions given to you in meetings will appear here.</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.key} aria-labelledby={g.title ? `group-${g.key}` : undefined}>
              {g.title ? (
                <h2 id={`group-${g.key}`} className={styles.groupTitle} data-tone={g.key === "overdue" ? "overdue" : undefined}>
                  {g.title} <span>{g.items.length}</span>
                </h2>
              ) : null}
              <ul className={styles.list}>{g.items.map(renderRow)}</ul>
            </section>
          ))
        )
      ) : done.length === 0 ? (
        <div className={styles.empty}>
          <p className="text-[15px] font-semibold">Nothing done yet</p>
          <p className="mt-1 text-[13px] text-[#6e6e73]">Tick an action off and it will move here.</p>
        </div>
      ) : (
        <section>
          <ul className={styles.list}>{done.map(renderRow)}</ul>
          {extraDone > 0 ? (
            <p className="mt-3 px-1 text-[12px] text-[#6e6e73]">
              Showing your latest {done.length}. Older actions are kept on their meetings.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}

function BlockForm({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <form
      className={styles.blockForm}
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onSave(reason.trim());
      }}
    >
      <input
        ref={ref}
        className={styles.input}
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        placeholder="What is it waiting on?"
        aria-label="What is it waiting on?"
      />
      <Button type="submit" className="h-9 min-h-0 px-4" disabled={busy || !reason.trim()}>
        Save
      </Button>
      <Button type="button" variant="ghost" className="h-9 min-h-0 px-3" onClick={onCancel}>
        Cancel
      </Button>
    </form>
  );
}
