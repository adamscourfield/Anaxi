"use server";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUserOrThrow } from "@/lib/auth";
import { sendObservationEmail } from "@/lib/email";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getTenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalsForPhase } from "@/modules/observations/getSignalsBySchoolType";
import { LESSON_PHASE } from "@/modules/observations/signalTypes";

export type SubmitObservationState = { error: string | null };

const VALID_PHASES = new Set<string>(Object.values(LESSON_PHASE));
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Store a date-only value at midday UTC so it reads as the same calendar day
 * in UK time whatever the season, and never drifts a day either side.
 */
function parseObservedDate(raw: string): Date | null {
  if (!DATE_ONLY.test(raw)) return null;
  const date = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Allow one day of slack for time-zone edges, but no future observations.
  if (date.getTime() > Date.now() + 36 * 60 * 60 * 1000) return null;
  return date;
}

/**
 * Save an observation from the new-observation flow. Returns a message for
 * the review screen when something is wrong; redirects to the saved
 * observation on success.
 */
export async function submitObservationDraft(
  _prev: SubmitObservationState,
  formData: FormData,
): Promise<SubmitObservationState> {
  await assertSafeServerAction(formData);
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  if (!hasPermission(user.role, "observe:create")) {
    return { error: "You don't have permission to record observations." };
  }

  const observedTeacherId = String(formData.get("observedTeacherId") || "").trim();
  const yearGroup = String(formData.get("yearGroup") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const classCode = String(formData.get("classCode") || "").trim() || null;
  const phase = String(formData.get("phase") || "").trim();
  const contextNote = String(formData.get("contextNote") || "").trim() || null;
  const observedAt = parseObservedDate(String(formData.get("observedAt") || "").trim());

  if (!observedTeacherId) return { error: "Choose who you observed." };
  if (observedTeacherId === user.id) return { error: "You can't record an observation of yourself." };
  if (!subject) return { error: "Choose a department." };
  if (!yearGroup) return { error: "Choose a year group." };
  if (!VALID_PHASES.has(phase)) return { error: "Choose the part of the lesson you saw." };
  if (!observedAt) return { error: "Enter the date of the observation. It can't be in the future." };
  if (contextNote && contextNote.length > 5000) return { error: "Keep notes under 5,000 characters." };

  const teacher = await (prisma as any).user.findFirst({
    where: { id: observedTeacherId, tenantId: user.tenantId, isActive: true },
    select: { id: true, email: true, fullName: true },
  });
  if (!teacher) return { error: "That member of staff is no longer active. Choose someone else." };

  const schoolType = await getTenantSchoolType(user.tenantId);
  const phaseSignals = getSignalsForPhase(phase, schoolType);
  const signalData: { signalKey: string; valueKey: string | null; notObserved: boolean }[] = [];
  for (const signal of phaseSignals) {
    const allowed = new Set<string>(signal.scale.map((s) => s.key));
    const notObserved = String(formData.get(`signal_${signal.key}_not`) || "") === "1";
    const valueKey = String(formData.get(`signal_${signal.key}_value`) || "").trim() || null;
    if (!notObserved && (!valueKey || !allowed.has(valueKey))) {
      return { error: `Rate or skip “${signal.displayNameDefault}” before saving.` };
    }
    signalData.push({ signalKey: signal.key, valueKey: notObserved ? null : valueKey, notObserved });
  }

  const observation = await (prisma as any).observation.create({
    data: {
      tenantId: user.tenantId,
      observedTeacherId,
      observerId: user.id,
      observedAt,
      yearGroup,
      subject,
      classCode,
      phase,
      contextNote,
      signals: { createMany: { data: signalData } },
    },
    select: { id: true },
  });

  after(() =>
    sendObservationEmail({
      to: teacher.email,
      teacherName: teacher.fullName,
      observerName: user.fullName,
      observationId: observation.id,
      tenantId: user.tenantId,
      teacherUserId: teacher.id,
    }).catch((err: unknown) => console.error("[observe] email failed", err)),
  );
  revalidatePath("/observe/history");
  redirect(`/observe/${observation.id}?saved=1`);
}
