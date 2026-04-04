"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearDraft, loadDraft, persistDraft, ScaleKey } from "./observationDraft";
import { SignalHelpSheet } from "./SignalHelpSheet";
import { SignalTileGroup } from "./SignalTileGroup";

type Signal = {
  key: string;
  order: number;
  displayNameDefault: string;
  descriptionDefault: string;
  lookFors?: string[];
  scaleGuidance: Record<string, string>;
  scale: { key: string; label: string; description: string }[];
  phaseRelevance: string[];
  isUniversal: boolean;
};

type LabelMap = Record<string, { displayName: string; description?: string }>;

export function SignalFlowScreen({
  draftKey,
  signals,
  labelMap,
}: {
  draftKey: string;
  signals: Signal[];
  labelMap: LabelMap;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendingValue, setPendingValue] = useState<ScaleKey | null>(null);
  const [pendingNotObserved, setPendingNotObserved] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const orderedByOrder = useMemo(() => [...signals].sort((a, b) => a.order - b.order), [signals]);
  const signalKeys = useMemo(() => orderedByOrder.map((s) => s.key), [orderedByOrder]);
  const [draft, setDraft] = useState(() => loadDraft(draftKey, signalKeys));

  const hasContext = Boolean(
    draft.context.teacherId &&
    (draft.context.department || draft.context.subject) &&
    (draft.context.classCode || draft.context.yearGroup)
  );

  const orderedSignals = useMemo(
    () => orderedByOrder.filter((s) => s.phaseRelevance.includes(draft.context.phase)),
    [draft.context.phase, orderedByOrder]
  );

  const total = orderedSignals.length;
  const currentIndex = Math.max(0, Math.min(Number(params.get("index") || "0"), Math.max(total - 1, 0)));
  const currentSignal = orderedSignals[currentIndex];

  useEffect(() => {
    const saved = draft.signalState[currentSignal?.key];
    if (saved?.notObserved) {
      setPendingNotObserved(true);
      setPendingValue(null);
    } else if (saved?.valueKey) {
      setPendingValue(saved.valueKey);
      setPendingNotObserved(false);
    } else {
      setPendingValue(null);
      setPendingNotObserved(false);
    }
  }, [currentIndex, currentSignal?.key, draft.signalState]);

  if (!hasContext) {
    router.replace("/observe/new");
    return null;
  }

  const goToIndex = (index: number) =>
    router.push(`/observe/new/signals?index=${Math.max(0, Math.min(index, total - 1))}`);

  const advance = () => {
    if (currentIndex + 1 >= total) {
      router.push("/observe/new/review");
    } else {
      goToIndex(currentIndex + 1);
    }
  };

  const updateDraft = (updated: typeof draft) => {
    setDraft(updated);
    persistDraft(draftKey, updated);
  };

  const confirmAndAdvance = () => {
    const entry = pendingNotObserved
      ? { valueKey: null, notObserved: true }
      : { valueKey: pendingValue, notObserved: false };
    updateDraft({
      ...draft,
      signalState: { ...draft.signalState, [currentSignal.key]: entry },
    });
    advance();
  };

  const skipSignal = () => {
    updateDraft({
      ...draft,
      signalState: {
        ...draft.signalState,
        [currentSignal.key]: { valueKey: null, notObserved: true },
      },
    });
    advance();
  };

  const hasSelection = pendingValue !== null || pendingNotObserved;
  const isLastSignal = currentIndex === total - 1;

  const override = labelMap[currentSignal.key];
  const title = override?.displayName || currentSignal.displayNameDefault;
  const description = override?.description || currentSignal.descriptionDefault;

  const scaleRows = currentSignal.scale.map((scale) => ({
    label: scale.label,
    guidance: currentSignal.scaleGuidance[scale.key],
  }));

  const scaleOptions = currentSignal.scale.map((scale) => ({
    key: scale.key,
    label: scale.label,
    guidance: currentSignal.scaleGuidance[scale.key] || scale.description,
  }));

  return (
    <div className="w-full min-w-0 max-w-3xl py-8 md:mx-auto">
      {/* Page header */}
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[1.875rem] font-bold tracking-tight text-text leading-tight">{title}</h1>
          <span className="text-[0.9375rem] text-muted font-medium">
            Signal {currentIndex + 1} of {total}
          </span>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container text-muted calm-transition hover:bg-surface-container-high hover:text-text"
            aria-label="Signal guide"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M6.5 6.5a1.5 1.5 0 1 1 1.5 1.5v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
            </svg>
          </button>
        </div>
        <span className="shrink-0 text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-muted pt-2">
          Stage 2: Signal Assessment
        </span>
      </div>

      {/* Stage progress bar */}
      <div className="mb-8 flex items-center gap-1.5">
        {[1, 2, 3].map((stage) => (
          <div
            key={stage}
            className={`h-1.5 flex-1 rounded-full ${
              stage <= 2 ? "bg-text" : "bg-border/30"
            }`}
          />
        ))}
      </div>

      {/* Main card */}
      <div className="rounded-2xl border border-border/20 bg-surface-container-lowest px-4 py-6 shadow-ambient sm:px-8 sm:py-7">
        <h2 className="mb-2 text-[1.375rem] font-bold tracking-tight text-text">
          How would you assess {title}?
        </h2>
        <p className="mb-7 text-[0.875rem] leading-relaxed text-muted">{description}</p>

        <SignalTileGroup
          options={scaleOptions}
          selected={pendingValue}
          onSelect={(value) => {
            setPendingValue(value as ScaleKey);
            setPendingNotObserved(false);
          }}
        />
      </div>

      {/* Bottom navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={skipSignal}
          className="text-[0.875rem] font-medium text-muted calm-transition hover:text-text"
        >
          Skip this Signal
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (currentIndex > 0) goToIndex(currentIndex - 1);
              else router.push("/observe/new");
            }}
            className="rounded-xl border border-border px-5 py-2.5 text-[0.875rem] font-medium text-text calm-transition hover:bg-surface-container"
          >
            Back
          </button>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={confirmAndAdvance}
            className="flex items-center gap-2 rounded-xl bg-text px-6 py-2.5 text-[0.875rem] font-semibold text-surface calm-transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLastSignal ? "Review & Submit" : "Next Signal"}
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Help sheet */}
      <SignalHelpSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        description={description}
        lookFors={currentSignal.lookFors}
        scaleRows={scaleRows}
      />
    </div>
  );
}
