"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { parseAdminSection } from "@/lib/admin-sections";
import { useAdminWorkspace } from "@/components/admin/admin-workspace-context";

function sectionFromAdminHref(href: string) {
  if (!href.startsWith("/admin")) return null;
  try {
    const url = new URL(href, "http://local");
    if (url.pathname !== "/admin") return null;
    const section = url.searchParams.get("section");
    return parseAdminSection(section, "overview");
  } catch {
    return null;
  }
}

/** In-workspace links switch sections without a route transition. */
export function AdminSectionLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const workspace = useAdminWorkspace();
  const section = sectionFromAdminHref(href);

  if (workspace && section && section !== "overview") {
    return (
      <button type="button" onClick={() => workspace.selectSection(section)} className={className}>
        {children}
      </button>
    );
  }

  if (workspace && section === "overview") {
    return (
      <button type="button" onClick={() => workspace.selectSection("overview")} className={className}>
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
