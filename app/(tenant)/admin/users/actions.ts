"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createPasswordSetToken, sendOnboardingEmail, sendPasswordResetEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/email/format";
import { randomUnusablePassword } from "@/lib/randomPassword";

const ADMIN_RESET_LINK_HOURS = 72;
import { avatarUploadErrorMessage, readAvatarFile } from "@/lib/avatarUpload";
import {
  assertAdminCanMutateUser,
  assertAdminCannotAssignSuperAdminRole,
  requireAdminUser,
} from "@/lib/admin";
import { assertCanEditArborOwnedStaffFields } from "@/lib/integrations/arbor/fieldOwnership";
import { fullNameSchema } from "@/lib/validation/schemas";

export type ActionResult =
  | { ok: true; linked?: boolean }
  | { ok: false; error: string };

function actionError(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "FORBIDDEN") return "You do not have permission to change this user.";
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

async function runAction(
  fn: () => Promise<{ linked?: boolean } | void>,
): Promise<ActionResult> {
  try {
    const extra = await fn();
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { ok: true, linked: extra?.linked };
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

    // "Link accounts" copies the password hash from this person's account at
    // another school, so they sign into every school with one email + one
    // password and can switch between them (see lib/linkedAccounts.ts). We only
    // ever copy the hash, never the plaintext, and we never write to the other
    // school's account: an admin here must not be able to set a password there.
    // If the other account has no password yet, there is nothing to link to, so
    // this becomes a normal separate account.
    const wantsLink = formData.get("linkExisting") === "true";
    let passwordHash: string | null = null;
    let linked = false;
    if (wantsLink) {
      const existing = await prisma.user.findFirst({
        where: { email, isActive: true, tenantId: { not: admin.tenantId }, passwordHash: { not: null } },
        orderBy: { id: "asc" },
        select: { passwordHash: true },
      });
      if (existing?.passwordHash) {
        passwordHash = existing.passwordHash;
        linked = true;
      }
    }
    if (!passwordHash) {
      // No password typed: use an unguessable one. The onboarding email lets
      // them set their own.
      const typed = String(formData.get("password") || "");
      passwordHash = await bcrypt.hash(typed || randomUnusablePassword(), 10);
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
    if (!linked) {
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

    return { linked };
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
        data: { avatarImage: null, avatarMimeType: null, avatarUpdatedAt: null, avatarDataSource: "MANUAL" },
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
      data: { avatarImage: bytes, avatarMimeType: mimeType, avatarUpdatedAt: new Date(), avatarDataSource: "MANUAL" },
    });
  });
}

export async function resendOnboardingInvite(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await assertSafeServerAction(formData);
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    if (!id) throw new Error("User is required.");
    await assertAdminCanMutateUser(admin, id, admin.tenantId);

    const user = await prisma.user.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { email: true, fullName: true, isActive: true },
    });
    if (!user) throw new Error("Staff member not found.");
    if (!user.isActive) throw new Error("Reactivate this staff member before resending their invite.");

    const result = await sendOnboardingEmail({
      to: user.email,
      fullName: user.fullName,
      tenantId: admin.tenantId,
      userId: id,
    });
    if (result.status === "failed") {
      throw new Error("Could not send the invite email. Check the email log for details.");
    }
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
    const target = await (prisma as any).user.findFirst({
      where: { id, tenantId: admin.tenantId },
      select: { id: true, email: true, fullName: true },
    });
    if (!target) throw new Error("User not found.");
    // Lock the old password (this school's account only) and email a link to
    // choose a new one. There is no shared default password.
    const hash = await bcrypt.hash(randomUnusablePassword(), 10);
    await (prisma as any).user.updateMany({
      where: { id, tenantId: admin.tenantId },
      data: { passwordHash: hash },
    });
    const token = await createPasswordSetToken(target.id, ADMIN_RESET_LINK_HOURS);
    const result = await sendPasswordResetEmail({
      to: target.email,
      fullName: target.fullName,
      resetUrl: `${getAppUrl()}/login/reset-password?token=${token}`,
      tenantId: admin.tenantId,
      resetByAdmin: { validHours: ADMIN_RESET_LINK_HOURS },
    });
    if (result.status === "failed") {
      throw new Error("Password reset, but the email could not be sent. Check the email log, then use Reset password again.");
    }
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
    const existingUser = await (prisma as any).user.findFirst({
      where: { id: userId, tenantId: admin.tenantId },
      select: { dataSource: true, fullName: true, role: true },
    });
    if (!existingUser) throw new Error("User not found.");
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

    // Name is optional in the payload so older clients that don't send it leave it unchanged.
    const fullNameRaw = formData.get("fullName");
    let fullName: string | undefined;
    if (fullNameRaw !== null) {
      const parsed = fullNameSchema.safeParse(String(fullNameRaw));
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid name.");
      fullName = parsed.data;
    }

    if (!userId) throw new Error("User is required.");

    await assertAdminCanMutateUser(admin, userId, admin.tenantId);
    assertAdminCannotAssignSuperAdminRole(admin, role);
    const existingUser = await (prisma as any).user.findFirst({
      where: { id: userId, tenantId: admin.tenantId },
      select: { dataSource: true, fullName: true, role: true },
    });
    if (!existingUser) throw new Error("User not found.");
    assertCanEditArborOwnedStaffFields(existingUser, {
      ...(fullName !== undefined && { fullName }),
    });

    await (prisma as any).user.updateMany({
      where: { id: userId, tenantId: admin.tenantId },
      data: {
        ...(fullName !== undefined && { fullName }),
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
