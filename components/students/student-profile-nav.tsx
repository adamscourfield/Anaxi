"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "attainment", label: "Attainment" },
  { id: "snapshots", label: "Snapshots" },
  { id: "on-call", label: "On-call" },
] as const;

export type StudentProfileTab = (typeof TABS)[number]["id"];

export function StudentProfileNav({ studentId }: { studentId: string }) {
  const searchParams = useSearchParams();
  const active = (searchParams.get("tab") as StudentProfileTab | null) ?? "overview";

  return (
    <nav
      aria-label="Student profile sections"
      className="sticky top-0 z-10 -mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] bg-[var(--surface-container-low)]/95 px-1 py-2 backdrop-blur-sm"
    >
      {TABS.map((tab) => {
        const href = `/students/${studentId}?tab=${tab.id}`;
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-md px-3 py-2 text-[0.8125rem] font-semibold calm-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--primary)_35%,transparent)] ${
              isActive
                ? "bg-[var(--surface-container-lowest)] text-text shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function studentTabVisible(tab: StudentProfileTab, active: StudentProfileTab): boolean {
  return active === tab;
}
