import { revalidateAdmin } from "@/lib/admin-sections";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { AdminSettingsForms } from "@/components/admin/admin-settings-forms";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";

export async function SettingsAdminPanel() {
  const user = await requireAdminUser();

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });

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
    revalidateAdmin("settings");
  }

  return (
    <div className="space-y-8 pb-8">
      <AdminPageChrome
        area="School settings"
        title="School settings"
        subtitle="Configure school metadata, timezone, and insight thresholds."
      />
      <AdminSettingsForms
        tab="school"
        settings={settings}
        features={[]}
        saveSettings={saveSettings}
        toggleFeature={async () => {}}
      />
    </div>
  );
}

