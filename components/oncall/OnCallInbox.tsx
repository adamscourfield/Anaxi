"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  REQUEST_TYPE_LABELS,
  RESOLVED_HISTORY_RANGE_LABELS,
  type ResolvedHistoryRange,
} from "@/modules/oncall/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

type Status = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
type RequestType = "BEHAVIOUR" | "FIRST_AID";

export interface InboxRequest {
  id: string;
  requestType: RequestType;
  isEmergency?: boolean;
  location: string;
  status: Status;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  requester: { fullName: string };
  student: { fullName: string; yearGroup?: string | null; avatarUrl?: string | null };
  responder?: { fullName: string } | null;
}

interface OnCallInboxProps {
  openRequests: InboxRequest[];
  resolvedRequests: InboxRequest[];
  resolvedRange: ResolvedHistoryRange;
  canAcknowledge?: boolean;
  canResolve?: boolean;
  /** SLT/Admin/Super Admin only -- everyone else sees that a request is resolved, not when or how fast. */
  canViewResolveTime?: boolean;
  totalLogsToday: number;
  avgResponseMs: number;
  resolutionRate: number;
  /** Requests resolved or cancelled today. With none, rate and status have nothing to report yet. */
  closedToday?: number;
  /** Filter controls, rendered in the open-requests header so they sit next to what they filter. */
  toolbar?: ReactNode;
}

function timeAgo(dateVal: Date | string): string {
  const ms = Date.now() - new Date(dateVal).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** How long a request has been waiting, e.g. "4 min", "2h 05m", "3d". */
function waitingFor(dateVal: Date | string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(dateVal).getTime()) / 60000));
  if (mins < 1) return "under 1 min";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${String(mins % 60).padStart(2, "0")}m`;
  return `${Math.floor(hrs / 24)}d`;
}

function isToday(dateVal: Date | string): boolean {
  return new Date(dateVal).toDateString() === new Date().toDateString();
}

function formatDuration(ms: number): string {
  const totalMins = Math.round(ms / 60000);
  if (totalMins < 1) return "< 1m";
  if (totalMins < 60) return `${String(totalMins).padStart(2, "0")}M`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}H ${String(mins).padStart(2, "0")}M`;
}

