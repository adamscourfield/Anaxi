"use client";

import type { ReactNode } from "react";

export const TAXONOMY_TABS = [
  "loa-reasons",
  "loa-authorisers",
  "on-call-reasons",
  "on-call-locations",
  "on-call-recipients",
] as const;

export type TaxonomyTab = (typeof TAXONOMY_TABS)[number];

export const LEAVE_TAXONOMY_TABS: TaxonomyTab[] = ["loa-reasons", "loa-authorisers"];
export const ON_CALL_TAXONOMY_TABS: TaxonomyTab[] = ["on-call-reasons", "on-call-locations", "on-call-recipients"];

const ICON_WELL_BASE =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border [&_svg]:shrink-0";

export const TAXONOMY_NAV_CARD =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

export const TAXONOMY_ICON_WELL_BASE = ICON_WELL_BASE;

export const TAXONOMY_AUTH_CARD =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

export const TAB_META: Record<TaxonomyTab, { label: string; icon: ReactNode; description: string }> = {
  "loa-reasons": {
    label: "LOA Reasons",
    description: "Categories staff can choose when requesting leave.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M12 18v-6M9 15h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "loa-authorisers": {
    label: "LOA Authorisers",
    description: "Staff who can approve or deny leave requests.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 8v6M22 11h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "on-call-reasons": {
    label: "On Call Reasons",
    description: "Reasons available when creating on-call requests.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "on-call-locations": {
    label: "On Call Locations",
    description: "Locations available for on-call incident reports.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "on-call-recipients": {
    label: "On Call Recipients",
    description: "Email addresses that receive on-call notifications.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

export const TAB_LABELS: Record<TaxonomyTab, string> = Object.fromEntries(
  TAXONOMY_TABS.map((k) => [k, TAB_META[k].label])
) as Record<TaxonomyTab, string>;
