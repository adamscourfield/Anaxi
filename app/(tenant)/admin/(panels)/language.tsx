import styles from "../language/page.module.css";
import { AdminSectionLink } from "@/components/admin/admin-section-link";
import type { ReactNode } from "react";
import { revalidatePath } from "next/cache";
import { revalidateAdmin } from "@/lib/admin-revalidate";
import { prisma } from "@/lib/prisma";
import { DEFAULT_VOCAB, getTenantVocab, pluralLabel } from "@/lib/vocab";
import { requireAdminUser } from "@/lib/admin";
import { assertSafeServerAction } from "@/lib/serverActionGuard";
import { Button } from "@/components/ui/button";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";

/** The five behaviour events, with the tenant-settings field that holds the older single label. */
const BEHAVIOUR_WORDS = [
  { key: "positive_points", title: "Positive points", settingsField: "positivePointsLabel" },
  { key: "detentions", title: "Detentions", settingsField: "detentionLabel" },
  { key: "internal_exclusions", title: "Internal exclusions", settingsField: "internalExclusionLabel" },
  { key: "suspensions", title: "Suspensions", settingsField: "suspensionLabel" },
  { key: "on_calls", title: "On calls", settingsField: "onCallLabel" },
] as const;

function TerminologyCard({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div
      id={id}
      className={`rounded-sm border border-border/35 bg-background shadow-none ${className}`}
    >
      {children}
    </div>
  );
}

export async function LanguageAdminPanel() {
  const user = await requireAdminUser();

  const observationsFeature = await prisma.tenantFeature.findUnique({
    where: { tenantId_key: { tenantId: user.tenantId, key: "OBSERVATIONS" } }
  });
  const observationsEnabled = observationsFeature?.enabled ?? false;

  // The words people actually see: Vocabulary entries, falling back to the older single
  // behaviour labels, then the defaults (see lib/vocab.ts).
  const words = await getTenantVocab(user.tenantId);

  /**
   * One editor for behaviour words. It writes both stores so every page agrees: the
   * singular/plural vocabulary (read through getTenantVocab) and the older single label on
   * tenant settings, which onboarding and a few pages still read.
   */
  async function saveBehaviourWords(formData: FormData) {
    "use server";
    await assertSafeServerAction(formData);
    const admin = await requireAdminUser();
    const settingsData: Record<string, string> = {};
    for (const row of BEHAVIOUR_WORDS) {
      const singular = String(formData.get(`${row.key}_singular`) || "").trim() || DEFAULT_VOCAB[row.key].singular;
      const plural = String(formData.get(`${row.key}_plural`) || "").trim() || pluralLabel(singular);
      await prisma.tenantVocab.upsert({
        where: { tenantId_key: { tenantId: admin.tenantId, key: row.key } },
        create: { tenantId: admin.tenantId, key: row.key, labelSingular: singular, labelPlural: plural },
        update: { labelSingular: singular, labelPlural: plural },
      });
      // Positive points has always been stored as the plural ("Positive Points") in settings.
      settingsData[row.settingsField] = row.key === "positive_points" ? plural : singular;
    }
    await (prisma as any).tenantSettings.upsert({
      where: { tenantId: admin.tenantId },
      update: settingsData,
      create: { tenantId: admin.tenantId, ...settingsData },
    });
    revalidateAdmin("language");
    revalidatePath("/", "layout");
  }

  return (
    <div className={`${styles.page} space-y-8 pb-8`}>
      <AdminPageChrome
        area="Language"
        title="Language"
        subtitle="Use your school’s own words for behaviour events across Anaxi."
      />

      <TerminologyCard className="overflow-hidden scroll-mt-24" id="vocabulary">
        <div className="border-b border-border/20 px-5 py-5 sm:px-7 sm:py-6">
          <h2 className="text-lg font-bold tracking-tight text-text">Behaviour words</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
            The words Anaxi uses for each behaviour event, on its own (one detention) and in counts and headings
            (three detentions). Leave the plural blank to add an “s”.
          </p>
        </div>
        <form action={saveBehaviourWords}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/25 bg-transparent">
                  <th className="px-5 py-3.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted sm:px-7">
                    Event
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
                {BEHAVIOUR_WORDS.map((row) => (
                  <tr key={row.key} className="border-b border-border/15 last:border-b-0">
                    <td className="px-5 py-4 font-semibold text-text sm:px-7">{row.title}</td>
                    <td className="px-4 py-4 align-middle">
                      <input
                        name={`${row.key}_singular`}
                        aria-label={`${row.title}, singular`}
                        defaultValue={words[row.key]?.singular ?? DEFAULT_VOCAB[row.key].singular}
                        placeholder={DEFAULT_VOCAB[row.key].singular}
                        maxLength={60}
                        className="field w-full min-w-[8rem]"
                      />
                    </td>
                    <td className="px-4 py-4 align-middle sm:pr-7">
                      <input
                        name={`${row.key}_plural`}
                        aria-label={`${row.title}, plural`}
                        defaultValue={words[row.key]?.plural ?? DEFAULT_VOCAB[row.key].plural}
                        placeholder={DEFAULT_VOCAB[row.key].plural}
                        maxLength={60}
                        className="field w-full min-w-[8rem]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/20 px-5 py-5 sm:px-7">
            <Button type="submit">Save behaviour words</Button>
          </div>
        </form>
      </TerminologyCard>

      {/* Observation signal wording is edited in one place: the Signals section. */}
      {observationsEnabled ? (
        <p className="text-[0.8125rem] text-muted">
          Observation signal names and descriptions are edited under{" "}
          <AdminSectionLink href="/admin?section=signals" className="link-accent">Signals</AdminSectionLink>.
        </p>
      ) : null}
    </div>
  );
}
