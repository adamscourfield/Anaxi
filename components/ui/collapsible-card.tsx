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
  className = "",
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={`h-full overflow-hidden rounded-2xl border border-border/80 bg-surface-container-lowest shadow-ambient ${className}`}
      open={defaultOpen}
    >
      <summary className="group flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[14px] font-semibold tracking-[-0.01em] text-text [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="calm-transition text-muted group-open:rotate-180">
          <ChevronDown />
        </span>
      </summary>
      <div className="border-t border-border px-5 py-4 text-sm">{children}</div>
    </details>
  );
}
