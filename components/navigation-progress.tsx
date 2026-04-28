"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const routeKey = pathname;
  const [phase, setPhase] = useState<"idle" | "run" | "finish">("idle");
  const prevKey = useRef(routeKey);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevKey.current === routeKey) return;
    prevKey.current = routeKey;
    if (finishTimer.current) clearTimeout(finishTimer.current);
    setPhase("run");
    const t1 = setTimeout(() => setPhase("finish"), 240);
    finishTimer.current = setTimeout(() => {
      setPhase("idle");
      finishTimer.current = null;
    }, 520);
    return () => {
      clearTimeout(t1);
    };
  }, [routeKey]);

  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
    },
    [],
  );

  if (phase === "idle") return null;

  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[99] h-[3px] w-full overflow-hidden motion-reduce:hidden"
      aria-hidden
    >
      <div
        className={`h-full origin-left bg-gradient-to-r from-primary via-primary-container to-primary ${
          phase === "run" ? "motion-safe:animate-nav-run" : "motion-safe:animate-nav-finish"
        }`}
      />
    </div>
  );
}
