import Link from "next/link";

export function ExplorerPromoBand({ windowDays }: { windowDays: number }) {
  return (
    <section className="rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_40%,transparent)] bg-[var(--surface-container-low)] px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-text">Need to dig deeper?</p>
        <p className="text-xs text-muted">
          <span className="font-medium text-text">Today</span> is your pulse — use{" "}
          <span className="font-medium text-text">Explore</span> for full pivots, exports, and drill-downs.
        </p>
      </div>
      <Link
        href={`/explorer?window=${windowDays}`}
        className="mt-3 inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--surface-container-lowest)] px-4 py-2 text-xs font-semibold text-text ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_45%,transparent)] calm-transition hover:bg-[var(--surface-container)] sm:mt-0"
      >
        Open Explorer →
      </Link>
    </section>
  );
}
