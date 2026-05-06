import Link from "next/link";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { requireFeature } from "@/lib/guards";
import { getAllSignalDefinitionsForTenantLabels } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels, upsertTenantSignalLabel } from "@/modules/observations/tenantSignalLabels";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ObservationSignalLabelsSection } from "../observation-signal-labels/ObservationSignalLabelsSection";

const BEHAVIOUR_FIELDS = [
  { key: "positivePointsLabel", heading: "Positive points label", default: "Positive Points" },
  { key: "detentionLabel", heading: "Detention label", default: "Detention" },
  { key: "internalExclusionLabel", heading: "Internal exclusion label", default: "Internal Exclusion" },
  { key: "suspensionLabel", heading: "Suspension label", default: "Suspension" },
  { key: "onCallLabel", heading: "On call label", default: "On Call" },
] as const;

const VOCAB_KEYS = ["positive_points", "detentions", "internal_exclusions", "on_calls", "suspensions"] as const;

/** Same lavender well + tag glyph as behaviour labels above (terminology admin pattern). */
const VOCAB_ICON_WELL =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[rgba(124,92,255,0.12)] text-[#7C5CFF]";

const VOCAB_ROWS: {
  key: (typeof VOCAB_KEYS)[number];
  title: string;
  singularPlaceholder: string;
  pluralPlaceholder: string;
}[] = [
  {
    key: "positive_points",
    title: "Positive points",
    singularPlaceholder: "Positive Point",
    pluralPlaceholder: "Positive Points",
  },
  {
    key: "detentions",
    title: "Detentions",
    singularPlaceholder: "Detention",
    pluralPlaceholder: "Detentions",
  },
  {
    key: "internal_exclusions",
    title: "Internal exclusions",
    singularPlaceholder: "Internal Exclusion",
    pluralPlaceholder: "Internal Exclusions",
  },
  {
    key: "suspensions",
    title: "Suspensions",
    singularPlaceholder: "Suspension",
    pluralPlaceholder: "Suspensions",
  },
  {
    key: "on_calls",
    title: "On calls",
    singularPlaceholder: "On Call",
    pluralPlaceholder: "On Calls",
  },
];

function TagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2H2v10l9.29 9.29a1 1 0 001.41 0l6.59-6.59a1 1 0 000-1.41L12 2z" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TerminologyCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border/35 bg-background shadow-[0_2px_16px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}

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
    await requireFeature(admin.tenantId, "OBSERVATIONS");
    for (const signal of getAllSignalDefinitionsForTenantLabels()) {
      const displayName = String(formData.get(`display_${signal.key}`) || signal.displayNameDefault).trim();
      const description = String(formData.get(`description_${signal.key}`) || "");
      await upsertTenantSignalLabel(admin.tenantId, signal.key, displayName || signal.displayNameDefault, description);
    }
    revalidatePath("/admin/language");
    revalidatePath("/admin/signals");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  async function resetAllSignals(_formData?: FormData) {
    "use server";
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");
    for (const signal of getAllSignalDefinitionsForTenantLabels()) {
      await upsertTenantSignalLabel(admin.tenantId, signal.key, signal.displayNameDefault, null);
    }
    revalidatePath("/admin/language");
    revalidatePath("/admin/signals");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  async function resetSignal(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");
    const key = String(formData.get("signalKey") || "");
    const signal = getAllSignalDefinitionsForTenantLabels().find((s) => s.key === key);
    if (!signal) return;
    await upsertTenantSignalLabel(admin.tenantId, signal.key, signal.displayNameDefault, null);
    revalidatePath("/admin/language");
    revalidatePath("/admin/signals");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  return (
    <div className="space-y-8 pb-8">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted calm-transition hover:text-text">
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Admin
      </Link>
      <PageHeader variant="ledger"
        title="Terminology"
        subtitle="Configure all language, vocabulary, and signal wording used across the product."
      />

      {/* ── Behaviour Labels ─────────────────────────────────────────── */}
      <TerminologyCard>
        <div className="border-b border-border/20 px-5 py-5 sm:px-7 sm:py-6">
          <h2 className="text-lg font-bold tracking-tight text-text">Behaviour labels</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            Override labels used across behaviour and leave workflows.
          </p>
        </div>
        <form action={saveBehaviourLabels} className="px-5 py-6 sm:px-7 sm:pb-7">
          <div className="grid gap-6 sm:grid-cols-2">
            {BEHAVIOUR_FIELDS.map((field) => (
              <div key={field.key} className="flex gap-3 sm:gap-4">
                <span className={`mt-0.5 ${VOCAB_ICON_WELL}`}>
                  <TagIcon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`beh-${field.key}`}
                    className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted"
                  >
                    {field.heading.replace(/\s+label$/i, "").trim()} label
                  </label>
                  <input
                    id={`beh-${field.key}`}
                    name={field.key}
                    defaultValue={settings?.[field.key] ?? field.default}
                    placeholder={field.default}
                    className="field w-full"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm calm-transition hover:bg-neutral-900 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 21 17 13 7 13 7 21" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 3 7 8 15 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save behaviour labels
            </button>
          </div>
        </form>
      </TerminologyCard>

      {/* ── Vocabulary ───────────────────────────────────────────────── */}
      <TerminologyCard className="overflow-hidden">
        <div className="border-b border-border/20 px-5 py-5 sm:px-7 sm:py-6">
          <h2 className="text-lg font-bold tracking-tight text-text">Vocabulary</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            Set singular and plural labels for behaviour event nouns shown across views.
          </p>
        </div>
        <form action={saveVocab}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/25 bg-transparent">
                  <th className="px-5 py-3.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted sm:px-7">
                    Event type
                  </th>
                  <th className="px-4 py-3.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">
                    Singular
                  </th>
                  <th className="px-4 py-3.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted sm:pr-7">
                    Plural
                  </th>
                </tr>
              </thead>
              <tbody>
                {VOCAB_ROWS.map((row) => {
                  const v = vocabByKey.get(row.key);
                  return (
                    <tr key={row.key} className="border-b border-border/15 last:border-b-0 calm-transition hover:bg-surface-container-low/40">
                      <td className="px-5 py-4 sm:px-7">
                        <div className="flex items-center gap-3">
                          <span className={VOCAB_ICON_WELL}>
                            <TagIcon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="font-semibold text-text">{row.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <input
                          name={`${row.key}_singular`}
                          defaultValue={v?.labelSingular || ""}
                          placeholder={row.singularPlaceholder}
                          className="field w-full min-w-[8rem]"
                        />
                      </td>
                      <td className="px-4 py-4 align-middle sm:pr-7">
                        <input
                          name={`${row.key}_plural`}
                          defaultValue={v?.labelPlural || ""}
                          placeholder={row.pluralPlaceholder}
                          className="field w-full min-w-[8rem]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/20 px-5 py-5 sm:px-7">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm calm-transition hover:bg-neutral-900 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 21 17 13 7 13 7 21" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="7 3 7 8 15 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Save vocabulary
            </button>
          </div>
        </form>
      </TerminologyCard>

      {/* ── Observation Signal Labels ─────────────────────────────────── */}
      {observationsEnabled ? (
        <ObservationSignalLabelsSection
          signalCatalog={signalCatalog}
          labels={signalLabels}
          saveAll={saveSignalLabels}
          resetOne={resetSignal}
          resetAll={resetAllSignals}
          showFooterSave
          footerSaveLabel="Save signal labels"
        />
      ) : null}
    </div>
  );
}
