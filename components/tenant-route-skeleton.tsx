const pulse = "motion-safe:animate-pulse-subtle";

export type TenantSkeletonVariant =
  | "default"
  /** Dashboard-style KPI row + primary panel */
  | "home"
  /** Tabs / toolbar + chart + table rhythm */
  | "analytics"
  /** Stat row + meeting lists */
  | "meetings"
  /** Settings-style stacked sections */
  | "admin"
  /** Filters + wide table */
  | "table"
  /** Header + two-column body (live meeting, profile) */
  | "detail"
  /** Single hero card + fields (forms, wizards) */
  | "form";

function HeaderBlock() {
  return (
    <div className="space-y-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] pb-8">
      <div className="h-3 w-24 rounded-md bg-[var(--surface-container-high)]" />
      <div className="h-8 max-w-md rounded-lg bg-[var(--surface-container)]" />
      <div className="h-4 max-w-xl rounded-md bg-[var(--surface-container-low)]" />
    </div>
  );
}

function StatGrid({ cols = 4 }: { cols?: 3 | 4 }) {
  const n = cols === 3 ? 3 : 4;
  return (
    <div className={`grid gap-4 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="h-28 rounded-2xl bg-[var(--surface-container-lowest)] shadow-ambient ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_25%,transparent)]"
        />
      ))}
    </div>
  );
}

/**
 * Route loading skeleton for tenant app shell — variant layouts mirror heavy routes.
 */
export function TenantRouteSkeleton({
  variant = "default",
}: {
  variant?: TenantSkeletonVariant;
}) {
  if (variant === "meetings") {
    return (
      <div
        className={`mx-auto min-w-0 max-w-[1400px] space-y-8 pb-8 ${pulse}`}
        aria-busy="true"
        aria-label="Loading page"
      >
        <HeaderBlock />
        <StatGrid cols={3} />
        <div className="space-y-3">
          <div className="h-5 w-40 rounded-md bg-[var(--surface-container)]" />
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[var(--surface-container-lowest)] px-4 py-4 shadow-ambient"
            >
              <div className="h-12 w-12 shrink-0 rounded-xl bg-[var(--surface-container-high)]" />
                <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 max-w-sm rounded-md bg-[var(--surface-container)]" />
                <div className="h-3 w-24 rounded bg-[var(--surface-container-low)]" />
              </div>
              <div className="hidden h-9 w-24 shrink-0 rounded-lg bg-[var(--surface-container-high)] sm:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "admin") {
    return (
      <div className={`mx-auto min-w-0 max-w-[1000px] space-y-8 pb-8 ${pulse}`} aria-busy="true" aria-label="Loading page">
        <HeaderBlock />
        <div className="h-12 w-full max-w-xl rounded-xl bg-[var(--surface-container-low)]" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-ambient"
          >
            <div className="mb-4 h-5 w-48 rounded-md bg-[var(--surface-container)]" />
            <div className="space-y-3">
              <div className="h-10 w-full rounded-lg bg-[var(--surface-container-low)]" />
              <div className="h-10 w-full rounded-lg bg-[var(--surface-container-low)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={`mx-auto min-w-0 max-w-[1400px] space-y-6 pb-8 ${pulse}`} aria-busy="true" aria-label="Loading page">
        <HeaderBlock />
        <div className="filter-panel">
          <div className="flex flex-wrap items-end gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[120px] flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-[var(--surface-container-high)]" />
                <div className="h-10 w-full rounded-md bg-[var(--surface-container-high)]" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-12 w-full rounded-xl bg-[var(--surface-container-low)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)]" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-[var(--surface-container-lowest)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_15%,transparent)]" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={`mx-auto min-w-0 max-w-[1400px] space-y-6 pb-8 ${pulse}`} aria-busy="true" aria-label="Loading page">
        <div className="space-y-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] pb-6">
          <div className="h-3 w-28 rounded-md bg-[var(--surface-container-high)]" />
          <div className="h-9 max-w-lg rounded-lg bg-[var(--surface-container)]" />
          <div className="flex gap-3">
            <div className="h-8 w-24 rounded-md bg-[var(--surface-container-low)]" />
            <div className="h-8 w-32 rounded-md bg-[var(--surface-container-low)]" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-h-[320px] rounded-2xl bg-[var(--surface-container-low)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]" />
          <div className="space-y-4">
            <div className="h-48 rounded-2xl bg-[var(--surface-container-lowest)] shadow-ambient ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)]" />
            <div className="h-40 rounded-2xl bg-[var(--surface-container-low)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)]" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className={`mx-auto min-w-0 max-w-[720px] space-y-8 pb-8 ${pulse}`} aria-busy="true" aria-label="Loading page">
        <HeaderBlock />
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[var(--surface-container-lowest)] p-6 shadow-ambient">
          <div className="space-y-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-28 rounded bg-[var(--surface-container-high)]" />
                <div className="h-11 w-full rounded-lg bg-[var(--surface-container-low)]" />
              </div>
            ))}
            <div className="h-11 w-full max-w-xs rounded-xl bg-[var(--surface-container)]" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "analytics") {
    return (
      <div className={`mx-auto min-w-0 max-w-[1400px] space-y-8 pb-8 ${pulse}`} aria-busy="true" aria-label="Loading page">
        <HeaderBlock />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-28 rounded-md bg-[var(--surface-container-low)]" />
          ))}
        </div>
        <div className="h-56 rounded-2xl bg-[var(--surface-container-low)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]" />
        <div className="h-48 rounded-2xl bg-[var(--surface-container-lowest)] shadow-ambient ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)]" />
      </div>
    );
  }

  /* default | home */
  return (
    <div className={`mx-auto min-w-0 max-w-[1400px] space-y-8 pb-8 ${pulse}`} aria-busy="true" aria-label="Loading page">
      <HeaderBlock />
      <StatGrid cols={4} />
      <div className="h-64 rounded-2xl bg-[var(--surface-container-low)] ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]" />
    </div>
  );
}
