import type { ReactNode } from "react";

/**
 * Sidebar icons, drawn as one set.
 *
 * Rules every icon follows, so they sit together:
 * - 20 × 20 grid, drawn inside the 3–17 square (14 units), optically centred on 10,10
 * - outline only, one 1.25 stroke, round caps and joins (set once on the wrapper below)
 * - rectangles use a corner radius of 2; small details (dots, ticks) no shorter than 1.5
 * - one idea per icon, no more than three shapes, so they read at 18px
 */
const ICONS: Record<string, ReactNode> = {
  // Overview
  home: <path d="M3.5 9 10 3.75 16.5 9v6.25a1.25 1.25 0 0 1-1.25 1.25H12.5v-4.5h-5v4.5H4.75A1.25 1.25 0 0 1 3.5 15.25V9Z" />,
  "check-square": (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="m7 10.25 2.1 2.1L13.25 8" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="5.25" height="5.25" rx="1.5" />
      <rect x="11.25" y="3.5" width="5.25" height="5.25" rx="1.5" />
      <rect x="3.5" y="11.25" width="5.25" height="5.25" rx="1.5" />
      <rect x="11.25" y="11.25" width="5.25" height="5.25" rx="1.5" />
    </>
  ),

  // Instruction
  eye: (
    <>
      <path d="M2.75 10S5.5 4.75 10 4.75 17.25 10 17.25 10 14.5 15.25 10 15.25 2.75 10 2.75 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </>
  ),
  history: (
    <>
      <path d="M3.75 10a6.25 6.25 0 1 0 1.8-4.4" />
      <path d="M3.5 3.5v2.75h2.75" />
      <path d="M10 6.75V10l2.25 1.5" />
    </>
  ),

  // Students
  chart: (
    <>
      <path d="M3.5 16.5h13" />
      <path d="M6 13.5V10M10 13.5V5.5M14 13.5V8" />
    </>
  ),
  cap: (
    <>
      <path d="M10 4.5 2.75 8 10 11.5 17.25 8 10 4.5Z" />
      <path d="M5.5 9.5v3.25c0 1.1 2 2.25 4.5 2.25s4.5-1.15 4.5-2.25V9.5" />
      <path d="M17.25 8v4.25" />
    </>
  ),
  board: (
    <>
      <rect x="3.5" y="3.5" width="13" height="9.5" rx="2" />
      <path d="M7.5 16.5 10 13l2.5 3.5" />
      <path d="M6.75 7h4.5M6.75 9.5h6.5" />
    </>
  ),
  flag: (
    <>
      <path d="M4.75 17V3.5" />
      <path d="M4.75 4.25h11l-2.5 3.75 2.5 3.75h-11" />
    </>
  ),

  // Operations
  calendar: (
    <>
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
      <path d="M7 3v3M13 3v3M3.5 8.75h13" />
    </>
  ),
  suitcase: (
    <>
      <rect x="3.5" y="6.5" width="13" height="10" rx="2" />
      <path d="M7.5 6.5V4.75c0-.7.55-1.25 1.25-1.25h2.5c.7 0 1.25.55 1.25 1.25V6.5" />
      <path d="M7.5 9.5v4M12.5 9.5v4" />
    </>
  ),
  target: (
    <>
      <circle cx="10" cy="10" r="6.75" />
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 10h.01" />
    </>
  ),

  // Administration
  gear: (
    <>
      <path d="M8.5 3.25h3l.5 1.8 1.25.7 1.8-.55 1.5 2.6-1.3 1.35v1.4l1.3 1.35-1.5 2.6-1.8-.55-1.25.7-.5 1.8h-3l-.5-1.8-1.25-.7-1.8.55-1.5-2.6 1.3-1.35v-1.4l-1.3-1.35 1.5-2.6 1.8.55L8 5.05l.5-1.8Z" />
      <circle cx="10" cy="10" r="2.25" />
    </>
  ),
  toggle: (
    <>
      <rect x="2.75" y="5.75" width="14.5" height="8.5" rx="4.25" />
      <circle cx="13" cy="10" r="2.25" />
    </>
  ),
  users: (
    <>
      <circle cx="7.5" cy="7" r="2.75" />
      <path d="M2.75 16.25a4.75 4.75 0 0 1 9.5 0" />
      <path d="M13.25 4.5a2.5 2.5 0 0 1 0 5M14.75 12.25a4.25 4.25 0 0 1 2.5 4" />
    </>
  ),
  building: (
    <>
      <path d="M4 16.5V5.5L10 3.5l6 2v11" />
      <path d="M3 16.5h14M8.25 16.5v-3h3.5v3M7.75 7.75h.01M12.25 7.75h.01M7.75 10.5h.01M12.25 10.5h.01" />
    </>
  ),
  shield: <path d="M10 3.25 16 5.5v4.75c0 3.4-2.45 5.6-6 6.5-3.55-.9-6-3.1-6-6.5V5.5l6-2.25Z" />,
  upload: (
    <>
      <path d="M10 12.5V3.75M6.75 7 10 3.75 13.25 7" />
      <path d="M3.5 13v1.75c0 .97.78 1.75 1.75 1.75h9.5c.97 0 1.75-.78 1.75-1.75V13" />
    </>
  ),
  spark: <path d="M10 3.25 11.75 8.25 16.75 10l-5 1.75L10 16.75l-1.75-5L3.25 10l5-1.75L10 3.25Z" />,
  triangle: <path d="M10 3.75 16.75 16H3.25L10 3.75Z" />,
  logout: (
    <>
      <path d="M8 16.5H5.25c-.97 0-1.75-.78-1.75-1.75v-9.5c0-.97.78-1.75 1.75-1.75H8" />
      <path d="M12.75 13.25 16 10l-3.25-3.25M16 10H7.5" />
    </>
  ),
};

/** Legacy names used elsewhere, mapped onto the set. */
const ALIASES: Record<string, string> = {
  radar: "eye",
  classroom: "board",
  moon: "suitcase",
  strategy: "target",
};

export const NAV_ICON_NAMES = Object.keys(ICONS);

export function NavIcon({ name, active, className = "h-[18px] w-[18px] shrink-0" }: { name: string; active: boolean; className?: string }) {
  const icon = ICONS[ALIASES[name] ?? name] ?? <circle cx="10" cy="10" r="5.5" />;
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="none"
      stroke={active ? "var(--on-surface)" : "var(--outline)"}
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {icon}
    </svg>
  );
}
