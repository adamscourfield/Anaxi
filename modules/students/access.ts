import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";

const TEACHER_SCOPED_ROLES = new Set<SessionUser["role"]>(["TEACHER", "LEADER"]);

export function isTeacherScopedStudentViewer(user: SessionUser): boolean {
  return TEACHER_SCOPED_ROLES.has(user.role);
}

export async function getAccessibleStudentIdsForUser(user: SessionUser): Promise<Set<string> | null> {
  if (!isTeacherScopedStudentViewer(user)) return null;

  const links = await (prisma as any).studentSubjectTeacher.findMany({
    where: {
      tenantId: user.tenantId,
      teacherId: user.id,
      student: { status: "ACTIVE" },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
    },
    select: { studentId: true },
  });

  return new Set((links as Array<{ studentId: string }>).map((link) => link.studentId));
}

export async function canAccessStudentRecord(user: SessionUser, studentId: string): Promise<boolean> {
  const accessibleIds = await getAccessibleStudentIdsForUser(user);
  return accessibleIds === null || accessibleIds.has(studentId);
}
