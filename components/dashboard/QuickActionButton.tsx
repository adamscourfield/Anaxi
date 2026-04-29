"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { ReactNode } from "react";

type QuickActionItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

export function QuickActionButton({ items }: { items: QuickActionItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Quick actions menu"
        className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-on-primary calm-transition anx-card-elevated hover:bg-primaryBtnHover hover:shadow-md active:scale-[0.98]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden>
          <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        Quick Action
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-border/80 bg-surface-container-lowest p-1.5 shadow-lg">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-text calm-transition hover:bg-[var(--surface-container-low)]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-muted [&_svg]:h-4 [&_svg]:w-4">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
