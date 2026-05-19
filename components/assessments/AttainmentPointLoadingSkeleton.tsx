import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";

/** Skeleton for result-point analysis while metrics load. */
export function AttainmentPointLoadingSkeleton() {
  return (
    <AttainmentPageShell>
      <div className="animate-pulse space-y-8" aria-busy="true" aria-label="Loading result point analysis">
        <div className="h-4 w-64 rounded bg-[var(--surface-container-high)]" />
        <div className="space-y-3">
          <div className="h-3 w-24 rounded bg-[var(--surface-container-high)]" />
          <div className="h-9 w-80 max-w-full rounded bg-[var(--surface-container-high)]" />
          <div className="h-4 w-96 max-w-full rounded bg-[var(--surface-container-high)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-sm border border-border bg-surface-container-lowest" />
          ))}
        </div>
        <div className="flex gap-2 border-b border-border pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-28 rounded bg-[var(--surface-container-high)]" />
          ))}
        </div>
        <div className="h-64 rounded-sm border border-border bg-surface-container-lowest" />
      </div>
    </AttainmentPageShell>
  );
}
