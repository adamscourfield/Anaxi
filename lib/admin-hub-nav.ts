import type { UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/rbac";
import type { AdminSectionId } from "@/lib/admin-sections";

export type AdminHubNavItem = {
  section: AdminSectionId;
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

export function buildAdminHubSections(role: UserRole): AdminHubNavSection[] {
  const canAccessAdmin = hasPermission(role, "admin:access");
  const canAccessAdminUsers = hasPermission(role, "admin:users");
  const canAccessAdminSettings = hasPermission(role, "admin:settings");

  return [
    {
      title: "Overview",
      items: [...(canAccessAdmin ? [{ section: "overview" as const, label: "Admin Pulse" }] : [])],
    },
    {
      title: "People & access",
      items: [
        ...(canAccessAdminUsers ? [{ section: "users" as const, label: "Users" }] : []),
        ...(canAccessAdminSettings ? [{ section: "departments" as const, label: "Departments" }] : []),
        ...(canAccessAdminSettings ? [{ section: "coaching" as const, label: "Coaching" }] : []),
        ...(canAccessAdminSettings ? [{ section: "leave-approvals" as const, label: "Leave approvals" }] : []),
      ],
    },
    {
      title: "Platform & language",
      items: [
        ...(canAccessAdminSettings ? [{ section: "settings" as const, label: "School settings" }] : []),
        ...(canAccessAdminSettings ? [{ section: "language" as const, label: "Language" }] : []),
        ...(canAccessAdminSettings ? [{ section: "signals" as const, label: "Signals" }] : []),
        ...(canAccessAdmin ? [{ section: "email-log" as const, label: "Email log" }] : []),
      ],
    },
    {
      title: "Data & imports",
      items: [
        ...(canAccessAdminSettings ? [{ section: "taxonomies" as const, label: "Taxonomies" }] : []),
        ...(canAccessAdminSettings ? [{ section: "timetable" as const, label: "Timetable" }] : []),
        ...(canAccessAdmin ? [{ section: "imports" as const, label: "Import jobs" }] : []),
      ],
    },
  ].filter((section) => section.items.length > 0);
}

/** Flat list of section ids visible in the admin nav for a role. */
export function flatAdminNavSections(role: UserRole): AdminSectionId[] {
  return buildAdminHubSections(role).flatMap((group) => group.items.map((item) => item.section));
}
