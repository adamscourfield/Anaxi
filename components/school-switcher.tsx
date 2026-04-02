"use client";

import { useState, useRef, useEffect } from "react";

type TenantOption = {
  tenantId: string;
  tenantName: string;
  isCurrent: boolean;
};

export function SchoolSwitcher({
  currentTenantName,
  tenants,
}: {
  currentTenantName: string;
  tenants: TenantOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const initial = currentTenantName.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-w-0 max-w-full items-center gap-2 rounded-[0.75rem] px-3 py-1.5 calm-transition hover:bg-[var(--surface-container-low)]"
        style={{ border: "1px solid color-mix(in srgb, var(--outline-variant) 35%, transparent)" }}
      >
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accentSurface text-[10px] font-bold text-accent">
          {initial}
        </span>
        <span className="min-w-0 truncate text-left text-[13px] font-medium text-text">
          {currentTenantName}
        </span>
        <svg viewBox="0 0 16 16" fill="none" className={`h-3 w-3 text-muted calm-transition ${open ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-surface-container-lowest py-1 shadow-lg">
          {tenants.map((t) => (
            <form key={t.tenantId} action="/api/auth/switch-tenant" method="post">
              <input type="hidden" name="tenantId" value={t.tenantId} />
              <button
                type="submit"
                disabled={t.isCurrent}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] calm-transition ${
                  t.isCurrent
                    ? "bg-accentSurface/60 font-medium text-accent"
                    : "text-text hover:bg-bg"
                }`}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold bg-accentSurface text-accent">
                  {t.tenantName.charAt(0).toUpperCase()}
                </span>
                {t.tenantName}
                {t.isCurrent && (
                  <svg viewBox="0 0 16 16" fill="none" className="ml-auto h-3.5 w-3.5 text-accent" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
