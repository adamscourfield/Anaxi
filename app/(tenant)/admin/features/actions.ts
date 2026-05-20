"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { assertSafeServerAction } from "@/lib/serverActionGuard";

export async function toggleTenantFeature(formData: FormData) {
  await assertSafeServerAction(formData);

  const admin = await requireAdminUser();
  const key = String(formData.get("key") || "").trim();
  const enabled = String(formData.get("enabled")) === "true";
  if (!key) return;

  await prisma.tenantFeature.upsert({
    where: { tenantId_key: { tenantId: admin.tenantId, key } },
    create: { tenantId: admin.tenantId, key, enabled: !enabled },
    update: { enabled: !enabled },
  });

  revalidatePath("/admin/features");
  revalidatePath("/admin");
  revalidatePath("/admin/settings");
}
