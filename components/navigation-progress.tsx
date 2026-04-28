"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin top bar — visible during route transitions so clicks feel acknowledged.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const routeKey = pathname;
  const [phase, setPhase] = useState<"hidden" | "run" | "done">("hidden");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevKey = useRef(routeKey);

  useEffect(() => {
    if (prevKey.current === routeKey) return;
    prevKey.current = routeKey;

    if (timerRef.current) clearTimeout(timerRef.current);

    setPhase("run");

    timerRef.current = setTimeout(() => {
      setPhase("done");
      timerRef.current = setTimeout(() => setPhase("hidden"), 280);
    }, 120);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [routeKey]);

  if (phase === "hidden") return null;

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-[3px] overflow-hidden bg-transparent motion-reduce:hidden"
      aria-hidden
    >
      <div
        className={`h-full origin-left rounded-none bg-gradient-to-r from-[var(--primary)] via-[var(--primary-container)] to-[var(--primary)] ${
          phase === "run" ? "animate-nav-run" : "animate-nav-finish"
        }`}
      />
    </div>
  );
}
