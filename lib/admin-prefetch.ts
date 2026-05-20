import type { AdminSectionId } from "@/lib/admin-sections";

/** Sections worth warming after overview, including off-nav destinations opened from overview. */
export function adminBackgroundPrefetchSections(navSections: AdminSectionId[]): AdminSectionId[] {
  const seen = new Set<AdminSectionId>();
  const ordered: AdminSectionId[] = [];

  for (const section of navSections) {
    if (section === "overview" || seen.has(section)) continue;
    seen.add(section);
    ordered.push(section);
  }

  if (seen.has("users") && !seen.has("users-import")) {
    ordered.push("users-import");
  }

  return ordered;
}

/**
 * Prefetch admin panel routes one at a time during idle time to avoid network spikes.
 * Returns a cancel function.
 */
export function staggeredAdminPrefetch(
  sections: AdminSectionId[],
  prefetch: (section: AdminSectionId) => void,
  options?: { gapMs?: number },
): () => void {
  let cancelled = false;
  let index = 0;
  const gapMs = options?.gapMs ?? 100;

  const runNext = () => {
    if (cancelled || index >= sections.length) return;
    prefetch(sections[index]!);
    index += 1;
    schedule(runNext);
  };

  const schedule = (fn: () => void) => {
    if (cancelled) return;
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => fn(), { timeout: gapMs * 4 });
    } else {
      setTimeout(fn, gapMs);
    }
  };

  schedule(runNext);
  return () => {
    cancelled = true;
  };
}
