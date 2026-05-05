import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { requireFeature } from "@/lib/guards";
import { getAllSignalDefinitionsForTenantLabels } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels, upsertTenantSignalLabel } from "@/modules/observations/tenantSignalLabels";
import { PageHeader } from "@/components/ui/page-header";
import { ObservationSignalLabelsSection } from "../observation-signal-labels/ObservationSignalLabelsSection";

export default async function AdminSignalsPage() {
  const user = await requireAdminUser();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  const labels = await getTenantSignalLabels(user.tenantId);
  const signalCatalog = getAllSignalDefinitionsForTenantLabels();

  async function saveAll(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");

    for (const signal of getAllSignalDefinitionsForTenantLabels()) {
      const displayName = String(formData.get(`display_${signal.key}`) || signal.displayNameDefault);
      const description = String(formData.get(`description_${signal.key}`) || "");
      await upsertTenantSignalLabel(admin.tenantId, signal.key, displayName, description);
    }

    revalidatePath("/admin/signals");
    revalidatePath("/admin/language");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  async function resetOne(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");
    const key = String(formData.get("signalKey") || "");
    const signal = getAllSignalDefinitionsForTenantLabels().find((row) => row.key === key);
    if (!signal) return;

    await upsertTenantSignalLabel(admin.tenantId, signal.key, signal.displayNameDefault, null);
    revalidatePath("/admin/signals");
    revalidatePath("/admin/language");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  async function resetAll(_formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");
    for (const signal of getAllSignalDefinitionsForTenantLabels()) {
      await upsertTenantSignalLabel(admin.tenantId, signal.key, signal.displayNameDefault, null);
    }
    revalidatePath("/admin/signals");
    revalidatePath("/admin/language");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  return (
    <div className="space-y-6 bg-[color-mix(in_srgb,var(--surface-container-low)_55%,transparent)] pb-8">
      <Link
        href="/admin/terminology"
        className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-surface-container-lowest px-3.5 py-2 text-[0.8125rem] font-semibold text-text shadow-sm calm-transition hover:bg-surface-container-low"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Terminology
      </Link>
      <PageHeader
        variant="ledger"
        title="Observation Signals"
        subtitle="Edit signal display names and descriptions used in observation workflows."
      />
      <p className="max-w-2xl text-[0.8125rem] leading-relaxed text-muted">
        Use this for signal-level wording only. For cross-module wording, use{" "}
        <a className="font-semibold text-[#7C69EF] underline decoration-violet-200 underline-offset-2 hover:text-text dark:text-violet-400" href="/admin/language">
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
