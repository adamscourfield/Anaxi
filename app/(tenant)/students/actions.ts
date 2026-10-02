"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

async function assertStudentWriteAccess() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  if (!hasPermission(user.role, "students:write")) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function archiveStudentAction(formData: FormData) {
  await assertSafeServerAction(formData);
  const user = await assertStudentWriteAccess();
  const studentId = String(formData.get("studentId") || "").trim();
  const returnTo = String(formData.get("returnTo") || "/students");

  if (!studentId) throw new Error("studentId is required");

  await (prisma as any).student.updateMany({
    where: { id: studentId, tenantId: user.tenantId },
    data: { status: "ARCHIVED" },
  });

  revalidatePath("/explorer/students");
  revalidatePath("/on-call/new");
  revalidatePath(`/students/${studentId}`);
  redirect(returnTo);
}

export async function unarchiveStudentAction(formData: FormData) {
  await assertSafeServerAction(formData);
  const user = await assertStudentWriteAccess();
  const studentId = String(formData.get("studentId") || "").trim();
  const returnTo = String(formData.get("returnTo") || "/students");

  if (!studentId) throw new Error("studentId is required");

  await (prisma as any).student.updateMany({
    where: { id: studentId, tenantId: user.tenantId },
    data: { status: "ACTIVE" },
  });

  revalidatePath("/explorer/students");
  revalidatePath("/on-call/new");
  revalidatePath(`/students/${studentId}`);
  redirect(returnTo);
}

export async function bulkSetStudentStatus(
  studentIds: string[],
  status: "ACTIVE" | "ARCHIVED",
): Promise<{ updated: number }> {
  await assertSafeServerAction();
  const user = await assertStudentWriteAccess();

  const ids = [...new Set(studentIds)].filter(Boolean);
  if (ids.length === 0) return { updated: 0 };

  const result = await (prisma as any).student.updateMany({
    where: { id: { in: ids }, tenantId: user.tenantId },
    data: { status },
  });

  revalidatePath("/explorer/students");
  revalidatePath("/students/my");
  revalidatePath("/on-call/new");

  return { updated: result.count };
}
