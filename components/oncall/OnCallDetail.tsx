"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnCallStatusBadge } from "./OnCallStatusBadge";
import { MetaText } from "@/components/ui/typography";
import { REQUEST_TYPE_LABELS } from "@/modules/oncall/types";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/toast-provider";

const ACCENT_VIOLET = "#7C69EF";
const ACCENT_VIOLET_SOFT = "rgba(124, 105, 239, 0.14)";
const ACCENT_VIOLET_MUTED = "rgba(124, 105, 239, 0.1)";

export type OnCallTimelineEventSerialized = {
  id: string;
  type: "CREATED" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
  createdAt: Date | string;
  actor?: { id: string; fullName: string } | null;
};

interface OnCallDetailRequest {
  id: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
  requestType: "BEHAVIOUR" | "FIRST_AID";
  isEmergency?: boolean;
  student: { fullName: string; upn: string; yearGroup?: string | null };
  location: string;
  behaviourReasonCategory?: string | null;
  notes?: string | null;
  requester: { fullName: string };
  responder?: { fullName: string } | null;
  createdAt: Date | string;
  acknowledgedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  requesterUserId?: string;
  timelineEvents?: OnCallTimelineEventSerialized[];
}

interface OnCallDetailProps {
  request: OnCallDetailRequest;
  canAcknowledge?: boolean;
  canResolve?: boolean;
  canCancel?: boolean;
}

function fmt(d?: Date | string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

const TIMELINE_LABELS: Record<OnCallTimelineEventSerialized["type"], string> = {
  CREATED: "Created",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

function IconWell({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--on-surface-variant)]"
      style={{ backgroundColor: ACCENT_VIOLET_MUTED }}
    >
      {children}
    </span>
  );
}

function DetailLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex gap-3 py-3.5 sm:gap-4">
      <IconWell>{icon}</IconWell>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
        <div className="mt-0.5 text-[0.9375rem] font-medium leading-snug text-text">{value}</div>
      </div>
    </div>
  );
}

