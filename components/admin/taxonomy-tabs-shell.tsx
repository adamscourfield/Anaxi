"use client";

import type { ReactNode } from "react";

/** Mobile taxonomy section picker; desktop uses sidebar tiles in the parent view. */
export function TaxonomyTabsShell({
  tabs,
  activeTab,
  onTabChange,
  labels,
  children,
}: {
  tabs: readonly string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  labels: Record<string, string>;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="md:hidden">
        <label htmlFor="taxonomy-tab" className="mb-1.5 block text-sm font-medium text-[var(--on-surface)]">
          Section
        </label>
        <select
          id="taxonomy-tab"
          value={activeTab}
          onChange={(e) => onTabChange(e.target.value)}
          className="w-full rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm font-medium text-[var(--on-surface)] shadow-sm outline-none transition focus:border-[#93C5FD] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
        >
          {tabs.map((t) => (
            <option key={t} value={t}>
              {labels[t]}
            </option>
          ))}
        </select>
      </div>
      {children}
    </div>
  );
}
