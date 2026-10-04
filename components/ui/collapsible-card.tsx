import { ReactNode } from "react";

function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CollapsibleCard({
  title,
  children,
  defaultOpen = true,
  attention = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Marks a collapsed section when it needs an administrator's attention. */
  attention?: boolean;
  className?: string;
}) {
  return (
    <details
      className={`h-full overflow-hidden rounded-sm border border-border bg-surface-container-lowest shadow-none ${className}`}
      open={defaultOpen}
    >
      <summary className="group flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[14px] font-semibold tracking-[-0.01em] text-text [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {title}
          {attention ? <span className="h-2 w-2 rounded-full bg-danger" title="Needs attention" aria-label="Needs attention" /> : null}
        </span>
        <span className="calm-transition text-muted group-open:rotate-180">
          <ChevronDown />
        </span>
      </summary>
      <div className="border-t border-border px-5 py-4 text-sm">{children}</div>
    </details>
  );
}
