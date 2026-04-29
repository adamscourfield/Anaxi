import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { PageHeader } from "@/components/ui/page-header";
import { AdminSettingsForms } from "@/components/admin/admin-settings-forms";

const TABS = ["school", "modules"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminSettingsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const user = await requireAdminUser();
  const tab = (TABS.includes(searchParams?.tab as Tab) ? (searchParams?.tab as Tab) : "school") as Tab;

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
  const features = await prisma.tenantFeature.findMany({ where: { tenantId: user.tenantId }, orderBy: { key: "asc" } });

  async function saveSettings(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const schoolName = String(formData.get("schoolName") || "").trim();
    const timezone = String(formData.get("timezone") || "Europe/London");
    const defaultInsightWindowDays = parseInt(String(formData.get("defaultInsightWindowDays") || "21"));
    const driftDeltaThreshold = parseFloat(String(formData.get("driftDeltaThreshold") || "0.15"));
    const minObservationCount = parseInt(String(formData.get("minObservationCount") || "3"));
    const behaviourSpikePercent = parseFloat(String(formData.get("behaviourSpikePercent") || "50"));
    await (prisma as any).tenantSettings.upsert({
      where: { tenantId: admin.tenantId },
      update: { schoolName, timezone, defaultInsightWindowDays, driftDeltaThreshold, minObservationCount, behaviourSpikePercent },
      create: { tenantId: admin.tenantId, schoolName, timezone, defaultInsightWindowDays, driftDeltaThreshold, minObservationCount, behaviourSpikePercent },
    });
    if (schoolName) {
      await prisma.tenant.update({ where: { id: admin.tenantId }, data: { name: schoolName } });
    }
    revalidatePath("/admin/settings");
  }

  async function toggleFeature(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const key = String(formData.get("key")) as any;
    const enabled = String(formData.get("enabled")) === "true";
    await prisma.tenantFeature.upsert({
      where: { tenantId_key: { tenantId: admin.tenantId, key } },
      create: { tenantId: admin.tenantId, key, enabled: !enabled },
      update: { enabled: !enabled },
    });
    revalidatePath("/admin/settings");
    revalidatePath("/admin/features");
  }

  const tabLink = (value: Tab, label: string) => (
    <Link
      key={value}
      href={`/admin/settings?tab=${value}`}
      role="tab"
      aria-selected={tab === value}
      className={`segmented-toggle-btn ${tab === value ? "segmented-toggle-btn-active" : ""}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-surface-container-lowest px-3.5 py-1.5 text-xs font-medium text-muted shadow-sm calm-transition hover:border-outline-variant hover:bg-surface-container-low hover:text-text"
        >
          <span aria-hidden>←</span>
          Back to Admin
        </Link>
      </div>
      <PageHeader
        title="Platform"
        titleClassName="text-pretty text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.035em] text-text"
        subtitle="Configure school metadata, thresholds, and module availability."
        subtitleClassName="max-w-full text-pretty text-sm font-medium leading-relaxed text-muted/90 md:max-w-2xl"
        className="border-b border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] pb-8"
      />

      <div className="segmented-toggle max-w-md" role="tablist" aria-label="Platform sections">
        {tabLink("school", "School settings")}
        {tabLink("modules", "Modules")}
      </div>

      <AdminSettingsForms
        tab={tab}
        settings={settings}
        features={features as { key: string; enabled: boolean }[]}
        saveSettings={saveSettings}
        toggleFeature={toggleFeature}
      />
    </div>
  );
}
