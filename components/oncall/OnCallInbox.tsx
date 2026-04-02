"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REQUEST_TYPE_LABELS } from "@/modules/oncall/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

type Status = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";
type RequestType = "BEHAVIOUR" | "FIRST_AID";

interface InboxRequest {
  id: string;
  requestType: RequestType;
  isEmergency?: boolean;
  location: string;
  status: Status;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  requester: { fullName: string };
  student: { fullName: string; yearGroup?: string | null };
  responder?: { fullName: string } | null;
}

interface OnCallInboxProps {
  openRequests: InboxRequest[];
  resolvedRequests: InboxRequest[];
  canAcknowledge?: boolean;
  canResolve?: boolean;
  totalLogsToday: number;
  avgResponseMs: number;
  resolutionRate: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

function formatYearGroup(yearGroup: string | null | undefined): string {
  if (!yearGroup) return "—";
  const digits = yearGroup.replace(/\D/g, "");
  return `Year ${digits || yearGroup}`;
}

const TYPE_BADGE_CLASSES: Record<RequestType, string> = {
  BEHAVIOUR: "bg-[var(--pill-error-bg)] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]",
  FIRST_AID: "bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-text)] ring-1 ring-inset ring-[var(--pill-neutral-ring)]",
};

export function OnCallInbox({
  openRequests,
  resolvedRequests,
  canAcknowledge,
  canResolve,
  totalLogsToday,
  avgResponseMs,
  resolutionRate,
}: OnCallInboxProps) {
  const router = useRouter();
  const [actionPending, setActionPending] = useState<string | null>(null);

  const openCount = openRequests.filter((r) => r.status === "OPEN").length;

  // Determine "last updated" from most recent open request
  const lastUpdated =
    openRequests.length > 0
      ? timeAgo(
          openRequests.reduce((latest, r) =>
            new Date(r.createdAt) > new Date(latest.createdAt) ? r : latest
          , openRequests[0]).createdAt
        )
      : null;

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
  const healthLabel = resolutionRate >= 90 ? "STABLE" : resolutionRate >= 70 ? "WARNING" : "CRITICAL";

  return (
    <div className="w-full min-w-0 space-y-8">
      {/* ── Open Requests Section ─────────────────────────────── */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text">
              Open Requests
            </h2>
            {openCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-[var(--pill-error-bg)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]">
                {openCount} PENDING
              </span>
            )}
          </div>
          {lastUpdated && (
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted italic">
              Last updated: {lastUpdated}
            </span>
          )}
        </div>

        {/* Alert banner */}
        {openCount >= 3 && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--pill-error-ring)] bg-[var(--pill-error-bg)] px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--pill-error-ring)]">
              <svg className="h-4 w-4 text-[var(--pill-error-text)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-pretty text-sm font-semibold text-[var(--pill-error-text)]">
                {openCount} high priority incidents requiring immediate response
              </p>
              <p className="text-pretty text-xs text-muted">
                Response time average is currently above target.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 self-start text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--pill-error-text)] hover:underline calm-transition sm:self-auto"
            >
              View priority log
            </button>
          </div>
        )}

        {/* Open requests table */}
        {openRequests.length === 0 ? (
          <EmptyState
            title="No open requests"
            description="All clear — no pending on-call requests right now."
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
                    onClick={() => router.push(`/on-call/${r.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/on-call/${r.id}`);
                      }
                    }}
                    className="w-full cursor-pointer rounded-2xl border border-border/50 bg-[var(--surface-container-lowest)] p-4 text-left shadow-sm calm-transition hover:border-border hover:bg-[var(--surface-container-low)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container-high)] text-xs font-semibold text-muted">
                        {getInitials(r.student.fullName)}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-text">{r.student.fullName}</span>
                          <span className="text-[11px] font-medium uppercase text-muted">
                            {formatYearGroup(r.student.yearGroup)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] uppercase ${TYPE_BADGE_CLASSES[r.requestType]}`}
                          >
                            {REQUEST_TYPE_LABELS[r.requestType]}
                          </span>
                          {r.isEmergency && (
                            <span className="inline-flex items-center rounded-full bg-[var(--pill-error-bg)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]">
                              Emergency
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium uppercase text-text">{r.location}</p>
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
                                className="min-h-10 flex-1 px-3 text-xs sm:flex-none"
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
                                className="min-h-10 flex-1 px-3 text-xs sm:flex-none"
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
                    <th className="px-5 py-3 text-left font-semibold">Student Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Year</th>
                    <th className="px-4 py-3 text-left font-semibold">Incident Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Location</th>
                    <th className="px-4 py-3 text-left font-semibold">Raised By</th>
                    {(canAcknowledge || canResolve) && (
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
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
                        onClick={() => router.push(`/on-call/${r.id}`)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-container-high)] text-xs font-semibold text-muted">
                              {getInitials(r.student.fullName)}
                            </span>
                            <span className="font-semibold text-text">
                              {r.student.fullName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium uppercase text-text">
                          {formatYearGroup(r.student.yearGroup)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] uppercase ${TYPE_BADGE_CLASSES[r.requestType]}`}
                            >
                              {REQUEST_TYPE_LABELS[r.requestType]}
                            </span>
                            {r.isEmergency && (
                              <span className="inline-flex items-center rounded-full bg-[var(--pill-error-bg)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] text-[var(--pill-error-text)] ring-1 ring-inset ring-[var(--pill-error-ring)]">
                                Emergency
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium uppercase text-text">
                          {r.location}
                        </td>
                        <td className="px-4 py-4 text-text">
                          {r.requester.fullName}
                        </td>
                        {(canAcknowledge || canResolve) && (
                          <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              {showAck && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="px-3 py-1 text-xs"
                                  disabled={actionPending === `${r.id}-acknowledge`}
                                  onClick={() => handleAction(r.id, "acknowledge")}
                                >
                                  Acknowledge
                                </Button>
                              )}
                              {showResolve && (
                                <Button
                                  type="button"
                                  className="px-3 py-1 text-xs"
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text">
              Resolved Requests
            </h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              History (Today)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter icon */}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface text-muted calm-transition hover:bg-[var(--surface-container-low)]"
              aria-label="Filter resolved requests"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="11" y1="18" x2="13" y2="18" />
              </svg>
            </button>
            {/* Download icon */}
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface text-muted calm-transition hover:bg-[var(--surface-container-low)]"
              aria-label="Download resolved requests"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>
        </div>

        {resolvedRequests.length === 0 ? (
          <EmptyState
            title="No resolved requests today"
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
                    onClick={() => router.push(`/on-call/${r.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/on-call/${r.id}`);
                      }
                    }}
                    className="w-full cursor-pointer rounded-2xl border border-border/50 bg-[var(--surface-container-lowest)] p-4 text-left shadow-sm calm-transition hover:border-border hover:bg-[var(--surface-container-low)]"
                  >
                    <p className="font-bold uppercase text-text">{r.student.fullName}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted">
                      {REQUEST_TYPE_LABELS[r.requestType]}
                      {r.isEmergency && <span className="text-[var(--pill-error-text)]"> · Emergency</span>}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-medium text-text">{r.responder?.fullName ?? "—"}</span>
                      <span aria-hidden>·</span>
                      <span className="font-mono text-text">{r.resolvedAt ? formatTime(r.resolvedAt) : "—"}</span>
                      {duration > 0 && (
                        <span className="inline-flex items-center rounded-full bg-[var(--pill-info-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--pill-info-text)] ring-1 ring-inset ring-[var(--pill-info-ring)]">
                          {formatDuration(duration)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="table-shell hidden overflow-x-auto md:block">
              <table className="w-full min-w-[650px] text-sm">
                <thead>
                  <tr className="table-head-row">
                    <th className="px-5 py-3 text-left font-semibold">Student Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Responder</th>
                    <th className="px-4 py-3 text-left font-semibold">Resolved At</th>
                    <th className="px-4 py-3 text-left font-semibold">Duration</th>
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
                        onClick={() => router.push(`/on-call/${r.id}`)}
                      >
                        <td className="px-5 py-4 font-bold uppercase text-text">
                          {r.student.fullName}
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
                          {r.responder?.fullName ?? "—"}
                        </td>
                        <td className="px-4 py-4 font-mono text-text">
                          {r.resolvedAt ? formatTime(r.resolvedAt) : "—"}
                        </td>
                        <td className="px-4 py-4">
                          {duration > 0 && (
                            <span className="inline-flex items-center rounded-full bg-[var(--pill-info-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--pill-info-text)] ring-1 ring-inset ring-[var(--pill-info-ring)]">
                              {formatDuration(duration)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ── Stats Cards ───────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/40 bg-[var(--surface-container-lowest)] p-4 shadow-sm sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Total Logs Today
          </p>
          <p className="mt-2 text-[32px] font-bold leading-tight tracking-[-0.02em] text-text">
            {totalLogsToday}
          </p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-[var(--surface-container-lowest)] p-4 shadow-sm sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Avg Response
          </p>
          <p className="mt-2 text-[32px] font-bold leading-tight tracking-[-0.02em] text-text">
            {avg.mins}<span className="text-[16px] font-semibold text-muted">M </span>
            {avg.secs}<span className="text-[16px] font-semibold text-muted">S</span>
          </p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-[var(--surface-container-lowest)] p-4 shadow-sm sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Resolution Rate
          </p>
          <p className="mt-2 text-[32px] font-bold leading-tight tracking-[-0.02em] text-text">
            {resolutionRate}%
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--primary-container)] p-4 sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--on-primary-container)]">
            Operational Health
          </p>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[var(--on-primary)]">
              {healthLabel}
            </p>
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full ${
                healthLabel === "STABLE"
                  ? "bg-scale-strong-bar"
                  : healthLabel === "WARNING"
                    ? "bg-scale-some-bar"
                    : "bg-scale-limited-bar"
              }`}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
