"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalsForPhase } from "@/modules/observations/getSignalsBySchoolType";
import type { SignalDefinition } from "@/modules/observations/signalTypes";
import { emptyDraft, loadDraft, persistDraft, type ObservationDraft, type ScaleKey } from "./observationDraft";
import { SignalMeter as Meter } from "./SignalMeter";
import styles from "./flow.module.css";

type LabelMap = Record<string, { displayName: string; description?: string }>;

/** One signal per screen. Each choice is saved to the draft straight away. */
export function SignalFlowScreen({
  draftKey,
  signals,
  labelMap,
  schoolType,
}: {
  draftKey: string;
  signals: SignalDefinition[];
  labelMap: LabelMap;
  schoolType: TenantSchoolType;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const signalKeys = useMemo(() => signals.map((s) => s.key as string), [signals]);
  const [draft, setDraft] = useState<ObservationDraft>(() => emptyDraft(signalKeys));
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(() => Math.max(0, Number(params.get("index")) || 0));
  const headingRef = useRef<HTMLHeadingElement>(null);

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
  const total = phaseSignals.length;
  const current = Math.min(index, Math.max(total - 1, 0));
  const signal = phaseSignals[current];
  const entry = signal ? draft.signalState[signal.key] : undefined;

  // Keep the address in step so a refresh lands on the same signal, without a server round trip.
  useEffect(() => {
    if (!loaded) return;
    const url = `/observe/new/signals?index=${current}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [current, loaded]);

  const go = useCallback(
    (next: number) => {
      if (next >= total) {
        router.push("/observe/new/review");
        return;
      }
      setIndex(Math.max(0, next));
      requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, total],
  );

  const save = useCallback(
    (key: string, value: { valueKey: ScaleKey | null; notObserved: boolean }) => {
      setDraft((d) => {
        const next = { ...d, signalState: { ...d.signalState, [key]: value } };
        persistDraft(draftKey, next);
        return next;
      });
    },
    [draftKey],
  );

  const answered = Boolean(entry?.valueKey || entry?.notObserved);
  const isLast = current === total - 1;

  // Number keys pick a rating, Enter moves on. Ignored while typing elsewhere.
  useEffect(() => {
    if (!signal) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || target?.closest("input, textarea, select, [role=dialog]")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= signal.scale.length) {
        e.preventDefault();
        save(signal.key, { valueKey: signal.scale[n - 1].key as ScaleKey, notObserved: false });
      } else if (e.key === "Enter" && answered && target?.tagName !== "BUTTON") {
        e.preventDefault();
        go(current + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signal, answered, current, go, save]);

  if (!loaded || !hasContext || !signal) return <div className={`${styles.card} h-[520px]`} aria-busy />;

  const override = labelMap[signal.key];
  const title = override?.displayName || signal.displayNameDefault;
  const description = override?.description || signal.descriptionDefault;
  const done = phaseSignals.filter((s) => draft.signalState[s.key]?.valueKey || draft.signalState[s.key]?.notObserved).length;

  return (
    <div className="space-y-4">
      <section className={`${styles.card} p-6 sm:p-7`} aria-labelledby="signal-title">
        <div className="flex items-center justify-between gap-4 text-[13px] text-[#6e6e73]">
          <span>
            Signal {current + 1} of {total}
          </span>
          <span>{done} answered</span>
        </div>
        <div className="mt-3 flex gap-1" aria-hidden>
          {phaseSignals.map((s, i) => {
            const st = draft.signalState[s.key];
            const filled = st?.valueKey || st?.notObserved;
            return (
              <span
                key={s.key}
                className={`h-1 flex-1 rounded-full ${i === current ? "bg-[#1c1c1e]" : filled ? "bg-[#8e8e93]" : "bg-[#ececee]"}`}
              />
            );
          })}
        </div>

        <h2
          id="signal-title"
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 text-[22px] font-semibold leading-tight tracking-[-0.025em] outline-none"
        >
          {title}
        </h2>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-[#6e6e73]">{description}</p>

        {signal.lookFors?.length ? (
          <details className="group mt-4 text-[13px]">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-medium text-[#3a3a3c] hover:text-[#1c1c1e] [&::-webkit-details-marker]:hidden">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" aria-hidden>
                <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              What to look for
            </summary>
            <ul className="mt-2 space-y-1 pl-5 text-[#3a3a3c]">
              {signal.lookFors.map((item) => (
                <li key={item} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className={`${styles.choices} mt-6 grid-cols-1 sm:grid-cols-2`} role="radiogroup" aria-labelledby="signal-title">
          {signal.scale.map((option, i) => {
            const selected = entry?.valueKey === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={selected}
                data-signal-rating
                className={styles.choice}
                onClick={() => save(signal.key, { valueKey: option.key as ScaleKey, notObserved: false })}
              >
                <span className={styles.choiceTitle}>
                  <span className="flex items-center gap-2.5">
                    <Meter level={i + 1} />
                    {option.label}
                  </span>
                  <span className={styles.radio} aria-hidden />
                </span>
                <span className={styles.choiceBody}>{signal.scaleGuidance[option.key] || option.description}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-pressed={Boolean(entry?.notObserved)}
          className={`${styles.choice} mt-2 py-2.5 text-[13px] font-medium text-[#3a3a3c]`}
          onClick={() => {
            save(signal.key, { valueKey: null, notObserved: true });
            go(current + 1);
          }}
        >
          <span className={styles.choiceTitle}>
            <span>Didn&apos;t see this</span>
            <span className={styles.radio} aria-hidden />
          </span>
        </button>
      </section>

      <div className={styles.footer}>
        <Button
          type="button"
          variant="secondary"
          className="h-10 min-h-0 px-5"
          onClick={() => (current > 0 ? go(current - 1) : router.push("/observe/new"))}
        >
          {current > 0 ? "Previous signal" : "Lesson details"}
        </Button>
        <Button type="button" className="h-10 min-h-0 px-5" disabled={!answered} onClick={() => go(current + 1)}>
          {isLast ? "Review" : "Next signal"}
        </Button>
      </div>
      <p className="hidden text-center text-[12px] text-[#a1a1aa] sm:block">
        Press 1 to {signal.scale.length} to rate, then Enter to move on.
      </p>
    </div>
  );
}
