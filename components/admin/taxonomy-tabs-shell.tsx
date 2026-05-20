"use client";

import { useState, type ReactNode } from "react";

/** Client-only tab switcher so taxonomy sub-tabs do not trigger route navigation. */
export function TaxonomyTabsShell({
  tabs,
  initialTab,
  labels,
  children,
}: {
  tabs: readonly string[];
  initialTab: string;
  labels: Record<string, string>;
  children: (activeTab: string, selectTab: (tab: string) => void) => ReactNode;
}) {
  const safeInitial = tabs.includes(initialTab) ? initialTab : tabs[0];
  const [activeTab, setActiveTab] = useState(safeInitial);

  return (
    <div className="space-y-6">
      <div className="md:hidden">
        <label htmlFor="taxonomy-tab" className="mb-1.5 block text-sm font-medium text-[var(--on-surface)]">
          Section
        </label>
        <select
          id="taxonomy-tab"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          className="w-full rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm font-medium text-[var(--on-surface)] shadow-sm outline-none transition focus:border-[#93C5FD] focus:ring-2 focus:ring-[rgba(59,130,246,0.15)]"
        >
          {tabs.map((t) => (
            <option key={t} value={t}>
              {labels[t]}
            </option>
          ))}
        </select>
      </div>
      {children(activeTab, setActiveTab)}
    </div>
  );
}
