"use client";

export type SummaryFilter = {
  status: "all" | "active" | "inactive";
  roleGroup: "all" | "administrators";
};

export function UserDirectorySummary({
  total,
  active,
  inactive,
  adminCount,
  filter,
  onFilterChange,
}: {
  total: number;
  active: number;
  inactive: number;
  adminCount: number;
  filter: SummaryFilter;
  onFilterChange: (next: SummaryFilter) => void;
}) {
  const chipBase =
    "rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium calm-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15";
  const chipActive = "border-accent/40 bg-accent/10 text-text";
  const chipIdle = "border-border/50 bg-background text-muted hover:border-border hover:text-text";

  function setStatus(status: SummaryFilter["status"]) {
    onFilterChange({ ...filter, status });
  }

  function toggleAdministrators() {
    onFilterChange({
      ...filter,
      roleGroup: filter.roleGroup === "administrators" ? "all" : "administrators",
    });
  }

  const hasFilters = filter.status !== "all" || filter.roleGroup !== "all";

  return (
    <section className="rounded-sm border border-border/25 bg-surface-container-lowest px-5 py-4">
      <p className="text-sm text-muted">
        <span className="font-semibold text-text">{total.toLocaleString()}</span> staff
        <span className="mx-1.5 text-border">·</span>
        <span className="font-medium text-text">{active.toLocaleString()}</span> active
        <span className="mx-1.5 text-border">·</span>
        <span className="font-medium text-text">{inactive.toLocaleString()}</span> inactive
        {adminCount > 0 ? (
          <>
            <span className="mx-1.5 text-border">·</span>
            <span className="font-medium text-text">{adminCount.toLocaleString()}</span> with admin access
          </>
        ) : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={`${chipBase} ${filter.status === "active" ? chipActive : chipIdle}`}
          onClick={() => setStatus(filter.status === "active" ? "all" : "active")}
        >
          Active
        </button>
        <button
          type="button"
          className={`${chipBase} ${filter.status === "inactive" ? chipActive : chipIdle}`}
          onClick={() => setStatus(filter.status === "inactive" ? "all" : "inactive")}
        >
          Inactive
        </button>
        {adminCount > 0 ? (
          <button
            type="button"
            className={`${chipBase} ${filter.roleGroup === "administrators" ? chipActive : chipIdle}`}
            onClick={toggleAdministrators}
          >
            Administrators
          </button>
        ) : null}
        {hasFilters ? (
          <button
            type="button"
            className={`${chipBase} ${chipIdle}`}
            onClick={() => onFilterChange({ status: "all", roleGroup: "all" })}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  );
}
