"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Stages of a school switch, in order. Each one maps to a real step in the
 * switcher (access check → session update → loading the new school's home),
 * so the bar only moves when the platform has actually done something.
 */
export type SchoolSwitchStage = "access" | "session" | "loading" | "done" | "error";

const STEPS: { key: Exclude<SchoolSwitchStage, "done" | "error">; label: string }[] = [
  { key: "access", label: "Checking your access" },
  { key: "session", label: "Signing you in to the school" },
  { key: "loading", label: "Loading the school's data" },
];

/** Where the bar rests while each stage is in flight. It eases toward this, so it keeps moving during a slow step. */
const STAGE_PROGRESS: Record<SchoolSwitchStage, number> = {
  access: 22,
  session: 55,
  loading: 90,
  done: 100,
  error: 0,
};

function stepState(step: number, stage: SchoolSwitchStage, failedAt: number): "done" | "active" | "todo" | "failed" {
  if (stage === "done") return "done";
  if (stage === "error") return step < failedAt ? "done" : step === failedAt ? "failed" : "todo";
  const current = STEPS.findIndex((s) => s.key === stage);
  return step < current ? "done" : step === current ? "active" : "todo";
}

export function SchoolSwitchProgress({
  schoolName,
  stage,
  failedStage,
  errorMessage,
  onClose,
}: {
  schoolName: string;
  stage: SchoolSwitchStage;
  /** The stage that was in flight when the switch failed. */
  failedStage?: SchoolSwitchStage;
  errorMessage?: string;
  /** Only offered once the switch has failed; a switch in flight cannot be dismissed. */
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const failed = stage === "error";
  const failedAt = Math.max(0, STEPS.findIndex((s) => s.key === failedStage));

  // Hold focus and stop the page behind from scrolling while the switch runs.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    if (!failed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [failed, onClose]);

  if (typeof document === "undefined") return null;

  const progress = failed ? STAGE_PROGRESS[failedStage ?? "access"] : STAGE_PROGRESS[stage];
  const title = failed
    ? `Could not switch to ${schoolName}`
    : stage === "done"
      ? `You're in ${schoolName}`
      : `Switching to ${schoolName}`;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#1c1c1e]/40" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-[400px] rounded-[14px] border border-[#e5e5e6] bg-white p-6 text-[#1c1c1e] shadow-[0_24px_70px_-30px_#1c1c1e66] outline-none motion-safe:animate-page-enter"
      >
        <h2 id={titleId} className="text-[17px] font-semibold leading-snug tracking-[-0.02em]">
          {title}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]" role="status" aria-live="polite">
          {failed
            ? (errorMessage ?? "Nothing has changed. You are still in your current school.")
            : stage === "done"
              ? "Everything is ready."
              : "This usually takes a few seconds. Please keep this tab open."}
        </p>

        <div
          role="progressbar"
          aria-label={`Switching to ${schoolName}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f1]"
        >
          <div
            className={`h-full rounded-full motion-reduce:transition-none ${failed ? "bg-[var(--error)]" : "bg-[#1c1c1e]"}`}
            style={{
              width: `${progress}%`,
              // Long ease while a step is in flight so the bar keeps creeping; quick finish once it is done.
              transition: `width ${stage === "done" ? 300 : 2400}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          />
        </div>

        <ol className="mt-5 space-y-2.5">
          {STEPS.map((step, i) => {
            const state = stepState(i, stage, failedAt);
            return (
              <li key={step.key} className="flex items-center gap-2.5 text-[13px]">
                <span
                  aria-hidden
                  className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                    state === "done"
                      ? "border-[#1c1c1e] bg-[#1c1c1e] text-white"
                      : state === "failed"
                        ? "border-[var(--error)] text-[var(--error)]"
                        : state === "active"
                          ? "border-[#1c1c1e]"
                          : "border-[#d4d4d8]"
                  }`}
                >
                  {state === "done" ? (
                    <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5">
                      <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : state === "failed" ? (
                    <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5">
                      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  ) : state === "active" ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a52] motion-safe:animate-pulse" />
                  ) : null}
                </span>
                <span
                  className={
                    state === "todo"
                      ? "text-[#6e6e73]"
                      : state === "failed"
                        ? "font-medium text-[var(--error)]"
                        : state === "active"
                          ? "font-medium"
                          : ""
                  }
                >
                  {step.label}
                  <span className="sr-only">
                    {state === "done" ? " (done)" : state === "active" ? " (in progress)" : state === "failed" ? " (failed)" : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        {failed ? (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#1c1c1e] bg-[#1c1c1e] px-5 text-[13px] font-semibold text-white calm-transition hover:bg-[#2e2e31]"
            >
              Close
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