export function OnCallDetail({ request, canAcknowledge, canResolve, canCancel }: OnCallDetailProps) {
  const router = useRouter();
  const [actionPending, setActionPending] = useState<string | null>(null);

  const timelineEntries = useMemo(() => {
    const fromDb = request.timelineEvents;
    if (fromDb && fromDb.length > 0) {
      return [...fromDb].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    const fallback: OnCallTimelineEventSerialized[] = [
      { id: "fb-created", type: "CREATED", createdAt: request.createdAt, actor: null },
    ];
    if (request.acknowledgedAt) {
      fallback.push({
        id: "fb-ack",
        type: "ACKNOWLEDGED",
        createdAt: request.acknowledgedAt,
        actor: request.responder ?? null,
      });
    }
    if (request.resolvedAt) {
      fallback.push({
        id: "fb-res",
        type: "RESOLVED",
        createdAt: request.resolvedAt,
        actor: request.responder ?? null,
      });
    }
    return fallback;
  }, [request]);

  async function handleAction(action: "acknowledge" | "resolve" | "cancel") {
    setActionPending(action);
    try {
      const res = await fetch(`/api/oncall/${request.id}/${action}`, { method: "POST" });
      if (res.ok) {
        const msg =
          action === "acknowledge"
            ? "Request acknowledged"
            : action === "resolve"
              ? "Request resolved"
              : "Request cancelled";
        toast(msg, "success");
        router.refresh();
      } else {
        let message = "Something went wrong.";
        try {
          const data = await res.json();
          if (data?.error && typeof data.error === "string") message = data.error;
        } catch {
          /* ignore */
        }
        toast(message, "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setActionPending(null);
    }
  }

  const surfaceCard =
    "rounded-xl border border-border/30 bg-background shadow-[0_2px_16px_rgba(15,23,42,0.06)]";

  return (
    <div className="w-full min-w-0 space-y-6 pb-8 pt-1">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3 sm:gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14"
            style={{ backgroundColor: ACCENT_VIOLET_SOFT, color: ACCENT_VIOLET }}
          >
            <svg className="h-6 w-6 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-[1.65rem] font-bold leading-tight tracking-[-0.03em] text-text sm:text-[1.875rem]">
              On Call Request
            </h1>
            <p className="mt-1 text-[0.9375rem] text-muted">
              {request.student.fullName} · {REQUEST_TYPE_LABELS[request.requestType]}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OnCallStatusBadge status={request.status} />
              <StatusPill variant="neutral" size="sm">
                {REQUEST_TYPE_LABELS[request.requestType]}
              </StatusPill>
              {request.isEmergency ? (
                <StatusPill variant="error" size="sm">
                  Emergency
                </StatusPill>
              ) : null}
            </div>
          </div>
        </div>

        <Link
          href="/on-call"
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-border/40 bg-background px-4 py-2.5 text-[0.8125rem] font-semibold text-text shadow-sm calm-transition hover:bg-surface-container-low lg:self-auto"
        >
          <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 4h16v16H4z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m22 6-10 7L4 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to on call inbox
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start">
        <div className="space-y-6">
          <div className={`${surfaceCard} overflow-hidden px-4 py-1 sm:px-5`}>
            <h2 className="border-b border-border/20 px-1 py-4 text-base font-bold text-text">Request details</h2>
            <div className="divide-y divide-border/25 px-1">
              <DetailLine
                icon={
                  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                label="Student"
                value={`${request.student.fullName} (${request.student.upn})`}
              />
              <DetailLine
                icon={
                  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                  </svg>
                }
                label="Year group"
                value={request.student.yearGroup ?? "—"}
              />
              <DetailLine
                icon={
                  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                }
                label="Location"
                value={request.location}
              />
              {request.behaviourReasonCategory ? (
                <DetailLine
                  icon={
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                  label="Reason"
                  value={request.behaviourReasonCategory}
                />
              ) : null}
              {request.notes ? (
                <DetailLine
                  icon={
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  }
                  label="Notes"
                  value={request.notes}
                />
              ) : null}
              <DetailLine
                icon={
                  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V9a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v1M10 10.5V9a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M18 11c0 6-8 10-8 10S2 17 2 11a8 8 0 0 1 16 0Z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                label="Raised by"
                value={request.requester.fullName}
              />
              {request.responder ? (
                <DetailLine
                  icon={
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
                    </svg>
                  }
                  label="Responder"
                  value={request.responder.fullName}
                />
              ) : null}
            </div>
          </div>

          {(canAcknowledge && request.status === "OPEN") ||
          (canResolve && (request.status === "OPEN" || request.status === "ACKNOWLEDGED")) ||
          (canCancel && request.status === "OPEN") ? (
            <div className={`${surfaceCard} p-5 sm:p-6`}>
              <div className="flex flex-wrap gap-3">
                {canAcknowledge && request.status === "OPEN" ? (
                  <Button
                    type="button"
                    className="rounded-xl bg-neutral-950 px-5 py-2.5 text-[0.8125rem] font-semibold text-white hover:bg-neutral-900 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
                    disabled={!!actionPending}
                    onClick={() => handleAction("acknowledge")}
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {actionPending === "acknowledge" ? "Working…" : "Acknowledge"}
                  </Button>
                ) : null}
                {canResolve && (request.status === "OPEN" || request.status === "ACKNOWLEDGED") ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl border border-border/35 bg-[var(--surface-container-high)] px-5 py-2.5 text-[0.8125rem] font-semibold"
                    disabled={!!actionPending}
                    onClick={() => handleAction("resolve")}
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 22v-7" strokeLinecap="round" />
                    </svg>
                    {actionPending === "resolve" ? "Working…" : "Resolve"}
                  </Button>
                ) : null}
                {canCancel && request.status === "OPEN" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-xl px-4 py-2.5 text-[0.8125rem]"
                    disabled={!!actionPending}
                    onClick={() => handleAction("cancel")}
                  >
                    {actionPending === "cancel" ? "Working…" : "Cancel request"}
                  </Button>
                ) : null}
              </div>
              {canAcknowledge && request.status === "OPEN" ? (
                <MetaText className="mt-3 block max-w-md leading-relaxed">
                  Acknowledge this request to indicate it is being handled.
                </MetaText>
              ) : null}
            </div>
          ) : null}

          <Link href="/on-call" className="link-muted-accent inline-flex items-center gap-1.5 text-[0.8125rem] font-medium">
            <span aria-hidden>&larr;</span> Back to inbox
          </Link>
        </div>

        <aside className={`${surfaceCard} p-5 sm:p-6 lg:min-h-[280px]`}>
          <h2 className="text-base font-bold text-text">Timeline</h2>
          <div className="relative mt-5 pl-1">
            <div className="absolute bottom-2 left-[7px] top-2 w-px bg-border/45" aria-hidden />
            <ul className="relative space-y-4">
              {timelineEntries.map((ev, idx) => (
                <li key={ev.id} className="relative flex gap-3">
                  <div className="relative z-[1] flex w-4 shrink-0 justify-center pt-1.5">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ring-4 ring-surface-container-lowest ${
                        idx === 0 ? "bg-[#2563eb]" : ""
                      }`}
                      style={idx === 0 ? undefined : { backgroundColor: ACCENT_VIOLET }}
                    />
                  </div>
                  <div
                    className="min-w-0 flex-1 rounded-lg px-3.5 py-2.5"
                    style={{ backgroundColor: ACCENT_VIOLET_SOFT }}
                  >
                    <p className="text-[0.8125rem] font-bold text-text">{TIMELINE_LABELS[ev.type]}</p>
                    <p className="mt-0.5 text-[0.8125rem] text-muted">{fmt(ev.createdAt)}</p>
                    {ev.actor?.fullName ? (
                      <p className="mt-1 text-[0.75rem] text-muted">by {ev.actor.fullName}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
