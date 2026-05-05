import Link from "next/link";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { getAllSignalDefinitionsForTenantLabels } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels, upsertTenantSignalLabel } from "@/modules/observations/tenantSignalLabels";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";

const ACCENT_TAG = "#7C69EF";

const BEHAVIOUR_FIELDS = [
  { key: "positivePointsLabel", heading: "Positive points label", default: "Positive Points" },
  { key: "detentionLabel", heading: "Detention label", default: "Detention" },
  { key: "internalExclusionLabel", heading: "Internal exclusion label", default: "Internal Exclusion" },
  { key: "suspensionLabel", heading: "Suspension label", default: "Suspension" },
  { key: "onCallLabel", heading: "On call label", default: "On Call" },
] as const;

const VOCAB_KEYS = ["positive_points", "detentions", "internal_exclusions", "on_calls", "suspensions"] as const;

const VOCAB_ROWS: {
  key: (typeof VOCAB_KEYS)[number];
  title: string;
  singularPlaceholder: string;
  pluralPlaceholder: string;
  iconWell: string;
  icon: ReactNode;
}[] = [
  {
    key: "positive_points",
    title: "Positive points",
    singularPlaceholder: "Positive Point",
    pluralPlaceholder: "Positive Points",
    iconWell: "bg-[rgba(124,105,239,0.14)] text-[#7C69EF]",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6-4.6-6 4.6 2.3-7-6-4.6h7.6z" />
      </svg>
    ),
  },
  {
    key: "detentions",
    title: "Detentions",
    singularPlaceholder: "Detention",
    pluralPlaceholder: "Detentions",
    iconWell: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "internal_exclusions",
    title: "Internal exclusions",
    singularPlaceholder: "Internal Exclusion",
    pluralPlaceholder: "Internal Exclusions",
    iconWell: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <path d="M6 12h12" />
      </svg>
    ),
  },
  {
    key: "suspensions",
    title: "Suspensions",
    singularPlaceholder: "Suspension",
    pluralPlaceholder: "Suspensions",
    iconWell: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-400",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <rect x="8" y="5" width="3.5" height="14" rx="1" />
        <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
      </svg>
    ),
  },
  {
    key: "on_calls",
    title: "On calls",
    singularPlaceholder: "On Call",
    pluralPlaceholder: "On Calls",
    iconWell: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={ACCENT_TAG} strokeWidth="2" aria-hidden>
      <path d="M12 2H2v10l9.29 9.29a1 1 0 001.41 0l6.59-6.59a1 1 0 000-1.41L12 2z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="1.5" fill={ACCENT_TAG} stroke="none" />
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
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(124,105,239,0.14)]">
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
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${row.iconWell}`}
                          >
                            {row.icon}
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
      {observationsEnabled && (
        <TerminologyCard className="overflow-hidden">
          <div className="border-b border-border/20 px-5 py-5 sm:px-7 sm:py-6">
            <SectionHeader
              title="Observation signal labels"
              subtitle="Adjust display names and descriptions used in observation screens."
            />
          </div>
          <form action={saveSignalLabels} className="space-y-4 px-5 pb-6 pt-2 sm:px-7 sm:pb-7">
            <div className="overflow-x-auto rounded-xl border border-border/25">
              <div className="table-shell border-0 shadow-none">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="table-head-row text-left">
                      <th className="px-5 py-3.5">Signal</th>
                      <th className="px-4 py-3.5">Default name</th>
                      <th className="px-4 py-3.5">Display name</th>
                      <th className="px-4 py-3.5">Description</th>
                      <th className="px-4 py-3.5 text-center">Reset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signalCatalog.map((signal) => {
                      const override = signalLabels[signal.key];
                      return (
                        <tr className="table-row align-top" key={signal.key}>
                          <td className="px-5 py-3 font-mono text-xs text-muted">{signal.key}</td>
                          <td className="px-4 py-3 text-sm text-muted">{signal.displayNameDefault}</td>
                          <td className="px-4 py-3">
                            <input
                              name={`display_${signal.key}`}
                              defaultValue={override?.displayName || signal.displayNameDefault}
                              minLength={2}
                              maxLength={80}
                              required
                              className="field w-full"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <textarea
                              name={`description_${signal.key}`}
                              defaultValue={override?.description ?? signal.descriptionDefault}
                              maxLength={240}
                              rows={2}
                              className="field w-full resize-y"
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
            </div>
            <Button type="submit">Save signal labels</Button>
          </form>
        </TerminologyCard>
      )}
    </div>
  );
}
