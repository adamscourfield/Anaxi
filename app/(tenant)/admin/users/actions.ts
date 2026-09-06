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

export type ActionResult =
  | { ok: true; linked?: boolean; linkedNewPassword?: boolean }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "FORBIDDEN") return "You do not have permission to change this user.";
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

async function runAction(
  fn: () => Promise<{ linked?: boolean; linkedNewPassword?: boolean } | void>,
): Promise<ActionResult> {
  try {
    const extra = await fn();
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { ok: true, linked: extra?.linked, linkedNewPassword: extra?.linkedNewPassword };
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

    // "Link accounts" reuses an existing password hash from another school's
    // account for this same email, instead of setting a brand new password --
    // so the person signs into every school with one email + one password
    // (picking which school at login) rather than juggling a separate
    // account per school. We only ever copy the hash, never the plaintext.
    //
    // The other account may not have a password yet at all (e.g. bulk-imported
    // staff who haven't clicked their "set your password" link) -- in that case
    // there's nothing to copy, so instead we hash the temporary password entered
    // here and write it to BOTH rows, so the same credentials unlock either school.
    const wantsLink = formData.get("linkExisting") === "true";
    let passwordHash: string | null = null;
    let linked = false;
    let linkedNewPassword = false;
    let existingWithoutPasswordId: string | null = null;
    if (wantsLink) {
      const existing = await prisma.user.findFirst({
        where: { email, isActive: true, tenantId: { not: admin.tenantId } },
        orderBy: { id: "asc" },
        select: { id: true, passwordHash: true },
      });
      if (existing?.passwordHash) {
        passwordHash = existing.passwordHash;
        linked = true;
      } else if (existing) {
        existingWithoutPasswordId = existing.id;
      }
    }
    if (!passwordHash) {
      const password = String(formData.get("password") || "Password123!");
      passwordHash = await bcrypt.hash(password, 10);
    }
    if (existingWithoutPasswordId) {
      await prisma.user.update({
        where: { id: existingWithoutPasswordId },
        data: { passwordHash },
      });
      linked = true;
      linkedNewPassword = true;
    }

    const user = await (prisma as any).user.create({
      data: {
        tenantId: admin.tenantId,
        fullName,
        email,
        role,
        passwordHash,
        isActive: true,
        canApproveAllLoa: false,
        receivesOnCallEmails: false,
        receivesFirstAidEmails: false,
      },
    });

    // Someone linked to an account that already had a working password knows
    // it already -- an onboarding "set your password" email would be misleading.
    // But if we just set a brand new shared password (linkedNewPassword), they
    // still need to be told it, same as any other new account.
    if (!linked || linkedNewPassword) {
      // Fire-and-forget — email failures should not block staff creation.
      sendOnboardingEmail({
        to: email,
        fullName,
        tenantId: admin.tenantId,
        userId: user.id,
      }).catch((err) => {
        console.error("[users] onboarding email failed", email, err);
      });
    }

    return { linked, linkedNewPassword };
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
