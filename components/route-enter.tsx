"use client";

import type { ReactNode } from "react";
import { PageTransition } from "@/components/page-transition";

/** Replays route transitions when pathname changes (HVQT snap-to-focus; see `PageTransition`). */
export function RouteEnter({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
