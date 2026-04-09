"use server";

import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { createMeeting, updateMeeting } from "@/modules/meetings/service";
import { createAction, completeAction } from "@/modules/actions/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createMeetingAction(formData: FormData) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");
  if (!hasPermission(user.role, "meetings:create")) throw new Error("FORBIDDEN");

  const title = String(formData.get("title") || "").trim();
  const type = String(formData.get("type") || "OTHER") as any;
  const startDateTime = new Date(String(formData.get("startDateTime") || ""));
  const endDateTimeRaw = String(formData.get("endDateTime") || "").trim();
  const endDateTime = endDateTimeRaw ? new Date(endDateTimeRaw) : new Date(startDateTime.getTime() + 3600000);
  const attendeeIds = formData.getAll("attendeeIds").map((v) => String(v));
  const location = String(formData.get("location") || "").trim() || undefined;
  const notes = String(formData.get("notes") || "").trim() || undefined;

  if (!title || Number.isNaN(startDateTime.getTime())) throw new Error("INVALID_MEETING");

  const meeting = await createMeeting(user.tenantId, user.id, {
    title, type, startDateTime, endDateTime, location, notes, attendeeIds,
  });

  revalidatePath("/meetings");
  const fiveMin = 5 * 60 * 1000;
  const scheduledStart = new Date(meeting.startDateTime).getTime();
  if (scheduledStart - Date.now() > fiveMin) {
    redirect("/meetings");
  }
  redirect(`/meetings/${meeting.id}`);
}

export async function updateMeetingNotesAction(formData: FormData) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");

  const meetingId = String(formData.get("meetingId") || "");
  const notes = String(formData.get("notes") || "").trim() || undefined;

  await updateMeeting(user.tenantId, meetingId, user.id, { notes });
  revalidatePath(`/meetings/${meetingId}`);
}

export async function addMeetingActionAction(formData: FormData) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");

  const meetingId = String(formData.get("meetingId") || "");
  const description = String(formData.get("description") || "").trim();
  const ownerUserId = String(formData.get("ownerUserId") || "");
  const dueDateRaw = String(formData.get("dueDate") || "").trim();
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : undefined;

  if (!meetingId || !description || !ownerUserId) throw new Error("INVALID_ACTION");

  await createAction(user.tenantId, meetingId, user.id, { description, ownerUserId, dueDate });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings/actions");
  revalidatePath("/my-actions");
}

export async function markActionDoneAction(formData: FormData) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "MEETINGS");

  const actionId = String(formData.get("actionId") || "");
  await completeAction(user.tenantId, actionId, user.id);

  revalidatePath("/meetings/actions");
  revalidatePath("/my-actions");
}

