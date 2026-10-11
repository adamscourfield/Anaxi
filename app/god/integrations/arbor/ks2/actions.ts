"use server";
import { requireSuperAdminUser } from "@/lib/admin";
import { assertSafeServerAction } from "@/lib/serverActionGuard";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { loadArborKs2Results } from "@/lib/integrations/arbor/ks2Source";
import { applyKs2Backfill } from "@/lib/integrations/arbor/ks2BackfillService";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function importArborKs2(formData: FormData) {
  await assertSafeServerAction(formData);
  const actor = await requireSuperAdminUser();
  const connectionId = String(formData.get("connectionId") ?? "");
  const integration = await prisma.sharedIntegration.findFirst({ where: { id: connectionId, provider: "ARBOR", status: "CONNECTED" } });
  if (!integration?.credentialsCiphertext) throw new Error("Arbor is not connected");
  const source = await loadArborKs2Results(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
  const result = await applyKs2Backfill(integration.id, actor.id, source.results);
  revalidatePath("/students", "layout");
  revalidatePath("/assessments", "layout");
  redirect(`/god/integrations/arbor/ks2?connectionId=${encodeURIComponent(connectionId)}&updated=${result.updated}&scores=${result.scoresUpdated}`);
}
