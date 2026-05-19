"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type TodaySummaryChip = {
  label: string;
  value: string | number;
  href?: string;
  tone?: "default" | "critical" | "warning";
};

function toneClass(tone: TodaySummaryChip["tone"]) {
  if (tone === "critical") return "text-[var(--error)]";
  if (tone === "warning") return "text-[var(--warning)]";
  return "text-text";
}

export function LeadershipTodayBar({ chips }: { chips: TodaySummaryChip[] }) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = document.getElementById("home-today-summary-sentinel");
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setStuck(!entry?.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (chips.length === 0) return null;

  return (
    <>
      <span id="home-today-summary-sentinel" className="block h-0 w-full" aria-hidden />
      <div
        className={`sticky top-0 z-20 -mx-1 mb-2 border-b border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-lowest)_92%,transparent)] px-1 py-2 backdrop-blur-md calm-transition ${
          stuck ? "shadow-sm" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Today</span>
          {chips.map((chip) => {
            const inner = (
              <>
                <span className="text-muted">{chip.label}</span>
                <span className={`font-semibold tabular-nums ${toneClass(chip.tone)}`}>{chip.value}</span>
              </>
            );
            if (chip.href) {
              return (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs calm-transition hover:bg-[var(--surface-container-low)]"
                >
                  {inner}
                </Link>
              );
            }
            return (
              <span key={chip.label} className="inline-flex items-center gap-1.5 text-xs">
                {inner}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}
