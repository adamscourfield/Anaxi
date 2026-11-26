import { prisma } from "@/lib/prisma";
import type { ViewerContext } from "@/modules/authz";

/**
 * Which teachers' attainment attribution a viewer may see.
 * Admins and SLT see everyone. A head of department sees the teachers in the departments
 * they lead (themselves included), matching the teaching explorer. Returns null for "everyone".
 */
export async function visibleAttainmentTeacherIds(
  tenantId: string,
  viewer: ViewerContext,
): Promise<Set<string> | null> {
  if (viewer.role === "ADMIN" || viewer.role === "SUPER_ADMIN" || viewer.role === "SLT") return null;
  if (viewer.role !== "HOD") return new Set([viewer.userId]);
  if (!viewer.hodDepartmentIds.length) return new Set([viewer.userId]);
  const members = await prisma.departmentMembership.findMany({
    where: { tenantId, departmentId: { in: viewer.hodDepartmentIds } },
    select: { userId: true },
  });
  return new Set([viewer.userId, ...members.map((m) => m.userId)]);
}

export function filterVisibleTeachers<T extends { teacherId: string }>(rows: T[], visible: Set<string> | null): T[] {
  return visible ? rows.filter((r) => visible.has(r.teacherId)) : rows;
}