function formatAvgResponse(ms: number): { mins: string; secs: string } {
  const totalSecs = Math.round(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return { mins: String(m).padStart(2, "0"), secs: String(s).padStart(2, "0") };
}

function formatTime(dateVal: Date | string): string {
  const d = new Date(dateVal);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(dateVal: Date | string): string {
  const d = new Date(dateVal);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

function formatYearGroup(yearGroup: string | null | undefined): string {
  if (!yearGroup) return "—";
  const digits = yearGroup.replace(/\D/g, "");
  return `Year ${digits || yearGroup}`;
}

const TYPE_BADGE_CLASSES: Record<RequestType, string> = {
  BEHAVIOUR:
    "bg-[color-mix(in_srgb,var(--pill-error-bg)_70%,transparent)] text-[var(--pill-error-text)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--pill-error-ring)_55%,transparent)]",
  FIRST_AID:
    "bg-[var(--surface-container-lowest)] text-muted ring-1 ring-inset ring-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)]",
};

export function OnCallInbox({
  openRequests,
  resolvedRequests,
  resolvedRange,
  canAcknowledge,
  canResolve,
  canViewResolveTime,
  totalLogsToday,
  avgResponseMs,
  resolutionRate,
  closedToday,
  toolbar,
}: OnCallInboxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);

  function handleRangeChange(next: ResolvedHistoryRange) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "today") params.delete("range");
    else params.set("range", next);
    const qs = params.toString();
    router.push(qs ? `/on-call?${qs}` : "/on-call");
    setRangeMenuOpen(false);
  }

  /** Preserve the inbox's current filter state so "Back" returns to the same view. */
  function detailHref(requestId: string): string {
    const qs = searchParams.toString();
    const from = encodeURIComponent(qs ? `${pathname}?${qs}` : pathname);
    return `/on-call/${requestId}?from=${from}`;
  }

  const openCount = openRequests.filter((r) => r.status === "OPEN").length;

  const filtersActive = searchParams.has("yearGroup") || searchParams.has("reason");
  const acknowledgedCount = openRequests.filter((r) => r.status === "ACKNOWLEDGED").length;
  const oldestOpen = openRequests
    .filter((r) => r.status === "OPEN")
    .reduce<InboxRequest | null>(
      (oldest, r) => (!oldest || new Date(r.createdAt) < new Date(oldest.createdAt) ? r : oldest),
      null,
    );

  async function handleAction(id: string, action: string) {
    setActionPending(`${id}-${action}`);
    try {
      const res = await fetch(`/api/oncall/${id}/${action}`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setActionPending(null);
    }
  }

  const avg = formatAvgResponse(avgResponseMs);
  // Until something has been closed today there is no rate to judge, so say so rather than "0% / Critical".
  const hasClosedToday = closedToday === undefined ? totalLogsToday > 0 : closedToday > 0;
  const healthLabel = !hasClosedToday ? "No data yet" : resolutionRate >= 90 ? "Stable" : resolutionRate >= 70 ? "Warning" : "Critical";
  const healthDot = !hasClosedToday
    ? "bg-[#d4d4d8]"
    : healthLabel === "Stable"
      ? "bg-scale-strong-bar"
      : healthLabel === "Warning"
        ? "bg-scale-some-bar"
        : "bg-scale-limited-bar";
  const statCell = "min-w-0 px-5 py-4";
  const statLabel = "text-[12px] font-medium text-muted";
  const statValue = "mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-text tabular-nums";

  return (
    <div className="w-full min-w-0 space-y-8">
      {/* ── Today at a glance ─────────────────────────────────── */}
      <section
        aria-label="Today at a glance"
        className="grid grid-cols-2 divide-[#e5e5e6] overflow-hidden rounded-[14px] border border-[#e5e5e6] bg-white max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*:nth-child(odd)]:border-r lg:grid-cols-4 lg:divide-x"
      >
        <div className={statCell}>
          <p className={statLabel}>Logged today</p>
          <p className={statValue}>{totalLogsToday}</p>
        </div>
        <div className={statCell}>
          <p className={statLabel}>Average response</p>
          <p className={statValue}>
            {avgResponseMs > 0 ? (
              <>
                {avg.mins}
                <span className="text-[13px] font-medium text-muted">m </span>
                {avg.secs}
                <span className="text-[13px] font-medium text-muted">s</span>
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div className={statCell}>
          <p className={statLabel}>Resolution rate</p>
          <p className={statValue}>{hasClosedToday ? `${resolutionRate}%` : "—"}</p>
        </div>
        <div className={statCell}>
          <p className={statLabel}>Status</p>
          <p className={`${statValue} flex items-center gap-2`}>
            <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${healthDot}`} aria-hidden />
            <span className={hasClosedToday ? "" : "text-muted"}>{healthLabel}</span>
          </p>
        </div>
      </section>

      {/* ── Open Requests Section ─────────────────────────────── */}
      <section>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h2 className="text-lg font-bold tracking-[-0.02em] text-text">Open requests</h2>
              {openCount > 0 && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--pill-error-bg)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]">
                  {openCount} waiting
                </span>
              )}
              {acknowledgedCount > 0 && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-[#f4f4f5] px-2.5 py-0.5 text-[12px] font-semibold text-[#1c1c1e]">
                  {acknowledgedCount} in hand
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-muted">
              {oldestOpen ? <>Longest wait: {waitingFor(oldestOpen.createdAt)}. </> : null}
              <Link href="/on-call/feed" className="link-muted-accent font-medium">
                Open the live feed
              </Link>
            </p>
          </div>
          {toolbar}
        </div>

        {/* Open requests table */}
        {openRequests.length === 0 ? (
          <EmptyState
            title={filtersActive ? "No open requests match these filters" : "No open requests"}
            description={
              filtersActive
                ? "Other year groups or reasons may still have requests waiting. Clear the filters to see everything."
                : "All clear — no pending on-call requests right now."
            }
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {openRequests.map((r) => {
                const showAck = canAcknowledge && r.status === "OPEN";
                const showResolve = canResolve && (r.status === "OPEN" || r.status === "ACKNOWLEDGED");
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(detailHref(r.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(detailHref(r.id));
                      }
                    }}
                    className="w-full cursor-pointer rounded-2xl border border-border/50 bg-[var(--surface-container-lowest)] p-4 text-left shadow-ambient calm-transition hover:border-border hover:bg-[var(--surface-container-low)]"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={r.student.fullName} avatarUrl={r.student.avatarUrl} size="lg" tone="muted" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-text">{r.student.fullName}</span>
                          <span className="text-[11px] font-medium uppercase text-muted">
                            {formatYearGroup(r.student.yearGroup)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] uppercase ${TYPE_BADGE_CLASSES[r.requestType]}`}
                          >
                            {REQUEST_TYPE_LABELS[r.requestType]}
                          </span>
                          {r.isEmergency && (
                            <span className="inline-flex items-center rounded-md bg-[var(--pill-error-bg)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]">
                              Emergency
                            </span>
                          )}
                        </div>
                        <p className="break-words text-sm font-medium uppercase text-text">{r.location}</p>
                        <p className="text-xs text-muted">
                          Raised by <span className="font-medium text-text">{r.requester.fullName}</span>
                          {" · "}
                          {formatTime(r.createdAt)}
                        </p>
                        {(showAck || showResolve) && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {showAck && (
                              <Button
                                type="button"
                                variant="secondary"
                                className="min-h-10 flex-1 rounded-md px-4 text-xs font-semibold sm:flex-none"
                                disabled={actionPending === `${r.id}-acknowledge`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleAction(r.id, "acknowledge");
                                }}
                              >
                                Acknowledge
                              </Button>
                            )}
                            {showResolve && (
                              <Button
                                type="button"
                                className="min-h-10 flex-1 rounded-md px-4 text-xs font-semibold sm:flex-none"
                                disabled={actionPending === `${r.id}-resolve`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleAction(r.id, "resolve");
                                }}
                              >
                                Resolve
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="table-shell hidden overflow-x-auto md:block">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                      Student
                    </th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Type</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Location</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Raised by</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Waiting</th>
                    {(canAcknowledge || canResolve) && (
                      <th className="px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {openRequests.map((r) => {
                    const showAck = canAcknowledge && r.status === "OPEN";
                    const showResolve = canResolve && (r.status === "OPEN" || r.status === "ACKNOWLEDGED");
                    return (
                      <tr
                        key={r.id}
                        className="table-row cursor-pointer calm-transition"
                        onClick={() => router.push(detailHref(r.id))}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.student.fullName} avatarUrl={r.student.avatarUrl} size="md" tone="muted" />
                            <span className="min-w-0">
                              <span className="block font-semibold text-text">{r.student.fullName}</span>
                              <span className="block text-[12px] text-muted">{formatYearGroup(r.student.yearGroup)}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] uppercase ${TYPE_BADGE_CLASSES[r.requestType]}`}
                            >
                              {REQUEST_TYPE_LABELS[r.requestType]}
                            </span>
                            {r.isEmergency && (
                              <span className="inline-flex items-center rounded-md bg-[var(--pill-error-bg)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]">
                                Emergency
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium text-text">
                          {r.location}
                        </td>
                        <td className="px-4 py-4 text-text">
                          {r.requester.fullName}
                        </td>
                        <td className="px-4 py-4">
                          <span className="block font-semibold tabular-nums text-text">
                            {r.status === "ACKNOWLEDGED" ? "In hand" : waitingFor(r.createdAt)}
                          </span>
                          <span className="block text-[12px] tabular-nums text-muted">
                            Raised {isToday(r.createdAt) ? "" : `${formatDate(r.createdAt)}, `}
                            {formatTime(r.createdAt)}
                          </span>
                        </td>
                        {(canAcknowledge || canResolve) && (
                          <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              {showAck && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="rounded-md px-4 py-2 text-xs font-semibold"
                                  disabled={actionPending === `${r.id}-acknowledge`}
                                  onClick={() => handleAction(r.id, "acknowledge")}
                                >
                                  Acknowledge
                                </Button>
                              )}
                              {showResolve && (
                                <Button
                                  type="button"
                                  className="rounded-md px-4 py-2 text-xs font-semibold"
                                  disabled={actionPending === `${r.id}-resolve`}
                                  onClick={() => handleAction(r.id, "resolve")}
                                >
                                  Resolve
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ── Resolved Requests Section ─────────────────────────── */}
      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-2 sm:gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            <h2 className="whitespace-nowrap text-lg font-bold tracking-[-0.02em] text-text">Resolved Requests</h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              History ({RESOLVED_HISTORY_RANGE_LABELS[resolvedRange]})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Time range filter */}
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-surface px-2.5 text-xs font-medium text-muted calm-transition hover:bg-[var(--surface-container-low)]"
                aria-haspopup="listbox"
                aria-expanded={rangeMenuOpen}
                aria-label="Filter resolved requests by time range"
                onClick={() => setRangeMenuOpen((open) => !open)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                  <line x1="11" y1="18" x2="13" y2="18" />
                </svg>
                {RESOLVED_HISTORY_RANGE_LABELS[resolvedRange]}
              </button>
              {rangeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setRangeMenuOpen(false)} />
                  <ul
                    role="listbox"
                    className="absolute right-0 z-20 mt-1.5 w-40 overflow-hidden rounded-lg border border-border/60 bg-surface py-1 shadow-lg"
                  >
                    {(Object.keys(RESOLVED_HISTORY_RANGE_LABELS) as ResolvedHistoryRange[]).map((option) => (
                      <li key={option}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={option === resolvedRange}
                          className={`block w-full px-3 py-2 text-left text-sm calm-transition hover:bg-[var(--surface-container-low)] ${
                            option === resolvedRange ? "font-semibold text-text" : "text-muted"
                          }`}
                          onClick={() => handleRangeChange(option)}
                        >
                          {RESOLVED_HISTORY_RANGE_LABELS[option]}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            {/* Download icon */}
            <a
              href={(() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("scope", "resolved");
                params.set("range", resolvedRange);
                return `/api/oncall/report?${params.toString()}`;
              })()}
              download
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface text-muted calm-transition hover:bg-[var(--surface-container-low)]"
              aria-label="Download resolved requests"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          </div>
        </div>

        {resolvedRequests.length === 0 ? (
          <EmptyState
            title={`No resolved requests ${resolvedRange === "all" ? "yet" : `in the selected range (${RESOLVED_HISTORY_RANGE_LABELS[resolvedRange].toLowerCase()})`}`}
            description="Resolved incidents will appear here once handled."
            mode="embedded"
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {resolvedRequests.map((r) => {
                const duration =
                  r.resolvedAt && r.createdAt
                    ? new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime()
                    : 0;
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(detailHref(r.id))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(detailHref(r.id));
                      }
                    }}
                    className="w-full cursor-pointer rounded-2xl border border-border/50 bg-[var(--surface-container-lowest)] p-4 text-left shadow-ambient calm-transition hover:border-border hover:bg-[var(--surface-container-low)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold uppercase text-text">{r.student.fullName}</p>
                      <span className="text-[11px] font-medium uppercase text-muted">
                        {formatYearGroup(r.student.yearGroup)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted">
                      {REQUEST_TYPE_LABELS[r.requestType]}
                      {r.isEmergency && <span className="text-[var(--pill-error-text)]"> · Emergency</span>}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Raised by <span className="font-medium text-text">{r.requester.fullName}</span>
                      {" · "}
                      {formatTime(r.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>Responder:</span>
                      <span className="font-medium text-text">{r.responder?.fullName ?? "—"}</span>
                      {canViewResolveTime && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="font-mono text-text">
                            {r.resolvedAt ? `${formatDate(r.resolvedAt)} · ${formatTime(r.resolvedAt)}` : "—"}
                          </span>
                          {duration > 0 && (
                            <span className="inline-flex items-center rounded-md bg-[var(--pill-info-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--pill-info-text)] ring-1 ring-inset ring-[var(--pill-info-ring)]">
                              {formatDuration(duration)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="table-shell hidden overflow-x-auto md:block">
              <table className="w-full min-w-[750px] text-sm">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Student name</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Year</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Type</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Reporter</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Time of report</th>
                    <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Responder</th>
                    {canViewResolveTime && (
                      <>
                        <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Date</th>
                        <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Resolved at</th>
                        <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Duration</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {resolvedRequests.map((r) => {
                    const duration =
                      r.resolvedAt && r.createdAt
                        ? new Date(r.resolvedAt).getTime() - new Date(r.createdAt).getTime()
                        : 0;
                    return (
                      <tr
                        key={r.id}
                        className="table-row cursor-pointer calm-transition"
                        onClick={() => router.push(detailHref(r.id))}
                      >
                        <td className="px-5 py-4 font-bold uppercase text-text">
                          {r.student.fullName}
                        </td>
                        <td className="px-4 py-4 font-medium uppercase text-text">
                          {formatYearGroup(r.student.yearGroup)}
                        </td>
                        <td className="px-4 py-4 text-muted uppercase tracking-wide">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            {REQUEST_TYPE_LABELS[r.requestType]}
                            {r.isEmergency && (
                              <span className="text-[var(--pill-error-text)]">· Emergency</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-text">
                          {r.requester.fullName}
                        </td>
                        <td className="px-4 py-4 font-mono text-text">
                          {formatTime(r.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-text">
                          {r.responder?.fullName ?? "—"}
                        </td>
                        {canViewResolveTime && (
                          <>
                            <td className="px-4 py-4 text-text">
                              {r.resolvedAt ? formatDate(r.resolvedAt) : "—"}
                            </td>
                            <td className="px-4 py-4 font-mono text-text">
                              {r.resolvedAt ? formatTime(r.resolvedAt) : "—"}
                            </td>
                            <td className="px-4 py-4">
                              {duration > 0 && (
                                <span className="inline-flex items-center rounded-md bg-[var(--pill-info-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--pill-info-text)] ring-1 ring-inset ring-[var(--pill-info-ring)]">
                                  {formatDuration(duration)}
                                </span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
