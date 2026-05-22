"use server";

import { revalidateAdmin } from "@/lib/admin-revalidate";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

export async function addTaxonomyItem(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const type = String(formData.get("type"));
  const value = String(formData.get("value") || "").trim();
  if (!value) return;

  if (type === "loa") {
    const agg = await prisma.loaReason.aggregate({
      where: { tenantId: admin.tenantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;
    await prisma.loaReason.create({ data: { tenantId: admin.tenantId, label: value, sortOrder } });
  }
  if (type === "reason") {
    const agg = await (prisma as any).onCallReason.aggregate({
      where: { tenantId: admin.tenantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;
    await (prisma as any).onCallReason.create({ data: { tenantId: admin.tenantId, label: value, sortOrder } });
  }
  if (type === "location") {
    const agg = await (prisma as any).onCallLocation.aggregate({
      where: { tenantId: admin.tenantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;
    await (prisma as any).onCallLocation.create({ data: { tenantId: admin.tenantId, label: value, sortOrder } });
  }
  if (type === "recipient") {
    const agg = await (prisma as any).onCallRecipient.aggregate({
      where: { tenantId: admin.tenantId },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;
    await (prisma as any).onCallRecipient.create({ data: { tenantId: admin.tenantId, email: value, sortOrder } });
  }
  if (type === "loa_authoriser") {
    await (prisma as any).lOAAuthoriser.upsert({
      where: { tenantId_userId: { tenantId: admin.tenantId, userId: value } },
      update: {},
      create: { tenantId: admin.tenantId, userId: value },
    });
  }
  revalidateAdmin("taxonomies");
}

export async function updateTaxonomyItem(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const type = String(formData.get("type"));
  const id = String(formData.get("id"));
  const label = String(formData.get("label") || "").trim();
  if (!id) return;
  if (type === "loa") await prisma.loaReason.updateMany({ where: { id, tenantId: admin.tenantId }, data: { label } });
  if (type === "reason") await (prisma as any).onCallReason.updateMany({ where: { id, tenantId: admin.tenantId }, data: { label } });
  if (type === "location") await (prisma as any).onCallLocation.updateMany({ where: { id, tenantId: admin.tenantId }, data: { label } });
  if (type === "recipient") await (prisma as any).onCallRecipient.updateMany({ where: { id, tenantId: admin.tenantId }, data: { email: label } });
  revalidateAdmin("taxonomies");
}

export async function toggleTaxonomyActive(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const type = String(formData.get("type"));
  const id = String(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  if (!id) return;
  if (type === "loa") await prisma.loaReason.updateMany({ where: { id, tenantId: admin.tenantId }, data: { active: !active } });
  if (type === "reason") await (prisma as any).onCallReason.updateMany({ where: { id, tenantId: admin.tenantId }, data: { active: !active } });
  if (type === "location") await (prisma as any).onCallLocation.updateMany({ where: { id, tenantId: admin.tenantId }, data: { active: !active } });
  if (type === "recipient") await (prisma as any).onCallRecipient.updateMany({ where: { id, tenantId: admin.tenantId }, data: { active: !active } });
  revalidateAdmin("taxonomies");
}

export async function deleteTaxonomyItem(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const type = String(formData.get("type"));
  const id = String(formData.get("id"));
  if (!id) return;
  if (type === "loa") await prisma.loaReason.deleteMany({ where: { id, tenantId: admin.tenantId } });
  if (type === "reason") await (prisma as any).onCallReason.deleteMany({ where: { id, tenantId: admin.tenantId } });
  if (type === "location") await (prisma as any).onCallLocation.deleteMany({ where: { id, tenantId: admin.tenantId } });
  if (type === "recipient") await (prisma as any).onCallRecipient.deleteMany({ where: { id, tenantId: admin.tenantId } });
  revalidateAdmin("taxonomies");
}

export async function reorderTaxonomy(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const type = String(formData.get("type"));
  const raw = String(formData.get("orderedIds") || "");
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return;

  if (type === "loa") {
    await prisma.$transaction(
      ids.map((rowId, idx) =>
        prisma.loaReason.updateMany({ where: { id: rowId, tenantId: admin.tenantId }, data: { sortOrder: idx } })
      )
    );
  }
  if (type === "reason") {
    await prisma.$transaction(
      ids.map((rowId, idx) =>
        (prisma as any).onCallReason.updateMany({ where: { id: rowId, tenantId: admin.tenantId }, data: { sortOrder: idx } })
      )
    );
  }
  if (type === "location") {
    await prisma.$transaction(
      ids.map((rowId, idx) =>
        (prisma as any).onCallLocation.updateMany({ where: { id: rowId, tenantId: admin.tenantId }, data: { sortOrder: idx } })
      )
    );
  }
  if (type === "recipient") {
    await prisma.$transaction(
      ids.map((rowId, idx) =>
        (prisma as any).onCallRecipient.updateMany({ where: { id: rowId, tenantId: admin.tenantId }, data: { sortOrder: idx } })
      )
    );
  }
  revalidateAdmin("taxonomies");
}

export async function removeLoaAuthoriser(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const id = String(formData.get("id"));
  await (prisma as any).lOAAuthoriser.deleteMany({ where: { id, tenantId: admin.tenantId } });
  revalidateAdmin("taxonomies");
}

export async function addScopedAuthoriser(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const approverId = String(formData.get("approverId") || "").trim();
  const targetUserId = String(formData.get("targetUserId") || "").trim();
  if (!approverId || !targetUserId || approverId === targetUserId) return;
  await (prisma as any).lOAApprovalScope.upsert({
    where: { tenantId_approverId_targetUserId: { tenantId: admin.tenantId, approverId, targetUserId } },
    update: {},
    create: { tenantId: admin.tenantId, approverId, targetUserId },
  });
  revalidateAdmin("taxonomies");
}

export async function removeScopedTarget(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const id = String(formData.get("id"));
  await (prisma as any).lOAApprovalScope.deleteMany({ where: { id, tenantId: admin.tenantId } });
  revalidateAdmin("taxonomies");
}

export async function removeScopedAuthoriser(formData: FormData) {
  await assertSafeServerAction(formData);
  const admin = await requireAdminUser();
  const approverId = String(formData.get("approverId"));
  await (prisma as any).lOAApprovalScope.deleteMany({ where: { tenantId: admin.tenantId, approverId } });
  revalidateAdmin("taxonomies");
}
