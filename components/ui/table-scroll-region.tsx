import { ReactNode } from "react";

/** Horizontal table wrapper with mobile scroll affordance (UX-051). */
export function TableScrollRegion({
  children,
  className = "",
  stickyFirstColumn = false,
}: {
  children: ReactNode;
  className?: string;
  stickyFirstColumn?: boolean;
}) {
  return (
    <div className={`relative ${className}`.trim()}>
      <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted md:sr-only">
        Scroll horizontally for more columns
      </p>
      <div
        className={`relative overflow-x-auto pb-1 ${stickyFirstColumn ? "[&_table]:sticky-first-column" : ""}`}
        tabIndex={0}
      >
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-[var(--surface-container-low)] to-transparent md:hidden"
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}
