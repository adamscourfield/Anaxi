"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  assertAdminCanMutateUser,
  assertAdminCannotAssignSuperAdminRole,
  requireAdminUser,
} from "@/lib/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

function actionError(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "FORBIDDEN") return "You do not have permission to change this user.";
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

async function runAction(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdminUser();
    const fullName = String(formData.get("fullName") || "").trim();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const role = String(formData.get("role") || "TEACHER");
    if (!fullName || !email) throw new Error("Name and email are required.");
    assertAdminCannotAssignSuperAdminRole(admin, role);
    const password = String(formData.get("password") || "Password123!");
    const hash = await bcrypt.hash(password, 10);
    await (prisma as any).user.create({
      data: {
        tenantId: admin.tenantId,
        fullName,
        email,
        role,
        passwordHash: hash,
        isActive: true,
        canApproveAllLoa: false,
        receivesOnCallEmails: false,
      },
    });
  });
}

export async function toggleActive(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    await assertAdminCanMutateUser(admin, id, admin.tenantId);
    const active = String(formData.get("active")) === "true";
    await (prisma as any).user.updateMany({
      where: { id, tenantId: admin.tenantId },
      data: { isActive: !active },
    });
  });
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    await assertAdminCanMutateUser(admin, id, admin.tenantId);
    const password = String(formData.get("password") || "Password123!");
    const hash = await bcrypt.hash(password, 10);
    await (prisma as any).user.updateMany({
      where: { id, tenantId: admin.tenantId },
      data: { passwordHash: hash },
    });
  });
}

export async function updateUserRole(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdminUser();
    const userId = String(formData.get("userId") || "");
    const role = String(formData.get("role") || "");
    if (!userId || !role) throw new Error("User and role are required.");
    await assertAdminCanMutateUser(admin, userId, admin.tenantId);
    assertAdminCannotAssignSuperAdminRole(admin, role);
    await (prisma as any).user.updateMany({
      where: { id: userId, tenantId: admin.tenantId },
      data: { role },
    });
  });
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdminUser();
    const userId = String(formData.get("userId") || "");
    const role = String(formData.get("role") || "");
    const receivesOnCallEmails = String(formData.get("receivesOnCallEmails")) === "true";
    const canApproveAllLoa = String(formData.get("canApproveAllLoa")) === "true";
    const scopedLoaRaw = String(formData.get("scopedLoaTargetIds") || "");
    const scopedLoaTargetIds = scopedLoaRaw ? scopedLoaRaw.split(",").filter(Boolean) : [];

    if (!userId) throw new Error("User is required.");

    await assertAdminCanMutateUser(admin, userId, admin.tenantId);
    assertAdminCannotAssignSuperAdminRole(admin, role);

    await (prisma as any).user.updateMany({
      where: { id: userId, tenantId: admin.tenantId },
      data: { role, receivesOnCallEmails, canApproveAllLoa },
    });

    await (prisma as any).lOAApprovalScope.deleteMany({
      where: { tenantId: admin.tenantId, approverId: userId },
    });
    if (!canApproveAllLoa && scopedLoaTargetIds.length > 0) {
      await (prisma as any).lOAApprovalScope.createMany({
        data: scopedLoaTargetIds.map((targetUserId) => ({
          tenantId: admin.tenantId,
          approverId: userId,
          targetUserId,
        })),
      });
    }
  });
}
