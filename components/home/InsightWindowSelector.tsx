"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const ALLOWED = [7, 14, 21, 28] as const;
const COOKIE_NAME = "anaxi_insight_window";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function persistWindow(days: number) {
  document.cookie = `${COOKIE_NAME}=${days}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function InsightWindowSelector({
  windowDays,
  extraQuery,
}: {
  windowDays: number;
  /** e.g. `dept=abc` — preserved when switching window */
  extraQuery?: string;
}) {
  const router = useRouter();

  function hrefFor(w: number): string {
    const base = `/home?window=${w}`;
    if (!extraQuery) return base;
    return `${base}&${extraQuery}`;
  }

  function onSelect(w: number, e: React.MouseEvent) {
    persistWindow(w);
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.push(hrefFor(w));
  }

  return (
    <div
      className="segmented-toggle home-pulse-window-toggle touch-manipulation"
      role="group"
      aria-label="Analysis window length"
    >
      {ALLOWED.map((w) => (
        <Link
          key={w}
          href={hrefFor(w)}
          onClick={(e) => onSelect(w, e)}
          className={`segmented-toggle-btn touch-manipulation ${windowDays === w ? "segmented-toggle-btn-active" : ""}`}
        >
          {w}d
        </Link>
      ))}
    </div>
  );
}
