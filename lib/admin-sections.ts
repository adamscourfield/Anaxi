export const ADMIN_SECTIONS = [
  "overview",
  "users",
  "users-import",
  "departments",
  "coaching",
  "leave-approvals",
  "settings",
  "language",
  "signals",
  "email-log",
  "taxonomies",
  "timetable",
  "imports",
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number];

const LEGACY_PATH_TO_SECTION: Record<string, AdminSectionId> = {
  "/admin": "overview",
  "/admin/users": "users",
  "/admin/users/import": "users-import",
  "/admin/departments": "departments",
  "/admin/coaching": "coaching",
  "/admin/leave-approvals": "leave-approvals",
  "/admin/settings": "settings",
  "/admin/language": "language",
  "/admin/signals": "signals",
  "/admin/email-log": "email-log",
  "/admin/taxonomies": "taxonomies",
  "/admin/timetable": "timetable",
  "/admin/imports": "imports",
};

export function isAdminSectionId(value: string): value is AdminSectionId {
  return (ADMIN_SECTIONS as readonly string[]).includes(value);
}

export function parseAdminSection(
  value: string | string[] | undefined | null,
  fallback: AdminSectionId = "overview",
): AdminSectionId {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && isAdminSectionId(raw)) return raw;
  return fallback;
}

export function sectionFromLegacyPath(pathname: string): AdminSectionId | null {
  if (pathname in LEGACY_PATH_TO_SECTION) return LEGACY_PATH_TO_SECTION[pathname];
  if (pathname.startsWith("/admin/users/import")) return "users-import";
  return null;
}

/** Build `/admin?section=…` preserving extra query params (e.g. taxonomy tab). */
export function adminSectionPath(
  section: AdminSectionId,
  extra?: Record<string, string | undefined | null>,
): string {
  const params = new URLSearchParams();
  if (section !== "overview") params.set("section", section);
  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      if (val != null && val !== "") params.set(key, val);
    }
  }
  const qs = params.toString();
  return qs ? `/admin?${qs}` : "/admin";
}
