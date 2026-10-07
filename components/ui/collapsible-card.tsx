"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CollapsibleCard({
  id,
  title,
  subtitle,
  icon,
  iconClassName = "bg-[var(--surface-container)] text-muted",
  children,
  defaultOpen = true,
  attention = false,
  attentionKey,
  attentionFingerprint,
  attentionMessage,
  connectionId,
  csrfToken,
  className = "",
}: {
  /** Lets a "Needs attention" summary or other link jump straight to this section, open. */
  id?: string;
  title: string;
  /** Short one-line context shown under the title, next to the chevron. */
  subtitle?: string;
  /** Optional leading icon tile — gives each section a distinct, scannable identity. */
  icon?: ReactNode;
  /** Background/text colour classes for the icon tile (e.g. `bg-cat-blue-bg text-cat-blue-text`). */
  iconClassName?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Marks a collapsed section when it needs an administrator's attention. */
  attention?: boolean;
  /** The Arbor section whose alert can be acknowledged. */
  attentionKey?: string;
  /** Identifies the specific issue, so a later change raises a new alert. */
  attentionFingerprint?: string;
  /** Plain-language explanation shown with the in-section alert. */
  attentionMessage?: string;
  /** Keeps acknowledgement scoped to the selected real-school connection. */
  connectionId?: string;
  csrfToken?: string;
  className?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    const openIfTargeted = () => {
      if (window.location.hash !== `#${id}`) return;
      const el = detailsRef.current;
      if (!el) return;
      el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    // Covers both a direct link (hash already set on load) and a same-page
    // click on a "Needs attention" row (hash changes without a navigation).
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
    return () => window.removeEventListener("hashchange", openIfTargeted);
  }, [id]);

  // Keep an acknowledgement hidden through parent rerenders. A changed
  // fingerprint represents a genuinely new issue and deliberately reopens it.
  const [dismissedFingerprint, setDismissedFingerprint] = useState<string | null>(null);
  useEffect(() => {
    setDismissedFingerprint((current) => current === attentionFingerprint ? current : null);
  }, [attentionFingerprint]);
  const showAttention = Boolean(attention && attentionFingerprint && dismissedFingerprint !== attentionFingerprint);

  async function acknowledgeAttention() {
    if (!showAttention || !attentionKey || !attentionFingerprint || !csrfToken) return;
    // Remove the signal immediately, then restore it only if acknowledgement fails.
    setDismissedFingerprint(attentionFingerprint);
    const form = new FormData();
    form.set("_csrf", csrfToken);
    form.set("section", attentionKey);
    form.set("fingerprint", attentionFingerprint);
    const url = new URL("/api/god/integrations/arbor/attention", window.location.origin);
    if (connectionId) url.searchParams.set("connectionId", connectionId);
    const response = await fetch(url, { method: "POST", body: form });
    if (!response.ok) setDismissedFingerprint(null);
  }

  return (
    <details
      ref={detailsRef}
      id={id}
      className={`scroll-mt-24 rounded-sm border border-border bg-surface-container-lowest shadow-none ${className}`}
      open={defaultOpen}
    >
      <summary className="group flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[14px] font-semibold tracking-[-0.01em] text-text [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-3">
          {icon ? (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75] ${iconClassName}`} aria-hidden>
              {icon}
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              {title}
              {showAttention ? (
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-error text-[11px] font-bold text-white" title="Needs attention" aria-label="Needs attention">
                  !
                </span>
              ) : null}
            </span>
            {subtitle ? <span className="mt-0.5 block truncate text-xs font-normal text-muted">{subtitle}</span> : null}
          </span>
        </span>
        <span className="calm-transition shrink-0 text-muted group-open:rotate-180">
          <ChevronDown />
        </span>
      </summary>
      <div className="border-t border-border px-5 py-4 text-sm">
        {showAttention ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-error/25 bg-[var(--pill-error-bg)] px-3 py-2">
            <span className="text-sm font-medium text-error">{attentionMessage ?? "This section has an alert requiring review."}</span>
            <button type="button" onClick={() => { void acknowledgeAttention(); }} className="rounded-sm border border-error/30 bg-surface px-3 py-1.5 text-xs font-semibold text-error hover:bg-[var(--pill-error-bg)]">Acknowledge alert</button>
          </div>
        ) : null}
        {children}
      </div>
    </details>
  );
}
