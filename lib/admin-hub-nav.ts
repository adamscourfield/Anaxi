import type { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/rbac";

export type AdminHubNavItem = {
  href: string;
  label: string;
};

export type AdminHubNavSection = {
  title: string;
  items: AdminHubNavItem[];
};

/** Paths that use standalone chrome (feature flags stay outside the admin hub). */
export function isAdminHubExcludedPath(pathname: string): boolean {
  return pathname === "/admin/features" || pathname.startsWith("/admin/features/");
}

export function isAdminHubNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function buildAdminHubSections(role: UserRole): AdminHubNavSection[] {
  const canAccessAdmin = hasPermission(role, "admin:access");
  const canAccessAdminUsers = hasPermission(role, "admin:users");
  const canAccessAdminSettings = hasPermission(role, "admin:settings");

  return [
    {
      title: "Overview",
      items: [...(canAccessAdmin ? [{ href: "/admin", label: "Admin Pulse" }] : [])],
    },
    {
      title: "People & access",
      items: [
        ...(canAccessAdminUsers ? [{ href: "/admin/users", label: "Users" }] : []),
        ...(canAccessAdminSettings ? [{ href: "/admin/departments", label: "Departments" }] : []),
        ...(canAccessAdminSettings ? [{ href: "/admin/coaching", label: "Coaching" }] : []),
        ...(canAccessAdminSettings ? [{ href: "/admin/leave-approvals", label: "Leave approvals" }] : []),
      ],
    },
    {
      title: "Platform & language",
      items: [
        ...(canAccessAdminSettings ? [{ href: "/admin/settings", label: "School settings" }] : []),
        ...(canAccessAdminSettings ? [{ href: "/admin/language", label: "Language" }] : []),
        ...(canAccessAdminSettings ? [{ href: "/admin/signals", label: "Signals" }] : []),
        ...(canAccessAdmin ? [{ href: "/admin/email-log", label: "Email log" }] : []),
      ],
    },
    {
      title: "Data & imports",
      items: [
        ...(canAccessAdminSettings ? [{ href: "/admin/taxonomies", label: "Taxonomies" }] : []),
        ...(canAccessAdminSettings ? [{ href: "/admin/timetable", label: "Timetable" }] : []),
        ...(canAccessAdmin ? [{ href: "/admin/imports", label: "Import jobs" }] : []),
      ],
    },
  ].filter((section) => section.items.length > 0);
}
