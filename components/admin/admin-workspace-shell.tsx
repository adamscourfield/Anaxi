"use client";

import { AdminPanelSkeleton } from "@/components/admin/admin-panel-skeleton";
import { parseAdminSection } from "@/lib/admin-sections";
import { useSearchParams } from "next/navigation";

/** Suspense fallback while AdminWorkspace reads search params. */
export function AdminWorkspaceShellFallback() {
  const searchParams = useSearchParams();
  const section = parseAdminSection(searchParams.get("section"));
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="lg:w-[13.5rem] lg:shrink-0" aria-hidden>
        <div className="h-64 rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] bg-[var(--surface-container-lowest)]" />
      </aside>
      <div className="min-w-0 flex-1">
        <AdminPanelSkeleton section={section} />
      </div>
    </div>
  );
}
