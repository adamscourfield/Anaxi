import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { getAllSignalDefinitionsForTenantLabels } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels, upsertTenantSignalLabel } from "@/modules/observations/tenantSignalLabels";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";

const BEHAVIOUR_FIELDS = [
  { key: "positivePointsLabel", label: "Positive points label", default: "Positive Points" },
  { key: "detentionLabel", label: "Detention label", default: "Detention" },
  { key: "internalExclusionLabel", label: "Internal exclusion label", default: "Internal Exclusion" },
  { key: "suspensionLabel", label: "Suspension label", default: "Suspension" },
  { key: "onCallLabel", label: "On call label", default: "On Call" },
] as const;

const VOCAB_KEYS = ["positive_points", "detentions", "internal_exclusions", "on_calls", "suspensions"];

const VOCAB_LABELS: Record<string, string> = {
  positive_points: "Positive points",
  detentions: "Detentions",
  internal_exclusions: "Internal exclusions",
  on_calls: "On calls",
  suspensions: "Suspensions",
};

export default async function AdminLanguagePage() {
  const user = await requireAdminUser();

  const observationsFeature = await prisma.tenantFeature.findUnique({
    where: { tenantId_key: { tenantId: user.tenantId, key: "OBSERVATIONS" } }
  });
  const observationsEnabled = observationsFeature?.enabled ?? false;

  const signalCatalog = getAllSignalDefinitionsForTenantLabels();

  const [settings, signalLabels, vocab] = await Promise.all([
    (prisma as any).tenantSettings.findUnique({ where: { tenantId: user.tenantId } }),
    getTenantSignalLabels(user.tenantId),
    prisma.tenantVocab.findMany({ where: { tenantId: user.tenantId }, orderBy: { key: "asc" } }),
  ]);

  const vocabByKey = new Map<string, any>((vocab as any[]).map((v: any) => [v.key, v]));

  async function saveBehaviourLabels(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const data: Record<string, string> = {};
    for (const field of BEHAVIOUR_FIELDS) {
      const val = String(formData.get(field.key) || field.default).trim();
      data[field.key] = val || field.default;
    }
    await (prisma as any).tenantSettings.upsert({
      where: { tenantId: admin.tenantId },
      update: data,
      create: { tenantId: admin.tenantId, ...data },
    });
    revalidatePath("/admin/language");
  }

  async function saveVocab(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    for (const key of VOCAB_KEYS) {
      const singular = String(formData.get(`${key}_singular`) || "");
      const plural = String(formData.get(`${key}_plural`) || "");
      await prisma.tenantVocab.upsert({
        where: { tenantId_key: { tenantId: admin.tenantId, key } },
        create: { tenantId: admin.tenantId, key, labelSingular: singular, labelPlural: plural },
        update: { labelSingular: singular, labelPlural: plural },
      });
    }
    revalidatePath("/admin/language");
  }

  async function saveSignalLabels(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    for (const signal of getAllSignalDefinitionsForTenantLabels()) {
      const displayName = String(formData.get(`display_${signal.key}`) || signal.displayNameDefault).trim();
      const description = String(formData.get(`description_${signal.key}`) || "");
      await upsertTenantSignalLabel(admin.tenantId, signal.key, displayName || signal.displayNameDefault, description);
    }
    revalidatePath("/admin/language");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  async function resetSignal(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const key = String(formData.get("signalKey") || "");
    const signal = getAllSignalDefinitionsForTenantLabels().find((s) => s.key === key);
    if (!signal) return;
    await upsertTenantSignalLabel(admin.tenantId, signal.key, signal.displayNameDefault, null);
    revalidatePath("/admin/language");
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-xs text-accent hover:underline">← Back to Admin</Link>
      <PageHeader
        title="Terminology"
        subtitle="Configure all language, vocabulary, and signal wording used across the product."
      />

      {/* ── Behaviour Labels ─────────────────────────────────────────── */}
      <Card>
        <SectionHeader
          title="Behaviour labels"
          subtitle="Override labels used across behaviour and leave workflows."
        />
        <form action={saveBehaviourLabels} className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
          {BEHAVIOUR_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                {field.label}
              </label>
              <input
                name={field.key}
                defaultValue={settings?.[field.key] ?? field.default}
                placeholder={field.default}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          ))}
          <div className="sm:col-span-2 pt-1">
            <Button type="submit">Save behaviour labels</Button>
          </div>
        </form>
      </Card>

      {/* ── Vocabulary ───────────────────────────────────────────────── */}
      <Card>
        <SectionHeader
          title="Vocabulary"
          subtitle="Set singular and plural labels for behaviour event nouns shown across views."
        />
        <form action={saveVocab} className="mt-4 space-y-3">
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 max-w-3xl text-xs font-semibold uppercase tracking-[0.06em] text-muted pb-1">
            <span>Event type</span>
            <span>Singular</span>
            <span>Plural</span>
          </div>
          {VOCAB_KEYS.map((key) => {
            const row = vocabByKey.get(key);
            return (
              <div key={key} className="grid max-w-3xl gap-3 grid-cols-[1fr_1fr_1fr] items-center rounded-lg border border-border/60 bg-bg/30 px-3 py-2.5">
                <span className="text-sm font-medium text-text">{VOCAB_LABELS[key] ?? key}</span>
                <input
                  name={`${key}_singular`}
                  defaultValue={row?.labelSingular || ""}
                  placeholder="Singular"
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <input
                  name={`${key}_plural`}
                  defaultValue={row?.labelPlural || ""}
                  placeholder="Plural"
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
            );
          })}
          <div className="pt-1">
            <Button type="submit">Save vocabulary</Button>
          </div>
        </form>
      </Card>

      {/* ── Observation Signal Labels ─────────────────────────────────── */}
      {observationsEnabled && (
        <Card className="overflow-hidden p-0">
          <div className="p-5 pb-3">
            <SectionHeader
              title="Observation signal labels"
              subtitle="Adjust display names and descriptions used in observation screens."
            />
          </div>
          <form action={saveSignalLabels} className="space-y-3 px-5 pb-5">
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg/60 text-left text-xs uppercase tracking-[0.05em] text-muted">
                    <th className="px-4 py-3">Signal</th>
                    <th className="px-4 py-3">Default name</th>
                    <th className="px-4 py-3">Display name</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-center">Reset</th>
                  </tr>
                </thead>
                <tbody>
                  {signalCatalog.map((signal) => {
                    const override = signalLabels[signal.key];
                    return (
                      <tr className="border-b border-border/60 align-top last:border-0" key={signal.key}>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{signal.key}</td>
                        <td className="px-4 py-3 text-sm text-muted">{signal.displayNameDefault}</td>
                        <td className="px-4 py-3">
                          <input
                            name={`display_${signal.key}`}
                            defaultValue={override?.displayName || signal.displayNameDefault}
                            minLength={2}
                            maxLength={80}
                            required
                            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <textarea
                            name={`description_${signal.key}`}
                            defaultValue={override?.description ?? signal.descriptionDefault}
                            maxLength={240}
                            rows={2}
                            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            formAction={resetSignal}
                            name="signalKey"
                            value={signal.key}
                            type="submit"
                            variant="ghost"
                            className="px-2 py-1 text-xs"
                          >
                            Reset
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pt-1">
              <Button type="submit">Save signal labels</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
