import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { getAllSignalDefinitionsForTenantLabels } from "@/modules/observations/getSignalsBySchoolType";
import { upsertTenantSignalLabel } from "@/modules/observations/tenantSignalLabels";
import { redirect as nextRedirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { H2, MetaText } from "@/components/ui/typography";
import WizardClient from "./wizard-client";

const ALL_MODULES = [
  { key: "OBSERVATIONS", label: "Observations" },
  { key: "SIGNALS", label: "Signals" },
  { key: "STUDENTS", label: "Students" },
  { key: "BEHAVIOUR_IMPORT", label: "Behaviour Import" },
  { key: "ON_CALL", label: "On Call" },
  { key: "MEETINGS", label: "Meetings" },
  { key: "LEAVE", label: "Leave of Absence" },
  { key: "TIMETABLE", label: "Timetable" },
  { key: "ADMIN_SETTINGS", label: "Admin Settings" },
  { key: "ASSESSMENTS", label: "Assessments" },
] as const;

const BEHAVIOUR_FIELDS = [
  { key: "positivePointsLabel", label: "Positive points", default: "Positive Points" },
  { key: "detentionLabel", label: "Detention", default: "Detention" },
  { key: "internalExclusionLabel", label: "Internal exclusion", default: "Internal Exclusion" },
  { key: "suspensionLabel", label: "Suspension", default: "Suspension" },
  { key: "onCallLabel", label: "On call", default: "On Call" },
] as const;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: { step?: string };
}) {
  const user = await requireAdminUser();
  const step = parseInt(searchParams?.step ?? "1");

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
  const features = await prisma.tenantFeature.findMany({ where: { tenantId: user.tenantId } });
  const enabledKeys = new Set(features.filter((f: any) => f.enabled).map((f: any) => f.key));

  // ── Step 1: School settings ──────────────────────────────────────────────────
  async function saveSchoolSettings(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const schoolName = String(formData.get("schoolName") || "").trim();
    const timezone = String(formData.get("timezone") || "Europe/London");
    await (prisma as any).tenantSettings.upsert({
      where: { tenantId: admin.tenantId },
      update: { schoolName, timezone },
      create: { tenantId: admin.tenantId, schoolName, timezone }
    });
    // Also update tenant name
    if (schoolName) {
      await prisma.tenant.update({ where: { id: admin.tenantId }, data: { name: schoolName } });
    }
    nextRedirect("/onboarding?step=2");
  }

  // ── Step 2: Enable modules ───────────────────────────────────────────────────
  async function saveModules(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    for (const mod of ALL_MODULES) {
      const enabled = formData.get(mod.key) === "on";
      await prisma.tenantFeature.upsert({
        where: { tenantId_key: { tenantId: admin.tenantId, key: mod.key } },
        update: { enabled },
        create: { tenantId: admin.tenantId, key: mod.key, enabled }
      });
    }
    nextRedirect("/onboarding?step=3");
  }

  // ── Step 3: Staff import info (redirect to import page) ──────────────────────
  // ── Step 4: Behaviour labels ─────────────────────────────────────────────────
  async function saveBehaviourLabels(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const data: Record<string, string> = {};
    for (const f of BEHAVIOUR_FIELDS) {
      data[f.key] = String(formData.get(f.key) || f.default).trim() || f.default;
    }
    await (prisma as any).tenantSettings.upsert({
      where: { tenantId: admin.tenantId },
      update: data,
      create: { tenantId: admin.tenantId, ...data }
    });
    nextRedirect("/onboarding?step=5");
  }

  // ── Step 5: Signal labels ────────────────────────────────────────────────────
  async function saveSignalLabels(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    for (const signal of getAllSignalDefinitionsForTenantLabels()) {
      const displayName = String(formData.get(`display_${signal.key}`) || signal.displayNameDefault).trim();
      const description = String(formData.get(`description_${signal.key}`) || "");
      await upsertTenantSignalLabel(admin.tenantId, signal.key, displayName || signal.displayNameDefault, description);
    }
    nextRedirect("/onboarding?step=6");
  }

  // ── Step 7: Finish ───────────────────────────────────────────────────────────
  async function finishOnboarding() {
    "use server";
    const admin = await requireAdminUser();
    await (prisma as any).tenantSettings.upsert({
      where: { tenantId: admin.tenantId },
      update: { onboardingCompletedAt: new Date() },
      create: { tenantId: admin.tenantId, onboardingCompletedAt: new Date() }
    });
    nextRedirect("/tenant");
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });

  return (
    <WizardClient stepIndex={step - 1}>
      {step === 1 && (
        <Card>
          <form action={saveSchoolSettings} className="space-y-4">
            <H2>Step 1: School settings</H2>
            <div>
              <label className="mb-1.5 block text-sm font-medium">School name</label>
              <input
                name="schoolName"
                defaultValue={settings?.schoolName ?? tenant?.name ?? ""}
                placeholder="My School"
                className="field w-full max-w-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Timezone</label>
              <select name="timezone" defaultValue={settings?.timezone ?? "Europe/London"} className="field">
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Dublin">Europe/Dublin</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Australia/Sydney">Australia/Sydney</option>
              </select>
            </div>
            <Button type="submit">Next</Button>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <form action={saveModules} className="space-y-4">
            <H2>Step 2: Enable modules</H2>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.map((mod) => (
                <label key={mod.key} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-surface/60 p-3 text-sm calm-transition hover:border-accent/30 hover:bg-[var(--accent-tint)]">
                  <input
                    type="checkbox"
                    name={mod.key}
                    defaultChecked={enabledKeys.has(mod.key)}
                    className="accent-accent"
                  />
                  {mod.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <a href="/onboarding?step=1"><Button type="button" variant="secondary">Back</Button></a>
              <Button type="submit">Next</Button>
            </div>
          </form>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4">
          <H2>Step 3: Upload staff</H2>
          <MetaText>
            Use the Users admin page to bulk-import or add staff manually. Come back here when done.
          </MetaText>
          <div className="flex flex-wrap gap-2">
            <a href="/onboarding?step=2"><Button type="button" variant="secondary">Back</Button></a>
            <a href="/admin/users"><Button type="button" variant="secondary">Go to Users</Button></a>
            <a href="/onboarding?step=4"><Button type="button">Next</Button></a>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <form action={saveBehaviourLabels} className="space-y-4">
            <H2>Step 4: Behaviour labels</H2>
            <div className="grid max-w-lg gap-3">
              {BEHAVIOUR_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="w-52 text-sm text-muted">{field.label}</label>
                  <input
                    name={field.key}
                    defaultValue={settings?.[field.key] ?? field.default}
                    placeholder={field.default}
                    className="field flex-1"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <a href="/onboarding?step=3"><Button type="button" variant="secondary">Back</Button></a>
              <Button type="submit">Next</Button>
            </div>
          </form>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <form action={saveSignalLabels} className="space-y-4">
            <H2>Step 5: Signal labels</H2>
            <MetaText>Customise observation signal display names for your school&apos;s language.</MetaText>
            <div className="overflow-x-auto">
              <table className="table-shell w-full">
                <thead>
                  <tr className="table-head-row">
                    <th className="p-2 text-left">Signal</th>
                    <th className="p-2 text-left">Display name</th>
                    <th className="p-2 text-left">Description (optional)</th>
                  </tr>
                </thead>
                <tbody>
                  {getAllSignalDefinitionsForTenantLabels().map((signal) => (
                    <tr className="table-row align-top" key={signal.key}>
                      <td className="p-2 font-mono text-xs">{signal.key}</td>
                      <td className="p-2">
                        <input
                          name={`display_${signal.key}`}
                          defaultValue={signal.displayNameDefault}
                          className="field w-full"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          name={`description_${signal.key}`}
                          defaultValue={signal.descriptionDefault}
                          className="field w-full"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <a href="/onboarding?step=4"><Button type="button" variant="secondary">Back</Button></a>
              <Button type="submit">Next</Button>
            </div>
          </form>
        </Card>
      )}

      {step === 6 && (
        <Card className="space-y-4">
          <H2>Step 6: Timetable upload (optional)</H2>
          <MetaText>
            Optionally upload a timetable CSV. This can be done later from the Admin panel.
          </MetaText>
          <div className="flex flex-wrap gap-2">
            <a href="/onboarding?step=5"><Button type="button" variant="secondary">Back</Button></a>
            <a href="/admin/timetable"><Button type="button" variant="secondary">Upload timetable</Button></a>
            <a href="/onboarding?step=7"><Button type="button">Skip</Button></a>
          </div>
        </Card>
      )}

      {step === 7 && (
        <Card className="space-y-4">
          <H2>Step 7: All done!</H2>
          <MetaText>
            Your school is set up. You can always revisit any settings from the Admin panel.
          </MetaText>
          <form action={finishOnboarding}>
            <Button type="submit">Go to dashboard</Button>
          </form>
        </Card>
      )}
    </WizardClient>
  );
}
