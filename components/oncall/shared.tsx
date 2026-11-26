"use client";
import { formatYearGroup as formatYearGroupLabel } from "@/lib/yearGroup";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusPill, type PillVariant } from "@/components/ui/status-pill";
import { toast } from "@/components/toast-provider";

export type OnCallStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
export type OnCallType = "BEHAVIOUR" | "FIRST_AID";
export type OnCallAction = "acknowledge" | "resolve" | "cancel";

/* ── Labels ──────────────────────────────────────────────────────────── */

/** What each status means to the person looking at it. */
export const STATUS_DISPLAY: Record<OnCallStatus, { label: string; variant: PillVariant }> = {
  OPEN: { label: "Waiting", variant: "warning" },
  ACKNOWLEDGED: { label: "Acknowledged", variant: "info" },
  RESOLVED: { label: "Resolved", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
};

export const TYPE_LABEL: Record<OnCallType, string> = {
  BEHAVIOUR: "Behaviour",
  FIRST_AID: "First aid",
};

const ACTION_DONE: Record<OnCallAction, string> = {
  acknowledge: "Acknowledged. Everyone can see you're on it.",
  resolve: "Resolved.",
  cancel: "Request cancelled.",
};

export function StatusTag({ status, size = "sm" }: { status: OnCallStatus; size?: "sm" | "md" }) {
  const { label, variant } = STATUS_DISPLAY[status];
  return (
    <StatusPill variant={variant} size={size}>
      {label}
    </StatusPill>
  );
}

/** Request type in plain text with a small icon. Neither type is "worse", so neither is coloured. */
export function TypeTag({ type, emergency }: { type: OnCallType; emergency?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-[13px] text-[#3a3a3c]">
        {type === "FIRST_AID" ? (
          <svg className="h-3.5 w-3.5 text-[#6e6e73]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M12 8v8M8 12h8" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 text-[#6e6e73]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.2a6.5 6.5 0 0 1 3 5.8" strokeLinecap="round" />
          </svg>
        )}
        {TYPE_LABEL[type]}
      </span>
      {emergency ? <EmergencyTag /> : null}
    </span>
  );
}

export function EmergencyTag() {
  return (
    <StatusPill variant="error" size="sm" className="gap-1 font-semibold">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M12 9v4M12 17h.01M10.3 3.6h3.4l8.3 14.4H2l8.3-14.4z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Emergency
    </StatusPill>
  );
}

/* ── Time formatting (always UK time) ────────────────────────────────── */

const TZ = "Europe/London";

export function formatClock(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });
}

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-GB", { timeZone: TZ });
}

/** "09:41" today, "Yesterday 09:41", "22 Nov, 09:41" before that. */
export function formatWhen(d: Date | string, now = new Date()): string {
  const date = new Date(d);
  if (dayKey(date) === dayKey(now)) return formatClock(date);
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (dayKey(date) === dayKey(yesterday)) return `Yesterday ${formatClock(date)}`;
  const sameYear =
    date.toLocaleDateString("en-GB", { year: "numeric", timeZone: TZ }) ===
    now.toLocaleDateString("en-GB", { year: "numeric", timeZone: TZ });
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: TZ,
  });
  return `${day}, ${formatClock(date)}`;
}

/** "under a minute", "4 min", "1h 05m", "3 days". */
export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${String(mins % 60).padStart(2, "0")}m`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function since(d: Date | string, now = Date.now()): string {
  return formatDuration(now - new Date(d).getTime());
}

export function formatYearGroup(yearGroup: string | null | undefined): string {
  if (!yearGroup?.trim()) return "No year group";
  return formatYearGroupLabel(yearGroup);
}

/* ── Live updates ────────────────────────────────────────────────────── */

const LIVE_INTERVAL_MS = 15_000;

/**
 * Keeps an On Call page current: re-fetches server data every 15s while the
 * tab is visible (and straight away when you come back to it), and re-renders
 * every 30s so "waiting" times tick. Returns when the data last arrived.
 */
export function useLiveRefresh(paused = false): { updatedAt: number; now: number } {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || pausedRef.current) return;
      router.refresh();
      setUpdatedAt(Date.now());
    };
    const poll = window.setInterval(refresh, LIVE_INTERVAL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refresh();
        setNow(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return { updatedAt, now };
}

export function LiveIndicator({ updatedAt, now }: { updatedAt: number; now: number }) {
  const secs = Math.max(0, Math.round((now - updatedAt) / 1000));
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-[#6e6e73]" title="Updates automatically every 15 seconds">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34c759]" />
      </span>
      Live{secs >= 60 ? ` · updated ${Math.floor(secs / 60)} min ago` : ""}
    </span>
  );
}

/* ── Actions ─────────────────────────────────────────────────────────── */

/**
 * Acknowledge / resolve / cancel a request. Shows what happened either way
 * (including "Sam has already acknowledged this") and refreshes the page so
 * it reflects the latest state.
 */
export function useOnCallAction() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (requestId: string, action: OnCallAction) => {
      setPending(`${requestId}:${action}`);
      try {
        const res = await fetch(`/api/oncall/${requestId}/${action}`, { method: "POST" });
        if (res.ok) {
          toast(ACTION_DONE[action], "success");
        } else {
          let message = "That didn't work. Try again.";
          try {
            const data = await res.json();
            if (typeof data?.error === "string" && data.error !== "Internal server error") message = data.error;
          } catch {
            /* keep the default message */
          }
          toast(message, "error");
        }
        router.refresh();
        return res.ok;
      } catch {
        toast("Couldn't reach Anaxi. Check your connection and try again.", "error");
        return false;
      } finally {
        setPending(null);
      }
    },
    [router],
  );

  const isPending = (requestId: string, action?: OnCallAction) =>
    action ? pending === `${requestId}:${action}` : Boolean(pending?.startsWith(`${requestId}:`));

  return { run, isPending, anyPending: pending !== null };
}
