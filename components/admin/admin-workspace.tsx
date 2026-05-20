"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@/lib/types";
import type { AdminSectionId } from "@/lib/admin-sections";
import { adminSectionPath, parseAdminSection } from "@/lib/admin-sections";
import { buildAdminHubSections, flatAdminNavSections } from "@/lib/admin-hub-nav";
import { adminBackgroundPrefetchSections, staggeredAdminPrefetch } from "@/lib/admin-prefetch";
import {
  decideUrlSectionSync,
  shouldShowPanelSkeleton,
  type AdminSectionExtra,
} from "@/lib/admin-workspace-nav";
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
  const desiredSectionRef = useRef<AdminSectionId>(urlSection);
  const inFlightDesiredRef = useRef<AdminSectionId | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSectionId>(urlSection);
  const [panelCache, setPanelCache] = useState<Partial<Record<AdminSectionId, ReactNode>>>({});
  const [isPending, startTransition] = useTransition();
  const navSections = buildAdminHubSections(role);
  const prefetched = useRef(new Set<AdminSectionId>([urlSection]));
  const backgroundPrefetchStarted = useRef(false);
  const cacheRef = useRef(panelCache);
  cacheRef.current = panelCache;

  useEffect(() => {
    if (children) {
      setPanelCache((prev) => ({ ...prev, [urlSection]: children }));
    }

    const sync = decideUrlSectionSync(urlSection, desiredSectionRef.current, inFlightDesiredRef.current);

    if (sync === "apply") {
      setActiveSection(urlSection);
      inFlightDesiredRef.current = null;
      return;
    }

    if (sync === "external") {
      desiredSectionRef.current = urlSection;
      setActiveSection(urlSection);
      inFlightDesiredRef.current = null;
    }
  }, [urlSection, children]);

  const prefetchSection = useCallback(
    (section: AdminSectionId, extra?: AdminSectionExtra) => {
      if (prefetched.current.has(section) || cacheRef.current[section]) return;
      prefetched.current.add(section);
      router.prefetch(adminSectionPath(section, extra));
    },
    [router],
  );

  useEffect(() => {
    if (backgroundPrefetchStarted.current) return;

    const overviewReady =
      cacheRef.current.overview != null || (urlSection === "overview" && children != null);
    if (!overviewReady) return;

    backgroundPrefetchStarted.current = true;

    const flat = flatAdminNavSections(role);
    const toWarm = adminBackgroundPrefetchSections(flat).filter(
      (section) => !prefetched.current.has(section) && !cacheRef.current[section],
    );

    if (toWarm.length === 0) return;

    return staggeredAdminPrefetch(toWarm, (section) => prefetchSection(section), { gapMs: 120 });
  }, [role, urlSection, children, prefetchSection]);

  const selectSection = useCallback(
    (section: AdminSectionId, extra?: AdminSectionExtra) => {
      desiredSectionRef.current = section;
      inFlightDesiredRef.current = section;
      setActiveSection(section);

      startTransition(() => {
        router.replace(adminSectionPath(section, extra));
      });
    },
    [router],
  );

  useEffect(() => {
    const onPopState = () => {
      const next = readSectionFromWindow();
      desiredSectionRef.current = next;
      inFlightDesiredRef.current = null;
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
  const showSkeleton = shouldShowPanelSkeleton(Boolean(cachedPanel), isPending);
  const panelContent =
    cachedPanel ?? (urlSection === activeSection && !isPending && children ? children : null);

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
                          disabled={isPending}
                          className={`block w-full px-4 py-2.5 text-left text-[0.8125rem] font-semibold calm-transition disabled:cursor-wait disabled:opacity-60 ${
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
          {!showSkeleton && panelContent ? (
            <div key={activeSection} id={`admin-panel-${activeSection}`}>
              {panelContent}
            </div>
          ) : null}
          {!showSkeleton && !panelContent ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-[var(--surface-container-low)]/40 px-6 py-12 text-center">
              <p className="text-sm font-medium text-text">This section could not be loaded.</p>
              <button
                type="button"
                onClick={() => selectSection(activeSection)}
                className="mt-3 text-sm font-semibold text-accent hover:text-accentHover calm-transition"
              >
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </AdminWorkspaceContext.Provider>
  );
}
