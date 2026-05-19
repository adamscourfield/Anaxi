/** Skeleton for lazy-loaded attainment analysis tabs. */
export function AttainmentTabPanelSkeleton({ label }: { label: string }) {
  return (
    <div
      className="animate-pulse space-y-4 py-8"
      aria-busy="true"
      aria-label={`Loading ${label}`}
    >
      <div className="h-4 w-48 rounded bg-[var(--surface-container-high)]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-24 rounded-sm border border-border bg-surface-container-lowest" />
        ))}
      </div>
    </div>
  );
}
