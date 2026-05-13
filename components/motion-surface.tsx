"use client";

import type { ReactNode } from "react";
import {
  hvqtMotionSurfacePanelClass,
  hvqtMotionSurfaceRouteClass,
} from "@/lib/motion/hvqt";

const presetClass = {
  route: hvqtMotionSurfaceRouteClass,
  panel: hvqtMotionSurfacePanelClass,
} as const;

export type MotionSurfacePreset = keyof typeof presetClass;

type MotionSurfaceProps = {
  children: ReactNode;
  className?: string;
  /** `route` matches main column snap-to-focus; `panel` is lighter for overlays. */
  preset?: MotionSurfacePreset;
};

function mergeClassName(base: string | undefined, extra: string): string {
  return [base, extra].filter(Boolean).join(" ");
}

/**
 * Shared HVQT enter state for surfaces. For full route cross-fades with exit,
 * use `PageTransition` instead.
 */
export function MotionSurface({ children, className, preset = "panel" }: MotionSurfaceProps) {
  return (
    <div className={mergeClassName(className, presetClass[preset])}>{children}</div>
  );
}
