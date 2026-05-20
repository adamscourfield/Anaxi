"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { parseAdminSection } from "@/lib/admin-sections";
import { useAdminWorkspace } from "@/components/admin/admin-workspace-context";

function parseAdminHref(href: string) {
  if (!href.startsWith("/admin")) return null;
  try {
    const url = new URL(href, "http://local");
    if (url.pathname !== "/admin") return null;
    const section = parseAdminSection(url.searchParams.get("section"), "overview");
    const extra: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      if (key !== "section" && value) extra[key] = value;
    });
    return { section, extra: Object.keys(extra).length > 0 ? extra : undefined };
  } catch {
    return null;
  }
}

/** In-workspace links switch sections without a full route transition when possible. */
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
  const parsed = parseAdminHref(href);

  if (workspace && parsed) {
    return (
      <button
        type="button"
        onClick={() => workspace.selectSection(parsed.section, parsed.extra)}
        className={className}
      >
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
