"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendOnboardingEmail } from "@/lib/email";
import { avatarUploadErrorMessage, readAvatarFile } from "@/lib/avatarUpload";
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
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await assertSafeServerAction(formData);
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
    const user = await (prisma as any).user.create({
      data: {
        tenantId: admin.tenantId,
        fullName,
        email,
        role,
        passwordHash: hash,
        isActive: true,
        canApproveAllLoa: false,
        receivesOnCallEmails: false,
        receivesFirstAidEmails: false,
      },
    });

    // Fire-and-forget — email failures should not block staff creation.
    sendOnboardingEmail({
      to: email,
      fullName,
      tenantId: admin.tenantId,
      userId: user.id,
    }).catch((err) => {
      console.error("[users] onboarding email failed", email, err);
    });
  });
}

export async function deleteUser(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await assertSafeServerAction(formData);
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    if (!id) throw new Error("User is required.");
    if (id === admin.id) throw new Error("You cannot delete your own account.");
    await assertAdminCanMutateUser(admin, id, admin.tenantId);

    const [observationCount, loaCount, onCallCount] = await Promise.all([
      prisma.observation.count({
        where: { tenantId: admin.tenantId, OR: [{ observedTeacherId: id }, { observerId: id }] },
      }),
      prisma.lOARequest.count({ where: { tenantId: admin.tenantId, requesterId: id } }),
      (prisma as any).onCallRequest.count({ where: { tenantId: admin.tenantId, requesterUserId: id } }),
    ]);
    const blockers: string[] = [];
    if (observationCount > 0) blockers.push(`${observationCount} observation${observationCount === 1 ? "" : "s"}`);
    if (loaCount > 0) blockers.push(`${loaCount} leave request${loaCount === 1 ? "" : "s"}`);
    if (onCallCount > 0) blockers.push(`${onCallCount} on-call request${onCallCount === 1 ? "" : "s"}`);
    if (blockers.length > 0) {
      throw new Error(`This user has ${blockers.join(", ")} on record and can't be deleted. Deactivate them instead.`);
    }

    try {
      await (prisma as any).user.deleteMany({ where: { id, tenantId: admin.tenantId } });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2003") {
        throw new Error(
          "This user has other associated records (e.g. meetings, imports, or timetable data) and can't be deleted. Deactivate them instead."
        );
      }
      throw e;
    }
  });
}

export async function setUserAvatar(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await assertSafeServerAction(formData);
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    if (!id) throw new Error("User is required.");
    await assertAdminCanMutateUser(admin, id, admin.tenantId);

    if (String(formData.get("remove")) === "true") {
      await (prisma as any).user.updateMany({
        where: { id, tenantId: admin.tenantId },
        data: { avatarImage: null, avatarMimeType: null, avatarUpdatedAt: null },
      });
      return;
    }

    const file = formData.get("avatar");
    if (!(file instanceof File)) throw new Error(avatarUploadErrorMessage("EMPTY_FILE"));
    let bytes: Buffer;
    let mimeType: string;
    try {
      ({ bytes, mimeType } = await readAvatarFile(file));
    } catch (e) {
      throw new Error(avatarUploadErrorMessage(e instanceof Error ? e.message : ""));
    }

    await (prisma as any).user.updateMany({
      where: { id, tenantId: admin.tenantId },
      data: { avatarImage: bytes, avatarMimeType: mimeType, avatarUpdatedAt: new Date() },
    });
  });
}

export async function toggleActive(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await assertSafeServerAction(formData);
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
    await assertSafeServerAction(formData);
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
    await assertSafeServerAction(formData);
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
    await assertSafeServerAction(formData);
    const admin = await requireAdminUser();
    const userId = String(formData.get("userId") || "");
    const role = String(formData.get("role") || "");
    const receivesOnCallEmails = String(formData.get("receivesOnCallEmails")) === "true";
    const receivesFirstAidEmails = String(formData.get("receivesFirstAidEmails")) === "true";
    const emailObservations = String(formData.get("emailObservations")) !== "false";
    const emailMeetings = String(formData.get("emailMeetings")) !== "false";
    const emailLeave = String(formData.get("emailLeave")) !== "false";
    const canApproveAllLoa = String(formData.get("canApproveAllLoa")) === "true";
    const scopedLoaRaw = String(formData.get("scopedLoaTargetIds") || "");
    const scopedLoaTargetIds = scopedLoaRaw ? scopedLoaRaw.split(",").filter(Boolean) : [];

    if (!userId) throw new Error("User is required.");

    await assertAdminCanMutateUser(admin, userId, admin.tenantId);
    assertAdminCannotAssignSuperAdminRole(admin, role);

    await (prisma as any).user.updateMany({
      where: { id: userId, tenantId: admin.tenantId },
      data: {
        role,
        receivesOnCallEmails,
        receivesFirstAidEmails,
        emailObservations,
        emailMeetings,
        emailLeave,
        canApproveAllLoa,
      },
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
