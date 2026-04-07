"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { H2, H3, MetaText, Label } from "@/components/ui/typography";
import type { TenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalsForPhase } from "@/modules/observations/getSignalsBySchoolType";
import type { Phase } from "./observationDraft";
import { SignalCard } from "./SignalCard";

type Teacher = { id: string; fullName: string; email: string };
type Signal = {
  key: string;
  order: number;
  displayNameDefault: string;
  descriptionDefault: string;
  lookFors?: string[];
  scale: { key: string; label: string; description: string }[];
  scaleGuidance: Record<string, string>;
  phaseRelevance: string[];
  isUniversal: boolean;
};

type LabelMap = Record<string, { displayName: string; description?: string }>;
type SignalEntry = { valueKey: string | null; notObserved: boolean };

type ObservationContext = {
  observedTeacherId: string;
  yearGroup: string;
  subject: string;
  phase: Phase;
  observedAt: string;
  classCode: string;
  contextNote: string;
};

const PHASE_OPTIONS: Phase[] = [
  "THRESHOLD",
  "INSTRUCTION",
  "GUIDED_PRACTICE",
  "INDEPENDENT_PRACTICE",
  "UNKNOWN",
  "BOOKS",
];

export function ObservationWizard({
  teachers,
  signals,
  labelMap,
  action,
  schoolType = "SECONDARY",
}: {
  teachers: Teacher[];
  signals: Signal[];
  labelMap: LabelMap;
  action: (formData: FormData) => void;
  schoolType?: TenantSchoolType;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [toast, setToast] = useState<string>("");
  const [submitError, setSubmitError] = useState<string>("");
  const [context, setContext] = useState<ObservationContext>({
    observedTeacherId: "",
    yearGroup: "",
    subject: "",
    phase: "UNKNOWN",
    observedAt: "",
    classCode: "",
    contextNote: "",
  });
  const [signalState, setSignalState] = useState<Record<string, SignalEntry>>(() =>
    Object.fromEntries(signals.map((signal) => [signal.key, { valueKey: null, notObserved: false }]))
  );

  const orderedSignals = useMemo(() => [...signals].sort((a, b) => a.order - b.order), [signals]);

  const completed = useMemo(
    () => orderedSignals.filter((signal) => signalState[signal.key]?.valueKey !== null || signalState[signal.key]?.notObserved).length,
    [orderedSignals, signalState]
  );

  const allDone = completed === orderedSignals.length;

  const phaseFocus = useMemo(
    () => getSignalsForPhase(context.phase, schoolType) as Signal[],
    [context.phase, schoolType]
  );
  const phaseFocusKeys = useMemo(() => new Set(phaseFocus.map((s) => s.key)), [phaseFocus]);
  const otherSignals = useMemo(
    () => orderedSignals.filter((signal) => !phaseFocusKeys.has(signal.key)),
    [orderedSignals, phaseFocusKeys]
  );
  const flowOrder = useMemo(() => [...phaseFocus, ...otherSignals], [phaseFocus, otherSignals]);

  const setTransientToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2000);
  };

  const nextFocus = (currentKey: string) => {
    const idx = flowOrder.findIndex((signal) => signal.key === currentKey);
    const next = flowOrder[idx + 1];
    if (!next) return;
    const element = document.getElementById(`signal-${next.key}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const markRemaining = () => {
    let changed = 0;
    setSignalState((current) => {
      const next = { ...current };
      for (const signal of orderedSignals) {
        const currentEntry = next[signal.key];
        if (!currentEntry.valueKey && !currentEntry.notObserved) {
          next[signal.key] = { valueKey: null, notObserved: true };
          changed += 1;
        }
      }
      return next;
    });
    setTransientToast(`Marked ${changed} signals as Not Observed.`);
  };

  const clearAllNotObserved = () => {
    let changed = 0;
    setSignalState((current) => {
      const next = { ...current };
      for (const signal of orderedSignals) {
        const currentEntry = next[signal.key];
        if (!currentEntry.valueKey && currentEntry.notObserved) {
          next[signal.key] = { valueKey: null, notObserved: false };
          changed += 1;
        }
      }
      return next;
    });
    setTransientToast(changed ? "Cleared Not Observed." : "No Not Observed signals to clear.");
  };

  const renderSignalList = (sectionSignals: Signal[]) => (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {sectionSignals.map((signal) => {
        const override = labelMap[signal.key];
        const displayName = override?.displayName || signal.displayNameDefault;
        const description = override?.description || signal.descriptionDefault;
        const entry = signalState[signal.key];

        return (
          <div key={signal.key}>
            <input type="hidden" name={`signal_${signal.key}_value`} value={entry?.valueKey || ""} />
            <input type="hidden" name={`signal_${signal.key}_not`} value={entry?.notObserved ? "1" : ""} />
            <SignalCard
              id={`signal-${signal.key}`}
              title={displayName}
              description={description}
              lookFors={signal.lookFors}
              scaleGuidance={signal.scaleGuidance}
              options={signal.scale}
              value={entry?.valueKey || ""}
              notObserved={Boolean(entry?.notObserved)}
              unanswered={!entry?.valueKey && !entry?.notObserved}
              onValue={(value) => {
                setSignalState((current) => ({
                  ...current,
                  [signal.key]: { valueKey: value, notObserved: false }
                }));
                setSubmitError("");
                nextFocus(signal.key);
              }}
              onNotObserved={(checked) => {
                setSignalState((current) => ({
                  ...current,
                  [signal.key]: { valueKey: checked ? null : current[signal.key].valueKey, notObserved: checked }
                }));
                if (checked) setSubmitError("");
              }}
            />
          </div>
        );
      })}
    </div>
  );

  const canContinue = Boolean(context.observedTeacherId && context.yearGroup && context.subject && context.observedAt);

  return (
    <form
      action={action}
      className="panel space-y-5 p-5"
      onSubmit={(event) => {
        if (!allDone) {
          event.preventDefault();
          setSubmitError("Please complete all signals (value or Not Observed).");
        }
      }}
    >
      {step === 1 ? (
        <section className="max-w-3xl space-y-5">
          <H2>Step 1 &middot; Context</H2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Observed teacher</Label>
              <select
                name="observedTeacherId"
                className="field"
                required
                value={context.observedTeacherId}
                onChange={(event) => setContext((current) => ({ ...current, observedTeacherId: event.target.value }))}
              >
                <option value="">Select teacher</option>
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName} ({teacher.email})</option>)}
              </select>
            </div>

            <div>
              <Label>Year group</Label>
              <input
                name="yearGroup"
                className="field"
                required
                value={context.yearGroup}
                onChange={(event) => setContext((current) => ({ ...current, yearGroup: event.target.value }))}
              />
            </div>

            <div>
              <Label>Subject</Label>
              <input
                name="subject"
                className="field"
                required
                value={context.subject}
                onChange={(event) => setContext((current) => ({ ...current, subject: event.target.value }))}
              />
            </div>

            <div>
              <Label>Observed at</Label>
              <input
                type="datetime-local"
                name="observedAt"
                className="field"
                required
                value={context.observedAt}
                onChange={(event) => setContext((current) => ({ ...current, observedAt: event.target.value }))}
              />
            </div>

            <div>
              <Label>Class code <span className="font-normal text-muted">(optional)</span></Label>
              <input
                name="classCode"
                className="field"
                value={context.classCode}
                onChange={(event) => setContext((current) => ({ ...current, classCode: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label>Phase</Label>
            <div className="flex flex-wrap gap-2">
              {PHASE_OPTIONS.map((phase) => (
                <label
                  key={phase}
                  className={`calm-transition cursor-pointer rounded-xl border px-3 py-2 text-xs font-medium ${
                    context.phase === phase
                      ? "border-accent/30 bg-[var(--accent-tint)] text-text"
                      : "border-border/60 text-muted hover:border-border hover:text-text"
                  }`}
                >
                  <input
                    type="radio"
                    name="phase"
                    value={phase}
                    checked={context.phase === phase}
                    onChange={(event) => setContext((current) => ({ ...current, phase: event.target.value as Phase }))}
                    className="sr-only"
                  />
                  {phase.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>

          <Button
            type="button"
            disabled={!canContinue}
            onClick={() => setStep(2)}
            className="w-full sm:w-auto"
          >
            Continue to signals
          </Button>
        </section>
      ) : (
        <section className="space-y-5">
          <input type="hidden" name="observedTeacherId" value={context.observedTeacherId} />
          <input type="hidden" name="yearGroup" value={context.yearGroup} />
          <input type="hidden" name="subject" value={context.subject} />
          <input type="hidden" name="phase" value={context.phase} />
          <input type="hidden" name="observedAt" value={context.observedAt} />
          <input type="hidden" name="classCode" value={context.classCode} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <H2>Step 2 &middot; Signals</H2>
            <MetaText className="font-medium">{completed}/{orderedSignals.length} completed</MetaText>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={markRemaining}>Mark remaining as Not Observed</Button>
            <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={clearAllNotObserved}>Clear all Not Observed</Button>
          </div>
          {toast ? <MetaText className="text-accent">{toast}</MetaText> : null}

          <section className="space-y-3">
            <H3>Phase focus</H3>
            {renderSignalList(phaseFocus)}
          </section>

          <details className="space-y-3">
            <summary className="cursor-pointer text-sm font-semibold text-text calm-transition hover:text-accent">Other signals</summary>
            <div className="pt-2">{otherSignals.length ? renderSignalList(otherSignals) : <MetaText>No remaining signals.</MetaText>}</div>
          </details>

          <div className="sticky bottom-0 rounded-2xl border border-border/70 bg-surface/95 p-4 shadow-md backdrop-blur-sm">
            <Label>Context note <span className="font-normal text-muted">(optional)</span></Label>
            <input
              name="contextNote"
              className="field mb-3"
              placeholder="Optional short note"
              value={context.contextNote}
              onChange={(event) => setContext((current) => ({ ...current, contextNote: event.target.value }))}
            />
            {submitError ? (
              <div className="mb-3 rounded-xl border border-error/20 bg-[var(--pill-error-bg)] px-3 py-2">
                <MetaText className="text-[var(--pill-error-text)]">{submitError}</MetaText>
              </div>
            ) : null}
            <Button disabled={!allDone} type="submit" className="w-full">Submit observation</Button>
          </div>
        </section>
      )}
    </form>
  );
}
