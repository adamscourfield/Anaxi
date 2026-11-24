"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAVIGATION_START_EVENT, type NavigationStartDetail } from "@/lib/navigation-events";
import styles from "./navigation-progress.module.css";

/** Navigations that finish sooner than this never show anything, so fast pages don't flicker. */
const SHOW_DELAY_MS = 120;
/** The "Loading page" pill only appears once a page is genuinely slow. */
const PILL_DELAY_MS = 700;
/** Give up if a navigation never lands (e.g. it was cancelled or errored). */
const FAILSAFE_MS = 20_000;

type Phase = "idle" | "loading" | "done";

function currentKey() {
  return window.location.pathname + window.location.search;
}

function targetKey(url: string) {
  try {
    const u = new URL(url, window.location.href);
    if (u.origin !== window.location.origin) return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}

/**
 * Page-change indicator: a slim bar across the top of the window, plus a small
 * "Loading page" pill if the page takes a while. Starts on every app-router
 * navigation (see instrumentation-client.ts) and finishes when the URL lands.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [showPill, setShowPill] = useState(false);
  const pending = useRef(false);
  const shown = useRef(false);
  const timers = useRef<number[]>([]);

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function finish() {
    if (!pending.current) return;
    pending.current = false;
    clearTimers();
    setShowPill(false);
    if (!shown.current) return; // finished before it was ever shown
    shown.current = false;
    setPhase("done");
    setProgress(100);
    later(() => {
      setPhase("idle");
      setProgress(0);
    }, 320);
  }

  useEffect(() => {
    function onStart(e: Event) {
      const { url } = (e as CustomEvent<NavigationStartDetail>).detail;
      const target = targetKey(url);
      // Hash-only jumps and links to the page you're already on don't load anything.
      if (target === null || target === currentKey()) return;
      clearTimers();
      pending.current = true;
      later(() => {
        if (!pending.current) return;
        shown.current = true;
        setPhase("loading");
        setProgress(12);
        // Ease towards 90% while we wait; the last 10% is reserved for the page landing.
        const tick = () => {
          if (!pending.current) return;
          setProgress((p) => p + (90 - p) * 0.12);
          later(tick, 300);
        };
        later(tick, 200);
      }, SHOW_DELAY_MS);
      later(() => pending.current && setShowPill(true), PILL_DELAY_MS);
      later(finish, FAILSAFE_MS);
    }
    window.addEventListener(NAVIGATION_START_EVENT, onStart);
    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, onStart);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The new URL has rendered: complete the bar.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  return (
    <>
      <div
        className={styles.bar}
        data-phase={phase}
        style={{ transform: `scaleX(${progress / 100})` }}
        aria-hidden
      />
      <div className={styles.pill} data-visible={showPill} role="status" aria-live="polite">
        {showPill ? (
          <>
            <span className={styles.spinner} aria-hidden />
            Loading page…
          </>
        ) : null}
      </div>
    </>
  );
}
