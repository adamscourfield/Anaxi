"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/toast-provider";

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
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { update } = useSession();
  const router = useRouter();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function switchTenant(tenantId: string) {
    setOpen(false);
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        toast("Could not switch school", "error");
        return;
      }
      await update({ targetTenantId: tenantId });
      toast("Switched school", "success");
      router.push("/home");
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  const initial = currentTenantName.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex min-w-0 max-w-full items-center gap-2 rounded-[0.75rem] px-3 py-1.5 calm-transition hover:bg-[var(--surface-container-low)] hover:shadow-sm disabled:opacity-60 motion-safe:active:scale-[0.99]"
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
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] origin-top rounded-lg border border-border bg-surface-container-lowest py-1 shadow-lg motion-safe:animate-page-enter">
          {tenants.map((t) => (
            <button
              key={t.tenantId}
              type="button"
              onClick={() => !t.isCurrent && switchTenant(t.tenantId)}
              disabled={t.isCurrent || switching}
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
          ))}
        </div>
      )}
    </div>
  );
}
