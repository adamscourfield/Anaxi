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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="oncall-modal-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl bg-surface-container-lowest shadow-ambient">
        <div className="flex items-start justify-between gap-3 border-b border-border/30 px-5 py-4">
          <h2 id="oncall-modal-title" className="text-base font-semibold text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted calm-transition hover:bg-surface-container-low hover:text-text"
            aria-label="Close dialog"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="max-h-[calc(85vh-5rem)] overflow-y-auto p-5">{children}</div>
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
        title: `On-call requests · ${hourLabel(hour)}`,
        rows,
      });
    },
    [details],
  );

  const openReason = useCallback(
    (reason: string) => {
      const rows = details.filter((d) => (d.behaviourReasonCategory ?? "Uncategorised") === reason);
      setModal({
        title: `On-call requests · ${reason}`,
        rows,
      });
    },
    [details],
  );

  const hasAnyHour = onCallByHour.some((r) => r.count > 0);
  const hasAnyReason = onCallByReason.some((r) => r.count > 0);

  return (
    <>
      <div className="space-y-8 p-6">
        <div>
          <h3 className="mb-4 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-muted">
            By time of day (8am–3pm)
          </h3>
          {!hasAnyHour ? (
            <p className="text-sm text-muted">No on-call requests between 8am and 3pm in this window.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {onCallByHour.map((row) => (
                <div key={row.hour} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 text-right text-xs font-medium tabular-nums text-muted">
                    {hourLabel(row.hour)}
                  </span>
                  <button
                    type="button"
                    disabled={row.count === 0}
                    onClick={() => row.count > 0 && openHour(row.hour)}
                    className="relative h-8 min-w-0 flex-1 overflow-hidden rounded-lg bg-surface-container-high text-left calm-transition enabled:cursor-pointer enabled:hover:ring-2 enabled:hover:ring-accent/40 disabled:cursor-default disabled:opacity-60"
                    aria-label={`${row.count} on-call requests at ${hourLabel(row.hour)}`}
                  >
                    {row.count > 0 && (
                      <span
                        className="absolute inset-y-0 left-0 rounded-lg bg-accent/80 calm-transition"
                        style={{ width: `${barWidthPct(row.count, maxHour)}%` }}
                      />
                    )}
                    <span className="relative z-[1] flex h-full items-center justify-end pr-2 text-xs font-semibold tabular-nums text-text">
                      {row.count}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {onCallByReason.length > 0 && (
          <div className="border-t border-border/30 pt-8">
            <h3 className="mb-4 text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-muted">By reason</h3>
            {!hasAnyReason ? (
              <p className="text-sm text-muted">No categorised reasons in this window.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {onCallByReason.map((row) => (
                  <div key={row.reason} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-left text-xs font-medium text-text" title={row.reason}>
                      {row.reason}
                    </span>
                    <button
                      type="button"
                      disabled={row.count === 0}
                      onClick={() => row.count > 0 && openReason(row.reason)}
                      className="relative h-8 w-[min(100%,280px)] shrink-0 overflow-hidden rounded-lg bg-surface-container-high text-left calm-transition enabled:cursor-pointer enabled:hover:ring-2 enabled:hover:ring-accent/40 disabled:cursor-default disabled:opacity-60"
                      aria-label={`${row.count} on-call requests for ${row.reason}`}
                    >
                      {row.count > 0 && (
                        <span
                          className="absolute inset-y-0 left-0 rounded-lg bg-accent/70 calm-transition"
                          style={{ width: `${barWidthPct(row.count, maxReason)}%` }}
                        />
                      )}
                      <span className="relative z-[1] flex h-full items-center justify-end pr-2 text-xs font-semibold tabular-nums text-text">
                        {row.count}
                      </span>
                    </button>
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
            <ul className="space-y-4">
              {modal.rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-border/25 bg-surface-container-low/50 px-4 py-3 text-sm"
                >
                  <p className="font-medium text-text">{r.studentName}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.studentYearGroup ? `${r.studentYearGroup} · ` : ""}
                    {formatTime(r.createdAt)}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    <span className="font-semibold text-text/80">Teacher:</span> {r.requesterName}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-semibold text-text/80">Status:</span> {r.status}
                    {r.location ? (
                      <>
                        {" "}
                        · <span className="font-semibold text-text/80">Location:</span> {r.location}
                      </>
                    ) : null}
                  </p>
                  {r.behaviourReasonCategory && (
                    <p className="mt-1 text-xs text-muted">
                      <span className="font-semibold text-text/80">Reason:</span> {r.behaviourReasonCategory}
                    </p>
                  )}
                  {r.notes && (
                    <p className="mt-2 border-t border-border/20 pt-2 text-xs leading-relaxed text-muted">{r.notes}</p>
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
