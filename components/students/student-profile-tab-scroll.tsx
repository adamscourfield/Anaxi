"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Scrolls to `#tab` section when `?tab=` is present (UX-094). */
export function StudentProfileTabScroll() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  useEffect(() => {
    if (!tab) return;
    const el = document.getElementById(tab);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [tab]);

  return null;
}
