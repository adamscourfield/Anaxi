/** Placeholder while a lazy admin panel loads from the server. */
export function AdminPanelSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading section">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded-md bg-[var(--surface-container-high)]" />
        <div className="h-9 w-64 max-w-full rounded-lg bg-[var(--surface-container-high)]" />
        <div className="h-4 w-full max-w-xl rounded-md bg-[var(--surface-container)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[142px] rounded-2xl bg-[var(--surface-container-low)]" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-[var(--surface-container-low)]" />
    </div>
  );
}
