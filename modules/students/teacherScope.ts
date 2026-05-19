import { prisma } from "@/lib/prisma";

/** Active student IDs taught by this teacher (any current subject assignment). */
export async function getTeacherStudentIds(
  tenantId: string,
  teacherId: string,
): Promise<Set<string>> {
  const now = new Date();
  const links = await (prisma as any).studentSubjectTeacher.findMany({
    where: {
      tenantId,
      teacherId,
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    select: { studentId: true },
  });
  return new Set(links.map((l: { studentId: string }) => l.studentId));
}
