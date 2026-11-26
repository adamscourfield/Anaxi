"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import type { TenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalsForPhase } from "@/modules/observations/getSignalsBySchoolType";
import { formatPhaseLabel } from "@/modules/observations/phaseLabel";
import { formatYearGroup } from "@/modules/observations/yearGroup";
import type { SignalDefinition } from "@/modules/observations/signalTypes";
import type { SubmitObservationState } from "../actions";
import { emptyDraft, loadDraft, persistDraft, type ObservationDraft } from "./observationDraft";
import { SignalMeter, shortScaleLabel } from "./SignalMeter";
import styles from "./flow.module.css";

type LabelMap = Record<string, { displayName: string; description?: string }>;

function formatDraftDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

export function ReviewList({
  draftKey,
  signals,
  labelMap,
  action,
  schoolType,
  teachers,
  priorCountByTeacherId,
}: {
  draftKey: string;
  signals: SignalDefinition[];
  labelMap: LabelMap;
  action: (state: SubmitObservationState, formData: FormData) => Promise<SubmitObservationState>;
  schoolType: TenantSchoolType;
  teachers: { id: string; fullName: string }[];
  /** Null when the viewer shouldn't see how often colleagues have been observed. */
  priorCountByTeacherId: Record<string, number> | null;
}) {
  const router = useRouter();
  const signalKeys = useMemo(() => signals.map((s) => s.key as string), [signals]);
  const [draft, setDraft] = useState<ObservationDraft>(() => emptyDraft(signalKeys));
  const [loaded, setLoaded] = useState(false);
  const [state, formAction] = useActionState(action, { error: null });

  useEffect(() => {
    setDraft(loadDraft(draftKey, signalKeys));
    setLoaded(true);
  }, [draftKey, signalKeys]);

  const ctx = draft.context;
  const hasContext = Boolean(ctx.teacherId && ctx.subject && ctx.classCode && ctx.yearGroup && ctx.observedAt);
  useEffect(() => {
    if (loaded && !hasContext) router.replace("/observe/new");
  }, [loaded, hasContext, router]);

  const phaseSignals = useMemo(() => getSignalsForPhase(ctx.phase, schoolType), [ctx.phase, schoolType]);

  if (!loaded || !hasContext) return <div className={`${styles.card} h-[520px]`} aria-busy />;

  const missing = phaseSignals.filter((s) => {
    const st = draft.signalState[s.key];
    return !st?.valueKey && !st?.notObserved;
  });
  const rated = phaseSignals.filter((s) => draft.signalState[s.key]?.valueKey).length;
  const unseen = phaseSignals.filter((s) => draft.signalState[s.key]?.notObserved).length;
  const teacher = teachers.find((t) => t.id === ctx.teacherId);
  const prior = priorCountByTeacherId ? priorCountByTeacherId[ctx.teacherId] ?? 0 : null;

  const setNote = (contextNote: string) =>
    setDraft((d) => {
      const next = { ...d, context: { ...d.context, contextNote } };
      persistDraft(draftKey, next);
      return next;
    });

  const facts: [string, string][] = [
    ["Class", ctx.classCode],
    ["Year", formatYearGroup(ctx.yearGroup)],
    ["Department", ctx.subject],
    ["Date", formatDraftDate(ctx.observedAt)],
    ["Part of lesson", ctx.phase === "UNKNOWN" ? "Several or not sure" : formatPhaseLabel(ctx.phase)],
  ];

  return (
    <form action={formAction} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <input type="hidden" name="observedTeacherId" value={ctx.teacherId} />
      <input type="hidden" name="yearGroup" value={ctx.yearGroup} />
      <input type="hidden" name="subject" value={ctx.subject} />
      <input type="hidden" name="phase" value={ctx.phase} />
      <input type="hidden" name="classCode" value={ctx.classCode} />
      <input type="hidden" name="observedAt" value={ctx.observedAt} />
      {phaseSignals.map((signal) => {
        const st = draft.signalState[signal.key];
        return (
          <span key={signal.key} hidden>
            <input type="hidden" name={`signal_${signal.key}_value`} value={st?.valueKey || ""} />
            <input type="hidden" name={`signal_${signal.key}_not`} value={st?.notObserved ? "1" : ""} />
          </span>
        );
      })}

      <div className="min-w-0 space-y-6">
        <section className={styles.card} aria-labelledby="review-signals">
          <div className="flex items-baseline justify-between gap-4 px-5 pb-3 pt-5 sm:px-5">
            <h2 id="review-signals" className="text-[15px] font-semibold">
              Signals
            </h2>
            <span className="text-[12px] text-[#6e6e73]">
              {rated} rated{unseen ? `, ${unseen} not seen` : ""}
            </span>
          </div>
          <div className={`${styles.rows} border-t border-[#f0f0f1]`}>
            {phaseSignals.map((signal, index) => {
              const st = draft.signalState[signal.key];
              const name = labelMap[signal.key]?.displayName || signal.displayNameDefault;
              const scale = st?.valueKey ? signal.scale.find((s) => s.key === st.valueKey) : null;
              return (
                <button
                  key={signal.key}
                  type="button"
                  data-review-signal
                  className={styles.row}
                  onClick={() => router.push(`/observe/new/signals?index=${index}`)}
                  aria-label={`${name}: ${scale ? scale.label : st?.notObserved ? "not seen" : "not rated"}. Change`}
                >
                  <span className={styles.rowName}>{name}</span>
                  <span className={`${styles.rowValue} flex items-center gap-2.5`} data-muted={st?.notObserved ? "" : undefined} data-missing={!scale && !st?.notObserved ? "" : undefined}>
                    {scale ? (
                      <>
                        <SignalMeter valueKey={st?.valueKey} />
                        <span className="truncate" title={scale.label}>{shortScaleLabel(st?.valueKey)}</span>
                      </>
                    ) : st?.notObserved ? (
                      "Not seen"
                    ) : (
                      "Not rated"
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={`${styles.card} p-5`}>
          <label className="block">
            <span className="mb-1 block text-[15px] font-semibold text-[#1c1c1e]">Notes for {teacher?.fullName.split(" ")[0] ?? "the teacher"}</span>
            <span className="mb-3 block text-[13px] text-[#6e6e73]">Optional. They will see these with the ratings.</span>
            <textarea
              name="contextNote"
              className={styles.input}
              rows={6}
              maxLength={5000}
              placeholder="What went well, and one thing to work on next."
              value={ctx.contextNote}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </section>
      </div>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
        <section className={styles.card} aria-labelledby="review-who">
          <div className="px-5 pb-4 pt-5">
            <h2 id="review-who" className="text-[17px] font-semibold tracking-[-0.02em]">
              {teacher?.fullName ?? "Unknown member of staff"}
            </h2>
            {prior !== null ? (
              <p className="mt-0.5 text-[13px] text-[#6e6e73]">
                {prior === 0 ? "First observation on record" : `${prior} earlier observation${prior === 1 ? "" : "s"}`}
              </p>
            ) : null}
          </div>
          <dl className={`${styles.facts} border-t border-[#f0f0f1]`}>
            {facts.map(([k, v]) => (
              <div key={k} className={styles.fact}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-[#f0f0f1] px-5 py-3">
            <button
              type="button"
              className="text-[13px] font-medium text-[#3a3a3c] underline-offset-4 hover:text-[#1c1c1e] hover:underline"
              onClick={() => router.push("/observe/new")}
            >
              Edit lesson details
            </button>
          </div>
        </section>

        {state.error ? (
          <p role="alert" className={styles.error}>
            {state.error}
          </p>
        ) : missing.length ? (
          <p role="status" className={styles.error}>
            {missing.length === 1 ? "1 signal still needs" : `${missing.length} signals still need`} a rating or “Didn&apos;t see this”.
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <SubmitButton className="h-11 min-h-0 w-full" pendingLabel="Saving…" disabled={missing.length > 0}>
            Save observation
          </SubmitButton>
          <Button
            type="button"
            variant="secondary"
            className="h-11 min-h-0 w-full"
            onClick={() => router.push(`/observe/new/signals?index=${Math.max(phaseSignals.length - 1, 0)}`)}
          >
            Back to signals
          </Button>
        </div>
      </aside>
    </form>
  );
}
