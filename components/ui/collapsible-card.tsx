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
  attentionFingerprint,
  connectionId,
  csrfToken,
  className = "",
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Marks a collapsed section when it needs an administrator's attention. */
  attention?: boolean;
  /** The Arbor section whose alert can be acknowledged. */
  attentionKey?: string;
  /** Identifies the specific issue, so a later change raises a new alert. */
  attentionFingerprint?: string;
  /** Keeps acknowledgement scoped to the selected real-school connection. */
  connectionId?: string;
  csrfToken?: string;
  className?: string;
}) {
  const [showAttention, setShowAttention] = useState(attention);

  async function acknowledgeAttention() {
    if (!showAttention || !attentionKey || !attentionFingerprint || !csrfToken) return;
    // Remove the signal immediately, then restore it only if acknowledgement fails.
    setShowAttention(false);
    const form = new FormData();
    form.set("csrfToken", csrfToken);
    form.set("section", attentionKey);
    form.set("fingerprint", attentionFingerprint);
    const url = new URL("/api/god/integrations/arbor/attention", window.location.origin);
    if (connectionId) url.searchParams.set("connectionId", connectionId);
    const response = await fetch(url, { method: "POST", body: form });
    if (!response.ok) setShowAttention(true);
  }

  return (
    <details
      className={`h-full overflow-hidden rounded-sm border border-border bg-surface-container-lowest shadow-none ${className}`}
      open={defaultOpen}
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
      <div className="border-t border-border px-5 py-4 text-sm">
        {showAttention ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-danger/25 bg-[var(--pill-danger-bg)] px-3 py-2">
            <span className="text-sm font-medium text-danger">This section has an alert requiring review.</span>
            <button type="button" onClick={() => { void acknowledgeAttention(); }} className="rounded-sm border border-danger/30 bg-surface px-3 py-1.5 text-xs font-semibold text-danger hover:bg-[var(--pill-danger-bg)]">Acknowledge alert</button>
          </div>
        ) : null}
        {children}
      </div>
    </details>
  );
}
