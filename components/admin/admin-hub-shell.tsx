"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { UserRole } from "@/lib/types";
import {
  buildAdminHubSections,
  isAdminHubExcludedPath,
  isAdminHubNavActive,
} from "@/lib/admin-hub-nav";

export function AdminHubShell({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const sections = buildAdminHubSections(role);

  if (isAdminHubExcludedPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <aside
        className="lg:sticky lg:top-6 lg:w-[13.5rem] lg:shrink-0"
        aria-label="Administration sections"
      >
        <nav className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)] bg-[var(--surface-container-lowest)] shadow-none">
          {sections.map((section, sectionIndex) => (
            <div
              key={section.title}
              className={
                sectionIndex > 0
                  ? "border-t border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)]"
                  : ""
              }
            >
              <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/55">
                {section.title}
              </p>
              <ul className="pb-2">
                {section.items.map((item) => {
                  const active = isAdminHubNavActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`block px-4 py-2.5 text-[0.8125rem] font-semibold calm-transition ${
                          active
                            ? "bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface-container-low))] text-text"
                            : "text-muted hover:bg-[var(--surface-container-low)]/60 hover:text-text"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
