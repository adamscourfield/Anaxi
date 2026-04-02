"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

function ensureYearGroupLabel(raw: string): string {
  return raw.trim();
}

function incrementYearGroupLabel(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/(\d{1,2})/);
  if (!match) return null;

  const current = Number(match[1]);
  if (!Number.isFinite(current) || current >= 13) return null;

  const next = String(current + 1);
  return trimmed.replace(match[1], next);
}

async function assertStudentWriteAccess() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  if (!hasPermission(user.role, "students:write")) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function archiveStudentAction(formData: FormData) {
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

export async function batchArchiveYearGroupAction(formData: FormData) {
  const user = await assertStudentWriteAccess();
  const yearGroup = ensureYearGroupLabel(String(formData.get("yearGroup") || ""));

  if (!yearGroup) throw new Error("yearGroup is required");

  await (prisma as any).student.updateMany({
    where: { tenantId: user.tenantId, status: "ACTIVE", yearGroup },
    data: { status: "ARCHIVED" },
  });

  revalidatePath("/explorer/students");
  revalidatePath("/on-call/new");
  revalidatePath("/students/import");
  redirect("/students/import?cohort=archived");
}

export async function promoteYearGroupsAction() {
  const user = await assertStudentWriteAccess();

  const activeStudents = await (prisma as any).student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE" },
    select: { id: true, yearGroup: true },
  });

  const updates = (activeStudents as Array<{ id: string; yearGroup: string | null }>)
    .map((student) => {
      if (!student.yearGroup) return null;
      const nextYearGroup = incrementYearGroupLabel(student.yearGroup);
      if (!nextYearGroup) return null;
      return (prisma as any).student.update({
        where: { id: student.id },
        data: { yearGroup: nextYearGroup },
      });
    })
    .filter(Boolean);

  if (updates.length > 0) {
    await prisma.$transaction(updates as any[]);
  }

  revalidatePath("/explorer/students");
  revalidatePath("/on-call/new");
  revalidatePath("/students/import");
  redirect("/students/import?cohort=promoted");
}
