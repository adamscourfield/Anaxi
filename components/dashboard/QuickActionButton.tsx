"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { ReactNode } from "react";

type QuickActionItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 639px)").matches;
}

export function QuickActionButton({ items }: { items: QuickActionItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mobileMenuTop, setMobileMenuTop] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setMobileMenuTop(null);
      return;
    }

    function positionPanel() {
      if (!isNarrowViewport() || !buttonRef.current) {
        setMobileMenuTop(null);
        return;
      }
      const rect = buttonRef.current.getBoundingClientRect();
      setMobileMenuTop(rect.bottom + 8);
    }

    positionPanel();

    const mq = window.matchMedia("(max-width: 639px)");
    mq.addEventListener("change", positionPanel);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      mq.removeEventListener("change", positionPanel);
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  if (items.length === 0) return null;

  const useMobilePanel = mobileMenuTop !== null;
  const panelStyle: CSSProperties | undefined = useMobilePanel ? { top: mobileMenuTop } : undefined;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Quick actions menu"
        className="inline-flex h-11 max-sm:min-h-[44px] touch-manipulation items-center gap-2 rounded-md bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-on-primary calm-transition anx-card-elevated hover:bg-primaryBtnHover hover:shadow-md max-sm:px-3 max-sm:py-2 max-sm:text-[13px] active:scale-[0.98]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0" aria-hidden>
          <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">+ Quick Action</span>
        <span className="sm:hidden">Quick</span>
      </button>
      {open ? (
        <div
          role="menu"
          className={
            useMobilePanel
              ? "fixed left-4 right-4 z-[70] max-h-[min(70vh,calc(100dvh-8rem))] overflow-y-auto overscroll-contain rounded-2xl border border-border/80 bg-surface-container-lowest p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-lg"
              : "absolute right-0 top-full z-[70] mt-2 w-56 rounded-2xl border border-border/80 bg-surface-container-lowest p-1.5 shadow-lg"
          }
          style={panelStyle}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center gap-3 rounded-xl px-4 py-3 text-sm text-text calm-transition hover:bg-[var(--surface-container-low)] sm:min-h-0 sm:py-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container-low)] text-muted [&_svg]:h-4 [&_svg]:w-4">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
