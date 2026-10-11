import styles from "../signals/page.module.css";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { adminSectionPath } from "@/lib/admin-sections";
import { revalidateAdmin } from "@/lib/admin-revalidate";
import { requireAdminUser } from "@/lib/admin";
import { assertSafeServerAction } from "@/lib/serverActionGuard";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { getAllSignalDefinitionsForTenantLabels } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels, upsertTenantSignalLabel } from "@/modules/observations/tenantSignalLabels";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";
import { ObservationSignalLabelsSection } from "@/app/(tenant)/admin/observation-signal-labels/ObservationSignalLabelsSection";

export async function SignalsAdminPanel() {
  const user = await requireAdminUser();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  const [labels, settings] = await Promise.all([
    getTenantSignalLabels(user.tenantId),
    (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } }),
  ]);
  const signalCatalog = getAllSignalDefinitionsForTenantLabels(settings?.schoolType ?? "SECONDARY");

  async function saveAll(formData: FormData) {
    "use server";
    await assertSafeServerAction(formData);
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");
    const adminSettings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: admin.tenantId } });

    for (const signal of getAllSignalDefinitionsForTenantLabels(adminSettings?.schoolType ?? "SECONDARY")) {
      const displayName = String(formData.get(`display_${signal.key}`) || signal.displayNameDefault);
      const description = String(formData.get(`description_${signal.key}`) || "");
      await upsertTenantSignalLabel(admin.tenantId, signal.key, displayName, description);
    }

    revalidateAdmin("signals", "language");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  async function resetOne(formData: FormData) {
    "use server";
    await assertSafeServerAction(formData);
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");
    const key = String(formData.get("signalKey") || "");
    const adminSettings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: admin.tenantId } });
    const signal = getAllSignalDefinitionsForTenantLabels(adminSettings?.schoolType ?? "SECONDARY").find((row) => row.key === key);
    if (!signal) return;

    await upsertTenantSignalLabel(admin.tenantId, signal.key, signal.displayNameDefault, null);
    revalidateAdmin("signals", "language");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  async function resetAll(_formData?: FormData) {
    "use server";
    await assertSafeServerAction(_formData);
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");
    const adminSettings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: admin.tenantId } });
    for (const signal of getAllSignalDefinitionsForTenantLabels(adminSettings?.schoolType ?? "SECONDARY")) {
      await upsertTenantSignalLabel(admin.tenantId, signal.key, signal.displayNameDefault, null);
    }
    revalidateAdmin("signals", "language");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  return (
    <div className={`${styles.page} space-y-8 pb-8`}>
      <AdminPageChrome
        area="Signals"
        title="Observation signals"
        subtitle="Edit signal display names and descriptions used in observation workflows."
      />
      <p className="max-w-2xl text-[0.8125rem] leading-relaxed text-muted">
        Use this for signal-level wording only. For cross-module wording, use{" "}
        <a className="font-semibold text-[#e14e36] underline decoration-[#ff6a52] underline-offset-2 hover:text-text" href={adminSectionPath("language")}>
          Language
        </a>
        .
      </p>

      <ObservationSignalLabelsSection
        signalCatalog={signalCatalog}
        labels={labels}
        saveAll={saveAll}
        resetOne={resetOne}
        resetAll={resetAll}
        showFooterSave
        footerSaveLabel="Save changes"
      />
    </div>
  );
}
