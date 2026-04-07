import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin";
import { requireFeature } from "@/lib/guards";
import { getAllSignalDefinitionsForTenantLabels } from "@/modules/observations/getSignalsBySchoolType";
import { getTenantSignalLabels, upsertTenantSignalLabel } from "@/modules/observations/tenantSignalLabels";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";

export default async function AdminSignalsPage() {
  const user = await requireAdminUser();
  await requireFeature(user.tenantId, "OBSERVATIONS");
  const labels = await getTenantSignalLabels(user.tenantId);
  const signalCatalog = getAllSignalDefinitionsForTenantLabels();

  async function saveAll(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");

    for (const signal of getAllSignalDefinitionsForTenantLabels()) {
      const displayName = String(formData.get(`display_${signal.key}`) || signal.displayNameDefault);
      const description = String(formData.get(`description_${signal.key}`) || "");
      await upsertTenantSignalLabel(admin.tenantId, signal.key, displayName, description);
    }

    revalidatePath("/admin/signals");
    revalidatePath("/observe/new");
    revalidatePath("/observe/history");
  }

  async function resetOne(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    await requireFeature(admin.tenantId, "OBSERVATIONS");
    const key = String(formData.get("signalKey") || "");
    const signal = getAllSignalDefinitionsForTenantLabels().find((row) => row.key === key);
    if (!signal) return;

    await upsertTenantSignalLabel(admin.tenantId, signal.key, signal.displayNameDefault, null);
    revalidatePath("/admin/signals");
  }

  return (
    <div className="space-y-4">
      <Link href="/admin/terminology" className="text-xs text-accent hover:underline">← Back to Terminology</Link>
      <PageHeader title="Observation Signals" subtitle="Edit signal display names and descriptions used in observation workflows." />
      <Card className="text-sm text-muted">
        Use this for signal-level wording only. For cross-module wording, use <a className="text-accent hover:underline" href="/admin/language">Language</a>.
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="p-4 pb-0">
          <SectionHeader title="Observation signal labels" subtitle="Set display names and descriptions for each signal key." />
        </div>
        <form action={saveAll} className="space-y-3 p-4 pt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg/60 text-left text-xs uppercase tracking-[0.05em] text-muted">
                  <th className="p-2">Signal key</th>
                  <th className="p-2">Default</th>
                  <th className="p-2">Tenant display name</th>
                  <th className="p-2">Tenant description</th>
                  <th className="p-2 text-center">Reset</th>
                </tr>
              </thead>
              <tbody>
                {signalCatalog.map((signal) => {
                  const override = labels[signal.key];
                  return (
                    <tr className="border-b border-border/70 align-top last:border-0" key={signal.key}>
                      <td className="p-2 font-mono text-xs">{signal.key}</td>
                      <td className="p-2">{signal.displayNameDefault}</td>
                      <td className="p-2">
                        <input
                          name={`display_${signal.key}`}
                          defaultValue={override?.displayName || signal.displayNameDefault}
                          minLength={2}
                          maxLength={80}
                          required
                          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5"
                        />
                      </td>
                      <td className="p-2">
                        <textarea
                          name={`description_${signal.key}`}
                          defaultValue={override?.description ?? signal.descriptionDefault}
                          maxLength={240}
                          rows={2}
                          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <Button formAction={resetOne} name="signalKey" value={signal.key} className="px-2 py-1 text-xs" variant="ghost" type="submit">Reset</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button type="submit">Save changes</Button>
        </form>
      </Card>
    </div>
  );
}
