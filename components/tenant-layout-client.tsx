"use client";

import { useState } from "react";
import Link from "next/link";
import { TenantNav } from "@/components/tenant-nav";
import { SchoolSwitcher } from "@/components/school-switcher";
import { PageTransition } from "@/components/page-transition";
import { NotificationBell } from "@/components/notification-bell";
import { TenantUiProvider } from "@/components/tenant-ui-context";
import { SkipToContent } from "@/components/skip-to-content";
import { FeatureKey, UserRole } from "@/lib/types";

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function userInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatRole(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    SLT: "Senior Leader",
    HOD: "Head of Dept",
    LEADER: "Leader",
    TEACHER: "Teacher",
    HR: "HR",
    ON_CALL: "On Call",
  };
  return map[role] ?? role;
}

type TenantLayoutClientProps = {
  children: React.ReactNode;
  role: UserRole;
  enabledFeatures: FeatureKey[];
  onCallCount: number;
  leaveCount: number;
  coacheeCount?: number;
  tenantName: string;
  tenantOptions: { tenantId: string; tenantName: string; isCurrent: boolean }[];
  userFullName: string | null;
  userEmail: string | null;
  userRole: string;
  avatarUrl: string | null;
};

export function TenantLayoutClient({
  children,
  role,
  enabledFeatures,
  onCallCount,
  leaveCount,
  coacheeCount = 0,
  tenantName,
  tenantOptions,
  userFullName,
  userEmail,
  userRole,
  avatarUrl,
}: TenantLayoutClientProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navProps = {
    role,
    enabledFeatures,
    onCallCount,
    leaveCount,
    coacheeCount,
  };

  const initials = userInitials(userFullName || userEmail || "?");

  return (
    <>
      <SkipToContent targetId="tenant-main" />
      <TenantNav {...navProps} variant="sidebar" />

      {mobileNavOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[var(--overlay)] md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <TenantNav
            {...navProps}
            variant="drawer"
            onNavigate={() => setMobileNavOpen(false)}
          />
        </>
      ) : null}

      <div
        className="anx-workspace-canvas ml-0 flex min-h-screen flex-col calm-transition md:ml-[var(--sidebar-width)]"
        id="tenant-content"
      >
        <header className="anx-top-bar-frost sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6 lg:px-10">
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[var(--on-surface)] calm-transition hover:bg-[var(--surface-container-low)] anx-hover-elevate motion-safe:active:scale-[0.97] md:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-expanded={mobileNavOpen}
            aria-controls="tenant-nav-drawer"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <div className="min-w-0 flex-1">
            <SchoolSwitcher currentTenantName={tenantName} tenants={tenantOptions} />
          </div>
          <NotificationBell />
          <Link
            href="/profile"
            className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 calm-transition hover:bg-[var(--surface-container-low)] anx-hover-elevate motion-safe:active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 sm:gap-3 sm:px-2.5 sm:py-1.5"
          >
            <div className="hidden flex-col items-end sm:flex">
              <span className="max-w-[140px] truncate text-[13px] font-bold leading-tight tracking-[-0.01em] text-[var(--on-surface)]">
                {userFullName || userEmail}
              </span>
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[var(--outline)]">
                {formatRole(userRole)}
              </span>
            </div>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userFullName || userEmail || ""}
                title={userFullName || userEmail || undefined}
                className="h-8 w-8 shrink-0 rounded-md object-cover"
              />
            ) : (
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--on-surface)] text-[11px] font-semibold text-[var(--on-primary)]"
                title={userFullName || userEmail || undefined}
              >
                {initials}
              </span>
            )}
          </Link>
        </header>
        <main id="tenant-main" className="anx-workspace-main min-w-0 flex-1 px-4 py-7 sm:px-6 md:px-8 md:py-10 lg:px-10">
          <PageTransition className="mx-auto min-w-0 max-w-[1400px]">
            <TenantUiProvider role={role} enabledFeatures={enabledFeatures}>
              {children}
            </TenantUiProvider>
          </PageTransition>
        </main>
      </div>
    </>
  );
}
