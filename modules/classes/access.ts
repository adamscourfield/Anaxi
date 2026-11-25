import "server-only";
import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";

/**
 * Classes shows pupils' attendance, behaviour and attainment, so it follows the
 * same rule as the Students area: the school must have Students switched on and
 * the viewer must be allowed to read student data.
 */
export async function requireClassesAccess(user: { tenantId: string; role: string }) {
  await requireFeature(user.tenantId, "STUDENTS");
  if (!hasPermission(user.role as Parameters<typeof hasPermission>[0], "students:read")) redirect("/home");
}
