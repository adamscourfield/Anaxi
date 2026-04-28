"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Replays enter animation when pathname changes (paired with Tailwind `animate-page-enter`). */
export function RouteEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname ?? ""}
      className="motion-safe:animate-page-enter motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}
