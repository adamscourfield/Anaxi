import type { ReactNode } from "react";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
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

  const tabLink = (value: Tab, label: string, icon: ReactNode) => {
    const active = tab === value;
    return (
      <Link
        key={value}
        href={`/admin/settings?tab=${value}`}
        role="tab"
        aria-selected={active}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[0.8125rem] font-semibold calm-transition sm:px-5 sm:py-3 ${
          active
            ? "border border-border/45 bg-surface-container-lowest text-text shadow-sm"
            : "border border-transparent bg-[color-mix(in_srgb,var(--surface-container-low)_85%,transparent)] text-text hover:bg-[color-mix(in_srgb,var(--surface-container-low)_65%,transparent)]"
        }`}
      >
        <span className="shrink-0 text-muted [&_svg]:block" aria-hidden>
          {icon}
        </span>
        {label}
      </Link>
    );
  };

  const schoolTabIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 21h16M6 21V10l6-4 6 4v11M10 21v-6h4v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const modulesTabIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.998.998 0 01-1.023.242 3 3 0 01-2.54-.298 3 3 0 01-2.54.298 1 1 0 01-1.023-.242L9.44 11.06a1 1 0 01-.242 1.023 3 3 0 01-.298 2.54 3 3 0 01.298 2.54 1 1 0 01.242 1.023l-1.611 1.611c-.47.47-1.087.706-1.704.706s-1.233-.235-1.704-.706l-1.568-1.568a1.019 1.019 0 01-.289-.878 3 3 0 01.298-2.54 3 3 0 01-.298-2.54 1 1 0 01.289-.878l1.568-1.568c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.611 1.611a1 1 0 011.023.242 3 3 0 012.54-.298 3 3 0 012.54.298 1 1 0 011.023-.242l1.611-1.611c.47-.47 1.087-.706 1.704-.706s1.233.235 1.704.706l1.568 1.568c.23.23.338.556.289.878a3 3 0 01-.298 2.54 3 3 0 01.298 2.54z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="space-y-8 bg-[color-mix(in_srgb,var(--surface-container-low)_55%,transparent)] pb-8">
      <div className="space-y-6 border-b border-border/25 pb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-surface-container-lowest px-3.5 py-2 text-[0.8125rem] font-semibold text-text shadow-sm calm-transition hover:bg-surface-container-low"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden>
            <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Admin
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-[1.75rem]">Platform</h1>
          <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">
            Configure school metadata, thresholds, and module availability.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Platform sections">
        {tabLink("school", "School settings", schoolTabIcon)}
        {tabLink("modules", "Modules", modulesTabIcon)}
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
