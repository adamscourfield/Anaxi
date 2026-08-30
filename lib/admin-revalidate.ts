import { revalidatePath } from "next/cache";
import type { AdminSectionId } from "@/lib/admin-sections";

/** Revalidate the SPA shell and legacy segment routes used by server actions. */
export function revalidateAdmin(...sections: AdminSectionId[]) {
  revalidatePath("/admin");
  const legacy: Partial<Record<AdminSectionId, string>> = {
    users: "/admin/users",
    "users-import": "/admin/users/import",
    departments: "/admin/departments",
    coaching: "/admin/coaching",
    "leave-approvals": "/admin/leave-approvals",
    settings: "/admin/settings",
    language: "/admin/language",
    signals: "/admin/signals",
    "email-log": "/admin/email-log",
    taxonomies: "/admin/taxonomies",
    subjects: "/admin/subjects",
    timetable: "/admin/timetable",
    imports: "/admin/imports",
  };
  for (const section of sections) {
    const path = legacy[section];
    if (path) revalidatePath(path);
  }
}
