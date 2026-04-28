"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalsForPhase } from "@/modules/observations/getSignalsBySchoolType";
import type { SignalDefinition } from "@/modules/observations/signalTypes";
import { loadDraft, persistDraft } from "./observationDraft";
import { ObservationStageLayout } from "./ObservationStageLayout";

type LabelMap = Record<string, { displayName: string; description?: string }>;

const SCALE_DISPLAY: Record<string, { label: string; color: string; dot: string; text: string }> = {
  LIMITED:    { label: "Limited",    color: "bg-scale-limited-light text-scale-limited-text",       dot: "bg-scale-limited-bar",    text: "text-scale-limited-text" },
  SOME:       { label: "Some",       color: "bg-scale-some-light text-scale-some-text",             dot: "bg-scale-some-bar",       text: "text-scale-some-text" },
  CONSISTENT: { label: "Consistent", color: "bg-scale-consistent-light text-scale-consistent-text", dot: "bg-scale-consistent-bar", text: "text-scale-consistent-text" },
  STRONG:     { label: "Strong",     color: "bg-scale-strong-light text-scale-strong-text",         dot: "bg-scale-strong-bar",     text: "text-scale-strong-text" },
};

// Generic signal icon — simple eye/observe motif
function SignalIcon() {
  return (
    <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3" />
      <path d="M2 12s3.636-7 10-7 10 7 10 7-3.636 7-10 7S2 12 2 12z" />
    </svg>
  );
}

