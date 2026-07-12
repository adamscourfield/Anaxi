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

export const TAB_LABELS: Record<TaxonomyTab, string> = {
  "loa-reasons": "LOA Reasons",
  "loa-authorisers": "LOA Authorisers",
  "on-call-reasons": "On Call Reasons",
  "on-call-locations": "On Call Locations",
  "on-call-recipients": "On Call Recipients",
};
