import type { AdminSectionId } from "@/lib/admin-sections";

export type AdminSectionExtra = Record<string, string | undefined | null>;

export type UrlSectionSyncDecision = "apply" | "ignore-stale" | "external";

/** Whether a URL-driven section update should update the visible panel. */
export function decideUrlSectionSync(
  urlSection: AdminSectionId,
  desiredSection: AdminSectionId,
  inFlightDesired: AdminSectionId | null,
): UrlSectionSyncDecision {
  if (urlSection === desiredSection) return "apply";
  if (inFlightDesired !== null) return "ignore-stale";
  return "external";
}

export function shouldShowPanelSkeleton(hasCachedPanel: boolean, isPending: boolean): boolean {
  return !hasCachedPanel && isPending;
}
