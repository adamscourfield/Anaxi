"use client";

import type { CSSProperties, ReactNode } from "react";
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

const CHART_VIOLET_DEEP = "#5B3FD9";
const CHART_VIOLET = "#7C5CFF";
const CHART_VIOLET_LIGHT = "#C4B5FF";
const CHART_VIOLET_TRACK = "#F3F4F6";

function reasonBarStyle(reason: string, pct: number): CSSProperties {
  const r = reason.toLowerCase();
  if (r === "uncategorised" || r === "uncategorized") {
    return {
      width: `${pct}%`,
      background: `linear-gradient(90deg, ${CHART_VIOLET_LIGHT} 0%, ${CHART_VIOLET} 55%, ${CHART_VIOLET_DEEP} 100%)`,
    };
  }
  return {
    width: `${pct}%`,
    background: `linear-gradient(90deg, ${CHART_VIOLET_DEEP} 0%, ${CHART_VIOLET} 45%, ${CHART_VIOLET_LIGHT} 100%)`,
  };
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
  /** Tighter padding when nested inside a split layout card. */
  compact?: boolean;
};

export function OnCallBreakdownCharts({ onCallByHour, onCallByReason, details, compact }: Props) {
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

  const chartMaxH = 140;
  const pad = compact ? "p-5 sm:p-6" : "p-6 sm:p-8";
  const sectionGap = compact ? "space-y-8" : "space-y-10";
  const reasonTop = compact ? "pt-8" : "pt-10";

  return (
    <>
      <div className={`${sectionGap} ${pad}`}>
        <div>
          <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
            By time of day
          </h3>
          <p className="mb-5 text-[0.8125rem] text-[#6B7280]">8am–3pm · tap a bar for request details</p>
          {!hasAnyHour ? (
            <p className="text-sm text-[#6B7280]">No on-call requests between 8am and 3pm in this window.</p>
          ) : (
            <div className="flex items-end justify-between gap-1.5 sm:gap-2" style={{ minHeight: chartMaxH + 28 }}>
              {onCallByHour.map((row) => {
                const pct = barWidthPct(row.count, maxHour);
                const h = row.count > 0 ? Math.max(8, Math.round((pct / 100) * chartMaxH)) : 0;
                return (
                  <div key={row.hour} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <button
                      type="button"
                      disabled={row.count === 0}
                      onClick={() => row.count > 0 && openHour(row.hour)}
                      className="relative flex w-full max-w-[2.25rem] flex-1 items-end justify-center rounded-t-lg sm:max-w-[2.5rem] enabled:cursor-pointer enabled:hover:opacity-95 enabled:active:scale-[0.98] disabled:cursor-default disabled:opacity-50"
                      style={{
                        height: chartMaxH,
                        backgroundColor: CHART_VIOLET_TRACK,
                      }}
                      aria-label={`${row.count} on-call requests at ${hourLabel(row.hour)}`}
                    >
                      {row.count > 0 ? (
                        <span
                          className="w-full rounded-t-lg"
                          style={{
                            height: h,
                            background: `linear-gradient(180deg, ${CHART_VIOLET_DEEP} 0%, ${CHART_VIOLET} 40%, ${CHART_VIOLET_LIGHT} 100%)`,
                          }}
                        />
                      ) : null}
                    </button>
                    <span className="text-[10px] font-semibold tabular-nums text-[#6B7280]">{hourLabel(row.hour)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {onCallByReason.length > 0 && (
          <div className={`border-t border-[rgba(15,23,42,0.06)] ${reasonTop}`}>
            <h3 className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7280]">
              By reason
            </h3>
            <p className="mb-5 text-[0.8125rem] text-[#6B7280]">Tap a bar to see matching requests</p>
            {!hasAnyReason ? (
              <p className="text-sm text-[#6B7280]">No categorised reasons in this window.</p>
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
                      className="relative h-7 w-full max-w-[min(100%,340px)] min-w-0 flex-1 shrink-0 overflow-hidden rounded-full enabled:cursor-pointer enabled:hover:opacity-95 enabled:active:scale-[0.998] disabled:cursor-default disabled:opacity-55"
                      style={{ backgroundColor: CHART_VIOLET_TRACK }}
                      aria-label={`${row.count} on-call requests for ${row.reason}`}
                    >
                      {row.count > 0 && (
                        <span
                          className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
                          style={reasonBarStyle(row.reason, barWidthPct(row.count, maxReason))}
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
                  className="anx-card-inset rounded-xl px-4 py-3.5 text-sm"
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
