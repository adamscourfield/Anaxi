"use client";

import { ReactNode, useState } from "react";

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
  attentionKey,
  csrfToken,
  className = "",
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Marks a collapsed section when it needs an administrator's attention. */
  attention?: boolean;
  /** The Arbor section whose persistent alert should be acknowledged on opening. */
  attentionKey?: string;
  csrfToken?: string;
  className?: string;
}) {
  const [showAttention, setShowAttention] = useState(attention);

  async function acknowledgeAttention(open: boolean) {
    if (!open || !showAttention || !attentionKey || !csrfToken) return;
    // Remove the signal immediately, then restore it only if acknowledgement fails.
    setShowAttention(false);
    const form = new FormData();
    form.set("csrfToken", csrfToken);
    form.set("section", attentionKey);
    const response = await fetch("/api/god/integrations/arbor/attention", { method: "POST", body: form });
    if (!response.ok) setShowAttention(true);
  }

  return (
    <details
      className={`h-full overflow-hidden rounded-sm border border-border bg-surface-container-lowest shadow-none ${className}`}
      open={defaultOpen}
      onToggle={(event) => { void acknowledgeAttention(event.currentTarget.open); }}
    >
      <summary className="group flex cursor-pointer list-none items-center justify-between px-5 py-4 text-[14px] font-semibold tracking-[-0.01em] text-text [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {title}
          {showAttention ? (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#dc2626] text-[11px] font-bold text-white" title="Needs attention" aria-label="Needs attention">
              !
            </span>
          ) : null}
        </span>
        <span className="calm-transition text-muted group-open:rotate-180">
          <ChevronDown />
        </span>
      </summary>
      <div className="border-t border-border px-5 py-4 text-sm">{children}</div>
    </details>
  );
}