export function ReviewList({
  draftKey,
  signals,
  labelMap,
  action,
  schoolType,
}: {
  draftKey: string;
  signals: SignalDefinition[];
  labelMap: LabelMap;
  action: (formData: FormData) => void;
  schoolType: TenantSchoolType;
}) {
  const router = useRouter();
  const allSignals = useMemo(() => [...signals].sort((a, b) => a.order - b.order), [signals]);
  const [draft, setDraft] = useState(() => loadDraft(draftKey, allSignals.map((s) => s.key)));
  const orderedSignals = useMemo(
    () => getSignalsForPhase(draft.context.phase, schoolType),
    [draft.context.phase, schoolType],
  );

  const completed = orderedSignals.filter((s) => {
    const st = draft.signalState[s.key];
    return st?.valueKey || st?.notObserved;
  }).length;

  const rated = orderedSignals.filter((s) => draft.signalState[s.key]?.valueKey).length;
  const skipped = orderedSignals.filter((s) => draft.signalState[s.key]?.notObserved && !draft.signalState[s.key]?.valueKey).length;
  const allDone = completed === orderedSignals.length;
  const remaining = orderedSignals.length - completed;

  // Format session context label
  const yearLabel = draft.context.yearGroup
    ? draft.context.yearGroup.replace(/^Y(\d+)$/i, "Year $1")
    : draft.context.classCode;
  const sessionLabel = [yearLabel, draft.context.subject].filter(Boolean).join(" — ");

  return (
    <ObservationStageLayout currentStep={3} maxWidthClassName="md:max-w-6xl">
      <form action={action}>
        {/* Hidden context fields */}
        <input type="hidden" name="observedTeacherId" value={draft.context.teacherId} />
        <input type="hidden" name="yearGroup" value={draft.context.yearGroup || draft.context.classCode} />
        <input type="hidden" name="subject" value={draft.context.subject} />
        <input type="hidden" name="phase" value={draft.context.phase} />
        <input type="hidden" name="classCode" value={draft.context.classCode} />
        <input type="hidden" name="observedAt" value={draft.context.observedAt} />

        {/* Hidden signal values (for form submission) */}
        {orderedSignals.map((signal) => {
          const state = draft.signalState[signal.key];
          return (
            <span key={signal.key}>
              <input type="hidden" name={`signal_${signal.key}_value`} value={state?.valueKey || ""} />
              <input type="hidden" name={`signal_${signal.key}_not`} value={state?.notObserved ? "1" : ""} />
            </span>
          );
        })}

        {/* Section heading */}
        <div className="mb-6">
          <h2 className="text-[1.375rem] font-bold text-text">Review &amp; Submit</h2>
          <p className="mt-1 text-[0.875rem] text-muted">
            Please verify the captured signals and provide final concluding reflections before finalizing this session.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[1fr_380px]">

          {/* ── Left: Signal Summary ── */}
          <div className="flex flex-col rounded-2xl bg-surface-container-low p-5 shadow-ambient">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[1rem] font-bold text-text">Signal Summary</h3>
              <button
                type="button"
                onClick={() => router.push("/observe/new/signals")}
                className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Observations
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              {orderedSignals.map((signal, index) => {
                const state = draft.signalState[signal.key];
                const displayName = labelMap[signal.key]?.displayName || signal.displayNameDefault;
                const scaleKey = state?.valueKey;
                const display = scaleKey ? SCALE_DISPLAY[scaleKey] : null;
                const isSkipped = state?.notObserved && !state?.valueKey;

                return (
                  <button
                    key={signal.key}
                    type="button"
                    onClick={() => router.push(`/observe/new/signals?index=${index}`)}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border/15 bg-surface-container-lowest px-4 py-3.5 text-left shadow-ambient calm-transition hover:border-border/30 hover:shadow-lg"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container">
                        <SignalIcon />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-muted">
                          {displayName}
                        </p>
                        <p className="mt-0.5 truncate text-[0.875rem] font-bold text-text">
                          {display ? display.label : isSkipped ? "Skipped" : "Pending"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        display ? display.dot : isSkipped ? "bg-outline-variant" : "bg-surface-container-high"
                      }`}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#e8c4c4] bg-[#fff0f0] px-4 py-3">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c94a4a] text-[0.625rem] font-bold text-white"
                aria-hidden
              >
                i
              </span>
              <p className="text-[0.8125rem] leading-relaxed text-[#5c3d3d]">
                Once submitted, this observation will be locked for 24 hours while the Ledger processes the institutional
                confidence score. You may request a correction link via support if required.
              </p>
            </div>
          </div>

          {/* ── Right: Concluding Notes + Context + Actions ── */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-1 flex-col rounded-2xl bg-surface-container-low p-5 shadow-ambient">
              <h3 className="text-[1rem] font-bold text-text">Concluding Notes</h3>
              <div className="mt-4 flex flex-1 flex-col rounded-xl border border-border/15 bg-surface-container-lowest p-4 shadow-ambient">
                <textarea
                  name="contextNote"
                  className="field min-h-[140px] flex-1 resize-y border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  placeholder="Enter final reflections on the observation session, identifying key strengths and immediate areas for intervention…"
                  rows={5}
                  value={draft.context.contextNote}
                  onChange={(e) => {
                    const next = { ...draft, context: { ...draft.context, contextNote: e.target.value } };
                    setDraft(next);
                    persistDraft(draftKey, next);
                  }}
                />
                <div className="mt-3 flex justify-end border-t border-border/10 pt-3">
                  <span className="rounded border border-border/50 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-muted">
                    Required
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border/15 bg-surface-container-lowest p-4 shadow-ambient">
                <p className="mb-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-muted">Session Context</p>
                <div className="space-y-2.5">
                  {sessionLabel && (
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[0.8125rem] text-muted">Class</span>
                      <span className="text-right text-[0.8125rem] font-semibold text-text">{sessionLabel}</span>
                    </div>
                  )}
                  {draft.context.observedAt && (
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[0.8125rem] text-muted">Date</span>
                      <span className="text-right text-[0.8125rem] font-semibold text-text">
                        {new Date(draft.context.observedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[0.8125rem] text-muted">Signals rated</span>
                    <span className="text-right text-[0.8125rem] font-semibold text-text">
                      {rated} rated{skipped > 0 ? `, ${skipped} skipped` : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={!allDone}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-6 py-3.5 text-[0.875rem] font-semibold text-on-primary shadow-sm calm-transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
                Submit Observation
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/30 bg-surface-container px-6 py-3.5 text-[0.875rem] font-medium text-text calm-transition hover:bg-surface-container-high"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                  <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back to Signals
              </button>
            </div>

            {/* Incomplete warning */}
            {!allDone && (
              <div className="flex items-center gap-2 rounded-xl border border-scale-some-border bg-scale-some-bg px-4 py-3">
                <svg className="h-4 w-4 shrink-0 text-scale-some-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-[0.8125rem] text-scale-some-text">
                  {remaining} signal{remaining !== 1 ? "s" : ""} still need a rating or skip.
                </p>
              </div>
            )}
          </div>
        </div>
      </form>
    </ObservationStageLayout>
  );
}
