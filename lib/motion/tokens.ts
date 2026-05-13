import type { CSSProperties } from "react";

/** Canonical HVQT easing — fast start, precision settle (matches Framer tuple). */
export const MOTION_EASE_HVQT_CSS = "cubic-bezier(0.22, 1, 0.36, 1)" as const;

/** Framer Motion cubic bezier (must match `MOTION_EASE_HVQT_CSS`). */
export const MOTION_EASE_FRAMER = [0.22, 1, 0.36, 1] as const;

export const MOTION_MS_QUICK = 180;
export const MOTION_MS_TAP = 160;
export const MOTION_MS_MICRO = 200;
export const MOTION_MS_EMPHASIS = 220;
export const MOTION_MS_PANEL = 300;

/** Panel / route choreography duration in seconds (Framer). */
export const MOTION_PANEL_SEC = MOTION_MS_PANEL / 1000;

/** CSS custom property names — injected on `<html>` in root layout. */
export const MOTION_CSS_VARS = {
  easeHvqt: "--motion-ease-hvqt",
  durationQuick: "--motion-duration-quick",
  durationTap: "--motion-duration-tap",
  durationMicro: "--motion-duration-micro",
  durationEmphasis: "--motion-duration-emphasis",
  durationPanel: "--motion-duration-panel",
} as const;

/** Tailwind / arbitrary CSS: resolved easing token. */
export const MOTION_EASE_HVQT_VAR = `var(${MOTION_CSS_VARS.easeHvqt})` as const;

export const MOTION_DURATION_QUICK_VAR = `var(${MOTION_CSS_VARS.durationQuick})` as const;
export const MOTION_DURATION_TAP_VAR = `var(${MOTION_CSS_VARS.durationTap})` as const;
export const MOTION_DURATION_MICRO_VAR = `var(${MOTION_CSS_VARS.durationMicro})` as const;
export const MOTION_DURATION_EMPHASIS_VAR = `var(${MOTION_CSS_VARS.durationEmphasis})` as const;
export const MOTION_DURATION_PANEL_VAR = `var(${MOTION_CSS_VARS.durationPanel})` as const;

/**
 * Sets global motion tokens on the document root so `globals.css` and Tailwind
 * can reference `var(--motion-*)` with a single TypeScript source of truth.
 */
export function motionRootCssProperties(): CSSProperties {
  return {
    [MOTION_CSS_VARS.easeHvqt]: MOTION_EASE_HVQT_CSS,
    [MOTION_CSS_VARS.durationQuick]: `${MOTION_MS_QUICK}ms`,
    [MOTION_CSS_VARS.durationTap]: `${MOTION_MS_TAP}ms`,
    [MOTION_CSS_VARS.durationMicro]: `${MOTION_MS_MICRO}ms`,
    [MOTION_CSS_VARS.durationEmphasis]: `${MOTION_MS_EMPHASIS}ms`,
    [MOTION_CSS_VARS.durationPanel]: `${MOTION_MS_PANEL}ms`,
  } as CSSProperties;
}
