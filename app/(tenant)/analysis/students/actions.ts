"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { canViewStudentAnalysis } from "@/modules/authz";

export async function toggleWatchlist(studentId: string): Promise<{ onWatchlist: boolean }> {
  const user = await getSessionUserOrThrow();

  // RBAC: same rules as viewing
  const canView = canViewStudentAnalysis({
    userId: user.id,
    role: user.role,
    hodDepartmentIds: [],
    coacheeUserIds: [],
  });
  if (!canView && user.role !== "TEACHER" && user.role !== "LEADER") {
    throw new Error("FORBIDDEN");
  }

  const existing = await (prisma as any).studentWatchlist.findUnique({
    where: {
      tenantId_studentId_createdByUserId: {
        tenantId: user.tenantId,
        studentId,
        createdByUserId: user.id,
      },
    },
  });

  if (existing) {
    await (prisma as any).studentWatchlist.delete({ where: { id: existing.id } });
    revalidatePath("/analytics");
    revalidatePath("/explorer/students");
    revalidatePath("/students/my");
    return { onWatchlist: false };
  } else {
    await (prisma as any).studentWatchlist.create({
      data: {
        tenantId: user.tenantId,
        studentId,
        createdByUserId: user.id,
      },
    });
    revalidatePath("/analytics");
    revalidatePath("/explorer/students");
    revalidatePath("/students/my");
    return { onWatchlist: true };
  }
}

export async function bulkToggleWatchlist(
  studentIds: string[],
  add: boolean,
): Promise<{ updated: number }> {
  const user = await getSessionUserOrThrow();

  const canView = canViewStudentAnalysis({
    userId: user.id,
    role: user.role,
    hodDepartmentIds: [],
    coacheeUserIds: [],
  });
  if (!canView && user.role !== "TEACHER") throw new Error("FORBIDDEN");

  const unique = [...new Set(studentIds.filter(Boolean))];
  if (unique.length === 0) return { updated: 0 };

  if (add) {
    const existing = await (prisma as any).studentWatchlist.findMany({
      where: {
        tenantId: user.tenantId,
        createdByUserId: user.id,
        studentId: { in: unique },
      },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((e: { studentId: string }) => e.studentId));
    const toCreate = unique.filter((id) => !existingIds.has(id));
    if (toCreate.length > 0) {
      await (prisma as any).studentWatchlist.createMany({
        data: toCreate.map((studentId) => ({
          tenantId: user.tenantId,
          studentId,
          createdByUserId: user.id,
        })),
        skipDuplicates: true,
      });
    }
  } else {
    await (prisma as any).studentWatchlist.deleteMany({
      where: {
        tenantId: user.tenantId,
        createdByUserId: user.id,
        studentId: { in: unique },
      },
    });
  }

  revalidatePath("/analytics");
  revalidatePath("/explorer/students");
  revalidatePath("/students/my");
  return { updated: unique.length };
}
