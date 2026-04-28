/**
 * Route loading skeleton for tenant app shell — matches typical page rhythm.
 */
export function TenantRouteSkeleton() {
  return (
    <div className="mx-auto min-w-0 max-w-[1400px] space-y-8 pb-8 motion-safe:animate-pulse-subtle" aria-busy="true" aria-label="Loading page">
      <div className="space-y-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] pb-8">
        <div className="h-3 w-24 rounded-md bg-[var(--surface-container-high)]" />
        <div className="h-8 max-w-md rounded-lg bg-[var(--surface-container)]" />
        <div className="h-4 max-w-xl rounded-md bg-[var(--surface-container-low)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-[var(--surface-container-lowest)] shadow-ambient ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)]" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-[var(--surface-container-low)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]" />
    </div>
  );
}
