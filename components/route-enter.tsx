"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Wraps children and replays a short enter animation when the pathname changes (auth routes, etc.). */
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
