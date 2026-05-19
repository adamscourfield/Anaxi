"use client";

import { useState } from "react";
import Link from "next/link";
import { isActionOverdue } from "@/modules/actions/service";

interface ActionCardProps {
  action: {
    id: string;
    description: string;
    blockReason?: string | null;
    ownerUserId: string;
    owner: { id: string; fullName: string };
    dueDate?: Date | string | null;
    status: "OPEN" | "DONE" | "BLOCKED";
    meeting?: { id: string; title: string } | null;
  };
  currentUserId: string;
  onComplete?: (actionId: string) => void;
}

export function ActionCard({ action, currentUserId, onComplete }: ActionCardProps) {
  const [completing, setCompleting] = useState(false);
  const isOwner = action.ownerUserId === currentUserId;
  const isOpen = action.status === "OPEN";
  const isDone = action.status === "DONE";
  const isBlocked = action.status === "BLOCKED";
  const overdue = isOpen && action.dueDate ? isActionOverdue(new Date(action.dueDate)) : false;

  async function handleComplete() {
    setCompleting(true);
    try {
      const res = await fetch(`/api/actions/${action.id}/complete`, { method: "POST" });
      if (res.ok) onComplete?.(action.id);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div
      className={`group flex items-start gap-3.5 rounded-xl border bg-surface-container-lowest px-4 py-3.5 shadow-ambient calm-transition hover:shadow-lg ${
        overdue
          ? "border-error/40 bg-error/[0.03]"
          : isBlocked
          ? "border-scale-some-border/80"
          : "border-border"
      }`}
    >
      {/* Checkbox / status indicator */}
      {isOwner && isOpen ? (
        <button
          onClick={handleComplete}
          disabled={completing}
          title="Mark as done"
          className={`calm-transition mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-[1.5px] ${
            completing
              ? "border-accent/40 bg-accent/10"
              : overdue
              ? "border-error/50 hover:border-error hover:bg-error/10"
              : "border-border hover:border-scale-strong-bar hover:bg-scale-strong-bg"
          }`}
        >
          {completing ? (
            <svg className="h-2.5 w-2.5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 text-scale-strong-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
      ) : (
        <div
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-[1.5px] ${
            isDone
              ? "border-scale-strong-bar bg-scale-strong-bg"
              : isBlocked
              ? "border-amber-400 bg-scale-some-bg"
              : "border-border"
          }`}
        >
          {isDone && (
            <svg className="h-2.5 w-2.5 text-on-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {isBlocked && (
            <svg className="h-2.5 w-2.5 text-scale-some-bar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
            </svg>
          )}
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`text-[0.875rem] font-medium leading-snug ${isDone ? "text-muted line-through" : "text-text"}`}>
          {action.description}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.75rem] text-muted">
          <span>{action.owner.fullName}</span>
          {action.dueDate && <DueDateChip dueDate={action.dueDate} status={action.status} />}
          {action.meeting && (
            <>
              <span className="text-border">·</span>
              <Link
                href={`/meetings/${action.meeting.id}`}
                className="link-accent calm-transition text-[0.75rem] font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {action.meeting.title}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Blocked badge */}
      {isBlocked && (
        <span
          className="mt-0.5 max-w-[40%] flex-shrink-0 truncate rounded-md border border-scale-some-border bg-scale-some-bg px-2 py-0.5 text-[0.6875rem] font-semibold text-scale-some-text"
          title={action.blockReason ?? undefined}
        >
          {action.blockReason ? `Blocked: ${action.blockReason}` : "Blocked"}
        </span>
      )}
    </div>
  );
}

// ─── Inline due date chip ──────────────────────────────────────────────────────

function DueDateChip({ dueDate, status }: { dueDate: Date | string; status: string }) {
  const isDone = status === "DONE";
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  if (isDone) return <span className="text-muted">Due {formatted}</span>;

  if (days < 0)
    return (
      <span className="font-semibold text-error">
        Overdue · {Math.abs(days)}d
      </span>
    );

  if (days <= 3)
    return (
      <span className="font-semibold text-scale-some-text">
        Due {formatted} · {days}d left
      </span>
    );

  return <span>Due {formatted}</span>;
}
