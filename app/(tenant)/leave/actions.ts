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
import { approvedStatusFilter, isLoaDecisionType } from "@/lib/leaveStatus";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

function redirectRequestError(
  code: LeavePolicyViolation | "INVALID_REQUEST" | "INVALID_REASON" | "INVALID_EVIDENCE",
  formData?: FormData,
): never {
  // Send the dates and type back so the form isn't wiped. Longer text can't travel in the address.
  const params = new URLSearchParams({ error: code });
  for (const key of ["startAt", "endAt", "reasonId"]) {
    const value = String(formData?.get(key) || "").slice(0, 40);
    if (value) params.set(key, value);
  }
  redirect(`/leave/request?${params.toString()}`);
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
  // Evidence only ever comes from an upload; a link typed into the form is not trusted.
  let medicalEvidenceUrl: string | null = null;
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
      redirectRequestError("INVALID_EVIDENCE", formData);
    }
  }

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) redirectRequestError("INVALID_REQUEST", formData);
  if (!reasonId) redirectRequestError("INVALID_REASON", formData);
  if ((reasonText?.length ?? 0) > 2000 || (coverRequirements?.length ?? 0) > 2000 || (notes?.length ?? 0) > 2000) {
    redirectRequestError("INVALID_REQUEST", formData);
  }

  const reason = await prisma.loaReason.findFirst({
    where: { id: reasonId, tenantId: user.tenantId, active: true },
  });
  if (!reason) redirectRequestError("INVALID_REASON", formData);

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
  if (policyError) redirectRequestError(policyError, formData);

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

  // Tell reviewers after the response, so the requester isn't kept waiting on email.
  after(async () => {
    try {
      const approvers = await loaApproversForRequest(user.tenantId, user.id);
      if (approvers.length === 0) return;
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
    } catch (err) {
      console.error("[leave] reviewer notification failed", err);
    }
  });

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

  function back(error: string): never {
    redirect(`/leave/${encodeURIComponent(requestId)}?error=${error}`);
  }

  const request = await prisma.lOARequest.findFirst({
    where: { id: requestId, tenantId: user.tenantId },
    include: { requester: { select: { email: true, fullName: true } } },
  });
  if (!request) redirect("/leave");
  if (request.requesterId === user.id) back("OWN_REQUEST");
  const canManage = await canManageLoa(user, request.requesterId);
  if (!canManage) redirect("/leave");
  if (!isLoaDecisionType(decisionType)) back("CHOOSE_DECISION");
  const decision = decisionType;
  if (decisionNotes && decisionNotes.length > 2000) back("NOTES_TOO_LONG");

  // Only a pending request can be decided; two reviewers at once can't both win.
  const updated = await prisma.lOARequest.updateMany({
    where: { id: requestId, tenantId: user.tenantId, status: "PENDING" },
    data: {
      status: decision,
      decisionNotes,
      decidedById: user.id,
      decidedAt: new Date(),
    },
  });
  if (updated.count === 0) back("ALREADY_DECIDED");

  after(() =>
    sendLeaveDecisionEmail({
      to: request.requester.email,
      requesterName: request.requester.fullName,
      status: decision,
      leaveRequestId: requestId,
      tenantId: user.tenantId,
      requesterUserId: request.requesterId,
    }).catch((err: unknown) => console.error("[leave] decision email failed", err)),
  );
  revalidatePath(`/leave/${requestId}`);
  revalidatePath("/leave");
  revalidatePath("/leave/calendar");
  redirect(`/leave/${requestId}?decided=1`);
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

  const updated = await prisma.lOARequest.updateMany({
    where: { id: requestId, tenantId: user.tenantId, requesterId: user.id, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: new Date(), decidedById: user.id },
  });
  if (updated.count === 0) redirect(`/leave/${encodeURIComponent(requestId)}?error=ALREADY_DECIDED`);

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
