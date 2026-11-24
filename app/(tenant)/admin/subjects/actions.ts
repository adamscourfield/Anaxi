"use server";

import { revalidateAdmin } from "@/lib/admin-revalidate";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { assertSafeServerAction } from "@/lib/serverActionGuard";
import { isSubjectStage } from "@/lib/subjectStages";

function readStages(formData: FormData): string[] {
  return formData.getAll("stages").map(String).filter(isSubjectStage);
}

export async function addSubject(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const stages = readStages(formData);

  const agg = await prisma.subject.aggregate({
    where: { tenantId: admin.tenantId },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;

  await prisma.subject.upsert({
    where: { tenantId_name: { tenantId: admin.tenantId, name } },
    update: { active: true, stages },
    create: { tenantId: admin.tenantId, name, stages, sortOrder },
  });
  revalidateAdmin("subjects");
}

export async function updateSubject(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return;
  const stages = readStages(formData);
  await prisma.subject.updateMany({
    where: { id, tenantId: admin.tenantId },
    data: { name, stages },
  });
  revalidateAdmin("subjects");
}

export async function toggleSubjectActive(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const id = String(formData.get("id") || "");
  const active = String(formData.get("active")) === "true";
  if (!id) return;
  await prisma.subject.updateMany({
    where: { id, tenantId: admin.tenantId },
    data: { active: !active },
  });
  revalidateAdmin("subjects");
}

export async function deleteSubject(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.subject.deleteMany({ where: { id, tenantId: admin.tenantId } });
  revalidateAdmin("subjects");
}

export async function reorderSubjects(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const raw = String(formData.get("orderedIds") || "");
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return;
  await prisma.$transaction(
    ids.map((rowId, idx) =>
      prisma.subject.updateMany({ where: { id: rowId, tenantId: admin.tenantId }, data: { sortOrder: idx } })
    )
  );
  revalidateAdmin("subjects");
}

/**
 * Save every row of the Subjects table at once (names, key stages, active). Replaces a Save and an
 * Activate/Deactivate button on each row. Fields are suffixed with the row id: name_<id>,
 * stages_<id>, active_<id> (a checkbox, present when ticked).
 */
export async function saveSubjects(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const ids = formData.getAll("rowId").map(String).filter(Boolean);
  if (!ids.length) return;
  const updates = ids.flatMap((id) => {
    const name = String(formData.get(`name_${id}`) || "").trim();
    if (!name) return [];
    const stages = formData.getAll(`stages_${id}`).map(String).filter(isSubjectStage);
    const active = formData.get(`active_${id}`) === "on";
    return [prisma.subject.updateMany({ where: { id, tenantId: admin.tenantId }, data: { name, stages, active } })];
  });
  await prisma.$transaction(updates);
  revalidateAdmin("subjects");
}
