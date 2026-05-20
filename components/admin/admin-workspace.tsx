"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { UserRole } from "@/lib/types";
import type { AdminSectionId } from "@/lib/admin-sections";
import { adminSectionPath, parseAdminSection } from "@/lib/admin-sections";
import { buildAdminHubSections } from "@/lib/admin-hub-nav";
import { AdminWorkspaceContext } from "@/components/admin/admin-workspace-context";

export type AdminWorkspacePanels = {
  overview: ReactNode;
  users: ReactNode;
  usersImport: ReactNode;
  departments: ReactNode;
  coaching: ReactNode;
  leaveApprovals: ReactNode;
  settings: ReactNode;
  language: ReactNode;
  signals: ReactNode;
  emailLog: ReactNode;
  taxonomies: ReactNode;
  timetable: ReactNode;
  imports: ReactNode;
};

const PANEL_KEY: Record<AdminSectionId, keyof AdminWorkspacePanels> = {
  overview: "overview",
  users: "users",
  "users-import": "usersImport",
  departments: "departments",
  coaching: "coaching",
  "leave-approvals": "leaveApprovals",
  settings: "settings",
  language: "language",
  signals: "signals",
  "email-log": "emailLog",
  taxonomies: "taxonomies",
  timetable: "timetable",
  imports: "imports",
};

function readSectionFromWindow(): AdminSectionId {
  if (typeof window === "undefined") return "overview";
  return parseAdminSection(new URLSearchParams(window.location.search).get("section"));
}

export function AdminWorkspace({
  role,
  initialSection,
  panels,
}: {
  role: UserRole;
  initialSection: AdminSectionId;
  panels: AdminWorkspacePanels;
}) {
  const [activeSection, setActiveSection] = useState<AdminSectionId>(initialSection);
  const [mounted, setMounted] = useState<Set<AdminSectionId>>(() => new Set([initialSection]));
  const navSections = buildAdminHubSections(role);

  const selectSection = useCallback((section: AdminSectionId) => {
    setActiveSection(section);
    setMounted((prev) => new Set(prev).add(section));
    const path = adminSectionPath(section);
    window.history.replaceState(null, "", path);
  }, []);

  useEffect(() => {
    setActiveSection(initialSection);
    setMounted((prev) => new Set(prev).add(initialSection));
  }, [initialSection]);

  useEffect(() => {
    const onPopState = () => {
      const next = readSectionFromWindow();
      setActiveSection(next);
      setMounted((prev) => new Set(prev).add(next));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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
                        aria-current={isActive ? "page" : undefined}
                        className={`block w-full px-4 py-2.5 text-left text-[0.8125rem] font-semibold calm-transition ${
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
        {[...mounted].map((sectionId) => {
          const key = PANEL_KEY[sectionId];
          const panel = panels[key];
          const visible = sectionId === activeSection;
          return (
            <div
              key={sectionId}
              id={`admin-panel-${sectionId}`}
              hidden={!visible}
              className={visible ? undefined : "hidden"}
              aria-hidden={!visible}
              style={visible ? undefined : { contentVisibility: "hidden" }}
            >
              {panel}
            </div>
          );
        })}
      </div>
    </div>
    </AdminWorkspaceContext.Provider>
  );
}
