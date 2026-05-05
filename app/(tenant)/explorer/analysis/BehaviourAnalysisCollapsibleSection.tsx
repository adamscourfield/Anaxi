"use client";

import { type ReactNode, useState } from "react";

type Props = {
  title: string;
  subtitle: ReactNode;
  countPill: ReactNode;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function BehaviourAnalysisCollapsibleSection({
  title,
  subtitle,
  countPill,
  icon,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-border/30 bg-surface-container-lowest shadow-[0_2px_16px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left calm-transition hover:bg-surface-container-low/60 sm:gap-4 sm:px-6 sm:py-5"
        aria-expanded={open}
      >
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.8125rem] font-bold uppercase tracking-[0.06em] text-text">{title}</h2>
          <div className="mt-1 max-w-3xl text-[0.8125rem] leading-relaxed text-muted">{subtitle}</div>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          {countPill}
          <svg
            className={`h-5 w-5 shrink-0 text-muted calm-transition ${open ? "-rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? <div className="border-t border-border/25">{children}</div> : null}
    </div>
  );
}
