"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

export type OnCallDetail = {
  id: string;
  createdAt: string;
  studentId: string;
  studentName: string;
  studentYearGroup: string | null;
  requesterName: string;
  behaviourReasonCategory: string | null;
  status: string;
  location: string;
  notes: string | null;
};

type HourRow = { hour: number; count: number };
type ReasonRow = { reason: string; count: number };

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hourLabel(hour: number): string {
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function barWidthPct(count: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((count / max) * 100);
}

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="oncall-modal-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl glass-card shadow-ambient">
        <div className="flex items-start justify-between gap-3 px-5 py-4">
          <h2 id="oncall-modal-title" className="pr-2 text-lg font-semibold leading-snug tracking-[-0.01em] text-[var(--on-surface)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-[var(--on-surface-variant)] calm-transition hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)]"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="max-h-[calc(85vh-5.5rem)] overflow-y-auto border-t border-[var(--divider-subtle)] px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

type Props = {
  onCallByHour: HourRow[];
  onCallByReason: ReasonRow[];
  details: OnCallDetail[];
};

export function OnCallBreakdownCharts({ onCallByHour, onCallByReason, details }: Props) {
  const [modal, setModal] = useState<{ title: string; rows: OnCallDetail[] } | null>(null);

  const maxHour = useMemo(
    () => Math.max(...onCallByHour.map((r) => r.count), 1),
    [onCallByHour],
  );
  const maxReason = useMemo(
    () => Math.max(...onCallByReason.map((r) => r.count), 1),
    [onCallByReason],
  );

  const openHour = useCallback(
    (hour: number) => {
      const rows = details.filter((d) => new Date(d.createdAt).getHours() === hour);
      setModal({
        title: `${hourLabel(hour)} · ${rows.length} request${rows.length === 1 ? "" : "s"}`,
        rows,
      });
    },
    [details],
  );

  const openReason = useCallback(
    (reason: string) => {
      const rows = details.filter((d) => (d.behaviourReasonCategory ?? "Uncategorised") === reason);
      setModal({
        title: `${reason} · ${rows.length} request${rows.length === 1 ? "" : "s"}`,
        rows,
      });
    },
    [details],
  );

  const hasAnyHour = onCallByHour.some((r) => r.count > 0);
  const hasAnyReason = onCallByReason.some((r) => r.count > 0);

  /** Soft tint (not solid --primary black) so counts stay readable outside the bar. */
  const barTrack =
    "relative h-7 min-w-0 flex-1 overflow-hidden rounded-xl bg-[var(--surface-container-high)] calm-transition";
  const barFillClass =
    "pointer-events-none absolute inset-y-0 left-0 rounded-xl border-r border-[rgba(99,102,241,0.28)] bg-[rgba(99,102,241,0.22)]";

  return (
    <>
      <div className="space-y-10 p-6 sm:p-8">
        <div>
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
            By time of day
          </h3>
          <p className="mb-5 text-[0.8125rem] text-muted">8am–3pm · tap a bar for request details</p>
          {!hasAnyHour ? (
            <p className="text-sm text-muted">No on-call requests between 8am and 3pm in this window.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {onCallByHour.map((row) => (
                <div key={row.hour} className="flex items-center gap-2 sm:gap-3">
                  <span className="w-[3.25rem] shrink-0 text-right text-[11px] font-semibold tabular-nums text-[var(--on-surface-variant)]">
                    {hourLabel(row.hour)}
                  </span>
                  <button
                    type="button"
                    disabled={row.count === 0}
                    onClick={() => row.count > 0 && openHour(row.hour)}
                    className={`${barTrack} enabled:cursor-pointer enabled:ring-1 enabled:ring-inset enabled:ring-border/30 enabled:hover:bg-[var(--surface-container)] enabled:active:scale-[0.998] disabled:cursor-default disabled:opacity-55`}
                    aria-label={`${row.count} on-call requests at ${hourLabel(row.hour)}`}
                  >
                    {row.count > 0 && (
                      <span
                        className={barFillClass}
                        style={{ width: `${barWidthPct(row.count, maxHour)}%` }}
                      />
                    )}
                  </button>
                  <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-text">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {onCallByReason.length > 0 && (
          <div className="border-t border-[var(--divider-subtle)] pt-10">
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
              By reason
            </h3>
            <p className="mb-5 text-[0.8125rem] text-muted">Tap a bar to see matching requests</p>
            {!hasAnyReason ? (
              <p className="text-sm text-muted">No categorised reasons in this window.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {onCallByReason.map((row) => (
                  <div key={row.reason} className="flex items-center gap-2 sm:gap-3">
                    <span
                      className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-text"
                      title={row.reason}
                    >
                      {row.reason}
                    </span>
                    <button
                      type="button"
                      disabled={row.count === 0}
                      onClick={() => row.count > 0 && openReason(row.reason)}
                      className={`${barTrack} w-full max-w-[min(100%,280px)] shrink-0 sm:max-w-[340px] enabled:cursor-pointer enabled:ring-1 enabled:ring-inset enabled:ring-border/30 enabled:hover:bg-[var(--surface-container)] enabled:active:scale-[0.998] disabled:cursor-default disabled:opacity-55`}
                      aria-label={`${row.count} on-call requests for ${row.reason}`}
                    >
                      {row.count > 0 && (
                        <span
                          className={barFillClass}
                          style={{ width: `${barWidthPct(row.count, maxReason)}%` }}
                        />
                      )}
                    </button>
                    <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-text">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          {modal.rows.length === 0 ? (
            <p className="text-sm text-muted">No matching requests.</p>
          ) : (
            <ul className="space-y-3">
              {modal.rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl bg-[var(--surface-container-low)] px-4 py-3.5 text-sm shadow-sm"
                >
                  <p className="font-semibold text-[var(--on-surface)]">{r.studentName}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.studentYearGroup ? `${r.studentYearGroup} · ` : ""}
                    {formatTime(r.createdAt)}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    <span className="font-semibold text-[var(--on-surface)]">Teacher</span> {r.requesterName}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    <span className="font-semibold text-[var(--on-surface)]">Status</span> {r.status}
                    {r.location ? (
                      <>
                        {" "}
                        · <span className="font-semibold text-[var(--on-surface)]">Location</span> {r.location}
                      </>
                    ) : null}
                  </p>
                  {r.behaviourReasonCategory && (
                    <p className="mt-1 text-xs text-muted">
                      <span className="font-semibold text-[var(--on-surface)]">Reason</span>{" "}
                      {r.behaviourReasonCategory}
                    </p>
                  )}
                  {r.notes && (
                    <p className="mt-2 border-t border-[var(--divider-subtle)] pt-2 text-xs leading-relaxed text-muted">
                      {r.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
