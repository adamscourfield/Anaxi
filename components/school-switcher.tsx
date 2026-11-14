"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SchoolSwitchProgress, type SchoolSwitchStage } from "@/components/school-switch-progress";

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
  // `null` when idle; otherwise the school being switched to and how far the switch has got.
  const [progress, setProgress] = useState<{
    schoolName: string;
    stage: SchoolSwitchStage;
    failedStage?: SchoolSwitchStage;
  } | null>(null);
  const [navigating, startNavigation] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const { update } = useSession();
  const router = useRouter();
  const switching = progress !== null;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // The last stage ends when the new school's home page has actually rendered,
  // which is when the navigation transition settles.
  useEffect(() => {
    if (progress?.stage !== "loading" || navigating) return;
    setProgress((p) => (p ? { ...p, stage: "done" } : p));
  }, [progress?.stage, navigating]);

  // Show the finished state briefly, then get out of the way.
  useEffect(() => {
    if (progress?.stage !== "done") return;
    const t = window.setTimeout(() => setProgress(null), 700);
    return () => window.clearTimeout(t);
  }, [progress?.stage]);

  async function switchTenant(tenantId: string, schoolName: string) {
    setOpen(false);
    let stage: SchoolSwitchStage = "access";
    setProgress({ schoolName, stage });
    const fail = () => setProgress({ schoolName, stage: "error", failedStage: stage });
    try {
      const res = await fetch("/api/auth/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) return fail();

      stage = "session";
      setProgress({ schoolName, stage });
      await update({ targetTenantId: tenantId });

      stage = "loading";
      startNavigation(() => {
        router.push("/home");
        router.refresh();
      });
      setProgress({ schoolName, stage });
    } catch {
      fail();
    }
  }

  const initial = currentTenantName.charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_28%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-lowest)_92%,transparent)] px-3 py-1.5 shadow-sm calm-transition hover:bg-[var(--surface-container-low)] anx-hover-elevate hover:shadow-md disabled:opacity-60 motion-safe:active:scale-[0.99]"
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
        <div className="absolute left-0 top-full z-50 mt-1.5 min-w-[220px] origin-top rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[color-mix(in_srgb,var(--surface-container-lowest)_96%,transparent)] py-1 shadow-xl backdrop-blur-xl motion-safe:animate-page-enter">
          {tenants.map((t) => (
            <button
              key={t.tenantId}
              type="button"
              onClick={() => !t.isCurrent && switchTenant(t.tenantId, t.tenantName)}
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

      {progress ? (
        <SchoolSwitchProgress
          schoolName={progress.schoolName}
          stage={progress.stage}
          failedStage={progress.failedStage}
          onClose={() => setProgress(null)}
        />
      ) : null}
    </div>
  );
}
