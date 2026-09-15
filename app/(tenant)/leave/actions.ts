"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import { getSessionUserOrThrow } from "@/lib/auth";
import { sendLeaveDecisionEmail, sendLeaveSubmittedEmail } from "@/lib/email";
import { notifyLeaveReviewers } from "@/lib/inAppNotifications";
import { requireFeature } from "@/lib/guards";
import { canManageLoa, loaApproversForRequest } from "@/lib/loa";
import { hasPermission } from "@/lib/rbac";
import { parseLocalDateTimeInput } from "@/lib/leaveDates";
import { generateEvidenceFileToken, medicalEvidencePublicPath, readMedicalEvidenceFile } from "@/lib/leaveMedicalUpload";
import { validateLeavePolicy, type LeavePolicyViolation } from "@/lib/leavePolicy";
import { approvedStatusFilter, isLoaDecisionType, isPendingStatus } from "@/lib/leaveStatus";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function redirectRequestError(code: LeavePolicyViolation | "INVALID_REQUEST" | "INVALID_REASON"): never {
  redirect(`/leave/request?error=${code}`);
}

export async function createLoaRequest(formData: FormData) {
  await assertSafeServerAction(formData);
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");

  const startDate = parseLocalDateTimeInput(String(formData.get("startAt") || ""));
  const endDate = parseLocalDateTimeInput(String(formData.get("endAt") || ""));
  const reasonId = String(formData.get("reasonId") || "");
  const reasonText = String(formData.get("reasonText") || "").trim() || null;
  const coverRequirements = String(formData.get("coverRequirements") || "").trim() || null;
  let medicalEvidenceUrl = String(formData.get("medicalEvidenceUrl") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  let medicalEvidenceData: Buffer | null = null;
  let medicalEvidenceMimeType: string | null = null;
  const evidenceFile = formData.get("medicalEvidence");
  if (evidenceFile instanceof File && evidenceFile.size > 0) {
    try {
      const read = await readMedicalEvidenceFile(evidenceFile);
      medicalEvidenceData = read.data;
      medicalEvidenceMimeType = read.mimeType;
      medicalEvidenceUrl = medicalEvidencePublicPath(generateEvidenceFileToken());
    } catch {
      redirectRequestError("INVALID_REQUEST");
    }
  }

  if (!reasonId || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    redirectRequestError("INVALID_REQUEST");
  }

  const reason = await prisma.loaReason.findFirst({
    where: { id: reasonId, tenantId: user.tenantId, active: true },
  });
  if (!reason) redirectRequestError("INVALID_REASON");

  const existingRequests = await prisma.lOARequest.findMany({
    where: {
      tenantId: user.tenantId,
      requesterId: user.id,
      status: { in: ["PENDING", ...approvedStatusFilter()] },
    },
    select: { id: true, startDate: true, endDate: true, status: true },
  });

  const policyError = validateLeavePolicy({
    startDate,
    endDate,
    medicalEvidenceUrl,
    reasonRequiresMedicalEvidence: reason.requiresMedicalEvidence,
    existingRequests,
  });
  if (policyError) redirectRequestError(policyError);

  const created = await prisma.lOARequest.create({
    data: {
      tenantId: user.tenantId,
      requesterId: user.id,
      startDate,
      endDate,
      reasonId,
      reasonText,
      coverRequirements,
      medicalEvidenceUrl,
      medicalEvidenceData,
      medicalEvidenceMimeType,
      notes,
      status: "PENDING",
    },
    include: { requester: { select: { fullName: true } }, reason: { select: { label: true } } },
  });

  const approvers = await loaApproversForRequest(user.tenantId, user.id);
  if (approvers.length > 0) {
    await notifyLeaveReviewers({
      tenantId: user.tenantId,
      approverUserIds: approvers.map((a) => a.id),
      requesterName: created.requester.fullName,
      leaveRequestId: created.id,
    });
    await sendLeaveSubmittedEmail({
      to: approvers.map((a) => a.email),
      approverUserIds: approvers.map((a) => a.id),
      requesterName: created.requester.fullName,
      reasonLabel: created.reason?.label ?? "Leave",
      startDate,
      endDate,
      leaveRequestId: created.id,
      tenantId: user.tenantId,
    });
  }

  revalidatePath("/leave");
  revalidatePath("/leave/calendar");
  redirect("/leave?created=1");
}

export async function decideLoaRequest(formData: FormData) {
  await assertSafeServerAction(formData);
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const requestId = String(formData.get("requestId") || "");
  const decisionType = String(formData.get("decisionType") || "");
  const decisionNotes = String(formData.get("decisionNotes") || "").trim() || null;

  const request = await prisma.lOARequest.findFirst({
    where: { id: requestId, tenantId: user.tenantId },
    include: { requester: { select: { email: true, fullName: true } } },
  });
  if (!request) throw new Error("NOT_FOUND");
  if (request.requesterId === user.id) throw new Error("CANNOT_APPROVE_OWN_LOA");
  const canManage = await canManageLoa(user, request.requesterId);
  if (!canManage) throw new Error("FORBIDDEN");
  if (!isPendingStatus(request.status)) throw new Error("ALREADY_DECIDED");
  if (!isLoaDecisionType(decisionType)) throw new Error("INVALID_DECISION");

  await prisma.lOARequest.update({
    where: { id: requestId },
    data: {
      status: decisionType,
      decisionNotes,
      decidedById: user.id,
      decidedAt: new Date(),
    },
  });

  await sendLeaveDecisionEmail({
    to: request.requester.email,
    requesterName: request.requester.fullName,
    status: decisionType,
    leaveRequestId: requestId,
    tenantId: user.tenantId,
    requesterUserId: request.requesterId,
  });
  revalidatePath(`/leave/${requestId}`);
  revalidatePath("/leave");
  revalidatePath("/leave/calendar");
  redirect(`/leave/${requestId}`);
}

const HR_SYSTEM_FLAG_FIELDS = ["inArbor", "inITrent"] as const;
type HrSystemFlagField = (typeof HR_SYSTEM_FLAG_FIELDS)[number];

/**
 * HR bookkeeping only: records that a leave request has been keyed into an
 * external system (Arbor / iTrent). Purely a saved checkbox -- no
 * integration with either system.
 */
export async function updateLoaHrSystemFlag(formData: FormData) {
  await assertSafeServerAction(formData);
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  if (user.role !== "HR" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    throw new Error("FORBIDDEN");
  }

  const requestId = String(formData.get("requestId") || "");
  const field = String(formData.get("field") || "") as HrSystemFlagField;
  const value = String(formData.get("value")) === "true";
  if (!requestId || !HR_SYSTEM_FLAG_FIELDS.includes(field)) throw new Error("INVALID_REQUEST");

  await prisma.lOARequest.updateMany({
    where: { id: requestId, tenantId: user.tenantId },
    data: { [field]: value },
  });

  revalidatePath("/leave/history");
}

export async function cancelLoaRequest(formData: FormData) {
  await assertSafeServerAction(formData);
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  const requestId = String(formData.get("requestId") || "");

  const request = await prisma.lOARequest.findFirst({
    where: { id: requestId, tenantId: user.tenantId, requesterId: user.id },
  });
  if (!request) throw new Error("NOT_FOUND");
  if (!isPendingStatus(request.status)) throw new Error("CANNOT_CANCEL");

  await prisma.lOARequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED", decidedAt: new Date(), decidedById: user.id },
  });

  revalidatePath(`/leave/${requestId}`);
  revalidatePath("/leave");
  revalidatePath("/leave/calendar");
  redirect("/leave");
}

export async function deleteLoaRequest(formData: FormData) {
  await assertSafeServerAction(formData);
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "LEAVE");
  if (!hasPermission(user.role, "leave:delete")) throw new Error("FORBIDDEN");

  const requestId = String(formData.get("requestId") || "");
  const request = await prisma.lOARequest.findFirst({
    where: { id: requestId, tenantId: user.tenantId },
  });
  if (!request) throw new Error("NOT_FOUND");

  await prisma.lOARequest.delete({ where: { id: requestId } });

  revalidatePath("/leave");
  revalidatePath("/leave/calendar");
  revalidatePath("/leave/history");
  redirect("/leave");
}
