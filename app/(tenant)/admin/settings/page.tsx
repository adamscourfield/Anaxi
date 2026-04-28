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
      className={`segmented-toggle-btn ${tab === value ? "segmented-toggle-btn-active" : ""}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <Link href="/admin" className="link-accent text-xs">← Back to Admin</Link>
      <PageHeader title="Platform" subtitle="Configure school metadata, thresholds, and module availability." />

      <div className="segmented-toggle">
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
