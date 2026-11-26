"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { getAccessibleStudentIdsForUser } from "@/modules/students/access";
import type { SessionUser } from "@/lib/types";

/**
 * A watchlist is personal, so anyone who can see a student can star them.
 * Ids are narrowed to students in this school that this person can see:
 * everyone for senior leaders, their own classes for teachers.
 */
async function allowedStudentIds(user: SessionUser, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id))].slice(0, 500);
  if (unique.length === 0) return [];
  const [inTenant, accessible] = await Promise.all([
    (prisma as any).student.findMany({
      where: { tenantId: user.tenantId, id: { in: unique } },
      select: { id: true },
    }),
    getAccessibleStudentIdsForUser(user),
  ]);
  return (inTenant as { id: string }[]).map((s) => s.id).filter((id) => accessible === null || accessible.has(id));
}

function revalidateWatchlistViews() {
  revalidatePath("/insights/priorities");
  revalidatePath("/students");
  revalidatePath("/insights/students");
  revalidatePath("/insights");
  revalidatePath("/students/my");
}

export async function toggleWatchlist(studentId: string): Promise<{ onWatchlist: boolean }> {
  await assertSafeServerAction();
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  const [id] = await allowedStudentIds(user, [studentId]);
  if (!id) throw new Error("FORBIDDEN");

  const key = { tenantId: user.tenantId, studentId: id, createdByUserId: user.id };
  const existing = await (prisma as any).studentWatchlist.findUnique({
    where: { tenantId_studentId_createdByUserId: key },
  });
  if (existing) await (prisma as any).studentWatchlist.delete({ where: { id: existing.id } });
  else await (prisma as any).studentWatchlist.create({ data: key });
  revalidateWatchlistViews();
  return { onWatchlist: !existing };
}

export async function bulkToggleWatchlist(
  studentIds: string[],
  add: boolean,
): Promise<{ updated: number }> {
  await assertSafeServerAction();
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  const ids = await allowedStudentIds(user, studentIds);
  if (ids.length === 0) return { updated: 0 };

  if (add) {
    await (prisma as any).studentWatchlist.createMany({
      data: ids.map((studentId) => ({ tenantId: user.tenantId, studentId, createdByUserId: user.id })),
      skipDuplicates: true,
    });
  } else {
    await (prisma as any).studentWatchlist.deleteMany({
      where: { tenantId: user.tenantId, createdByUserId: user.id, studentId: { in: ids } },
    });
  }
  revalidateWatchlistViews();
  return { updated: ids.length };
}
