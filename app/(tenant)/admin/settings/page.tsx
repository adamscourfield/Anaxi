import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";

const TABS = ["school", "modules"] as const;
type Tab = (typeof TABS)[number];

const FEATURE_FRIENDLY_NAMES: Record<string, string> = {
  OBSERVATIONS: "Observations",
  SIGNALS: "Signals & Analysis",
  STUDENTS: "Students",
  STUDENTS_IMPORT: "Student Import",
  BEHAVIOUR_IMPORT: "Behaviour Import",
  LEAVE: "Leave of Absence",
  LEAVE_OF_ABSENCE: "Leave (Legacy)",
  ON_CALL: "On Call",
  MEETINGS: "Meetings",
  TIMETABLE: "Timetable",
  ADMIN: "Administration",
  ADMIN_SETTINGS: "Admin Settings",
  ANALYSIS: "Analytics & Insights",
  STUDENT_ANALYSIS: "Student Analysis",
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  OBSERVATIONS: "Observation workflows, review history, and signal capture.",
  SIGNALS: "Signal definitions and signal-based analysis capabilities.",
  STUDENTS: "Student directory, student views, and related workflows.",
  STUDENTS_IMPORT: "Student import tooling and mapping workflows.",
  BEHAVIOUR_IMPORT: "Behaviour snapshot and attendance import workflows.",
  LEAVE: "Leave request and approval workflows.",
  LEAVE_OF_ABSENCE: "Legacy alias for leave module availability.",
  ON_CALL: "On-call request, inbox, and response workflows.",
  MEETINGS: "Meeting agendas, attendees, and actions.",
  TIMETABLE: "Timetable upload and class context enrichment.",
  ADMIN: "Admin configuration pages and management tools.",
  ADMIN_SETTINGS: "Tenant-level settings and configuration pages.",
  ANALYSIS: "Teacher and school analysis dashboards.",
  STUDENT_ANALYSIS: "Student risk and student-level analysis pages.",
};

export default async function AdminSettingsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const user = await requireAdminUser();
  const tab = (TABS.includes((searchParams?.tab as Tab) || "school") ? (searchParams?.tab as Tab) : "school") as Tab;

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
      <Link href="/admin" className="text-xs text-accent hover:underline">← Back to Admin</Link>
      <PageHeader title="Platform" subtitle="Configure school metadata, thresholds, and module availability." />

      <div className="segmented-toggle">
        {tabLink("school", "School settings")}
        {tabLink("modules", "Modules")}
      </div>

      {tab === "school" ? (
        <Card>
          <SectionHeader title="School details" subtitle="Set the school name, timezone, and default insight window." />
          <form action={saveSettings} className="mt-3 space-y-4">
            <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.04em] text-muted">School name</label>
                <input name="schoolName" defaultValue={settings?.schoolName ?? ""} placeholder="My School" className="field" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.04em] text-muted">Timezone</label>
                <select name="timezone" defaultValue={settings?.timezone ?? "Europe/London"} className="field">
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Dublin">Europe/Dublin</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.04em] text-muted">Default insight window</label>
                <select name="defaultInsightWindowDays" defaultValue={String(settings?.defaultInsightWindowDays ?? 21)} className="field">
                  <option value="7">7 days</option>
                  <option value="21">21 days</option>
                  <option value="28">28 days</option>
                </select>
              </div>
            </div>

            <details className="rounded-lg border border-border/80 bg-bg/20 p-3">
              <summary className="cursor-pointer text-sm font-medium">Advanced thresholds</summary>
              <div className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.04em] text-muted">Drift delta</label>
                  <input type="number" step="0.01" name="driftDeltaThreshold" defaultValue={settings?.driftDeltaThreshold ?? 0.15} className="field" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.04em] text-muted">Min observations</label>
                  <input type="number" name="minObservationCount" defaultValue={settings?.minObservationCount ?? 3} className="field" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.04em] text-muted">Behaviour spike %</label>
                  <input type="number" step="1" name="behaviourSpikePercent" defaultValue={settings?.behaviourSpikePercent ?? 50} className="field" />
                </div>
              </div>
            </details>

            <Button type="submit">Save settings</Button>
          </form>
        </Card>
      ) : null}

      {tab === "modules" ? (
        <div className="space-y-4">
          <SectionHeader title="Modules" subtitle="Control which features are available across your school." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature: any) => {
              const friendlyName = FEATURE_FRIENDLY_NAMES[feature.key] ?? feature.key;
              return (
                <form key={feature.key} action={toggleFeature}>
                  <input type="hidden" name="key" value={feature.key} />
                  <input type="hidden" name="enabled" value={String(feature.enabled)} />
                  <button
                    type="submit"
                    className={`group w-full rounded-xl border p-4 text-left calm-transition ${
                      feature.enabled
                        ? "border-accent/30 bg-accent/[0.04] hover:border-accent/50"
                        : "border-border bg-surface hover:border-border hover:bg-bg/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${feature.enabled ? "text-text" : "text-muted"}`}>
                          {friendlyName}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          {FEATURE_DESCRIPTIONS[feature.key] ?? "Controls access to this module."}
                        </p>
                      </div>
                      <div
                        className={`relative mt-0.5 inline-block h-[22px] w-[40px] shrink-0 rounded-full transition-colors duration-200 ${
                          feature.enabled ? "bg-accent" : "bg-surface-container-high"
                        }`}
                      >
                        <span
                          className={`absolute top-[3px] h-4 w-4 rounded-full bg-surface-container-lowest shadow transition-transform duration-200 ${
                            feature.enabled ? "translate-x-[20px]" : "translate-x-[3px]"
                          }`}
                        />
                      </div>
                    </div>
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
