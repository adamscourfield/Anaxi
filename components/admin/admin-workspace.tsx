"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@/lib/types";
import type { AdminSectionId } from "@/lib/admin-sections";
import { adminSectionPath, parseAdminSection } from "@/lib/admin-sections";
import { buildAdminHubSections, flatAdminNavSections } from "@/lib/admin-hub-nav";
import { adminBackgroundPrefetchSections, staggeredAdminPrefetch } from "@/lib/admin-prefetch";
import { AdminWorkspaceContext } from "@/components/admin/admin-workspace-context";
import { AdminPanelSkeleton } from "@/components/admin/admin-panel-skeleton";

function readSectionFromWindow(): AdminSectionId {
  if (typeof window === "undefined") return "overview";
  return parseAdminSection(new URLSearchParams(window.location.search).get("section"));
}

export function AdminWorkspace({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSection = parseAdminSection(searchParams.get("section"));
  const [activeSection, setActiveSection] = useState<AdminSectionId>(urlSection);
  const [panelCache, setPanelCache] = useState<Partial<Record<AdminSectionId, ReactNode>>>({});
  const [isPending, startTransition] = useTransition();
  const navSections = buildAdminHubSections(role);
  const prefetched = useRef(new Set<AdminSectionId>([urlSection]));
  const backgroundPrefetchStarted = useRef(false);
  const cacheRef = useRef(panelCache);
  cacheRef.current = panelCache;

  useEffect(() => {
    setActiveSection(urlSection);
    if (children) {
      setPanelCache((prev) => ({ ...prev, [urlSection]: children }));
    }
  }, [urlSection, children]);

  const prefetchSection = useCallback(
    (section: AdminSectionId) => {
      if (prefetched.current.has(section) || cacheRef.current[section]) return;
      prefetched.current.add(section);
      router.prefetch(adminSectionPath(section));
    },
    [router],
  );

  useEffect(() => {
    if (backgroundPrefetchStarted.current) return;

    const overviewReady =
      cacheRef.current.overview != null || (urlSection === "overview" && children != null);
    if (!overviewReady) return;

    backgroundPrefetchStarted.current = true;

    const navSections = flatAdminNavSections(role);
    const toWarm = adminBackgroundPrefetchSections(navSections).filter(
      (section) => !prefetched.current.has(section) && !cacheRef.current[section],
    );

    if (toWarm.length === 0) return;

    return staggeredAdminPrefetch(toWarm, prefetchSection, { gapMs: 120 });
  }, [role, urlSection, children, prefetchSection]);

  const selectSection = useCallback(
    (section: AdminSectionId) => {
      setActiveSection(section);

      if (panelCache[section]) {
        window.history.replaceState(null, "", adminSectionPath(section));
        return;
      }

      startTransition(() => {
        router.replace(adminSectionPath(section));
      });
    },
    [panelCache, router],
  );

  useEffect(() => {
    const onPopState = () => {
      const next = readSectionFromWindow();
      setActiveSection(next);
      if (!cacheRef.current[next]) {
        startTransition(() => {
          router.replace(adminSectionPath(next));
        });
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  const cachedPanel = panelCache[activeSection];
  const awaitingNavigation = !cachedPanel && (isPending || urlSection !== activeSection);
  const showSkeleton = awaitingNavigation;
  const panelContent = cachedPanel ?? (urlSection === activeSection && !isPending ? children : null);

  return (
    <AdminWorkspaceContext.Provider value={{ selectSection }}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <aside
          className="lg:sticky lg:top-6 lg:w-[13.5rem] lg:shrink-0"
          aria-label="Administration sections"
        >
          <nav className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] bg-[var(--surface-container-lowest)] shadow-none">
            {navSections.map((group, groupIndex) => (
              <div
                key={group.title}
                className={
                  groupIndex > 0
                    ? "border-t border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)]"
                    : ""
                }
              >
                <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/55">
                  {group.title}
                </p>
                <ul className="pb-2">
                  {group.items.map((item) => {
                    const isActive = activeSection === item.section;
                    return (
                      <li key={item.section}>
                        <button
                          type="button"
                          onClick={() => selectSection(item.section)}
                          onMouseEnter={() => prefetchSection(item.section)}
                          onFocus={() => prefetchSection(item.section)}
                          aria-current={isActive ? "page" : undefined}
                          disabled={isPending && isActive && !cachedPanel}
                          className={`block w-full px-4 py-2.5 text-left text-[0.8125rem] font-semibold calm-transition disabled:opacity-60 ${
                            isActive
                              ? "bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface-container-low))] text-text"
                              : "text-muted hover:bg-[var(--surface-container-low)]/60 hover:text-text"
                          }`}
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {showSkeleton ? <AdminPanelSkeleton section={activeSection} /> : null}
          {!showSkeleton ? (
            <>
              {(
                Object.keys(panelCache) as AdminSectionId[]
              ).map((sectionId) => {
                if (sectionId === activeSection) return null;
                const node = panelCache[sectionId];
                if (!node) return null;
                return (
                  <div key={sectionId} id={`admin-panel-${sectionId}`} hidden aria-hidden style={{ contentVisibility: "hidden" }}>
                    {node}
                  </div>
                );
              })}
              {panelContent ? (
                <div key={activeSection} id={`admin-panel-${activeSection}`}>
                  {panelContent}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </AdminWorkspaceContext.Provider>
  );
}
