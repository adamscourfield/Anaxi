import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { assertSafeServerAction } from "@/lib/serverActionGuard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AdminPageChrome } from "@/components/ui/admin-page-chrome";

const REQUIRED_KEYS = ["positive_points", "detentions", "internal_exclusions", "on_calls", "suspensions"];

export default async function AdminVocabPage() {
  const user = await requireAdminUser();
  const vocab = await prisma.tenantVocab.findMany({ where: { tenantId: user.tenantId }, orderBy: { key: "asc" } });

  async function saveVocab(formData: FormData) {
    "use server";
    await assertSafeServerAction(formData);
    const admin = await requireAdminUser();
    for (const key of REQUIRED_KEYS) {
      const singular = String(formData.get(`${key}_singular`) || "");
      const plural = String(formData.get(`${key}_plural`) || "");
      await prisma.tenantVocab.upsert({
        where: { tenantId_key: { tenantId: admin.tenantId, key } },
        create: { tenantId: admin.tenantId, key, labelSingular: singular, labelPlural: plural },
        update: { labelSingular: singular, labelPlural: plural },
      });
    }
    revalidatePath("/admin/vocab");
  }

  const byKey = new Map<string, any>((vocab as any[]).map((v: any) => [v.key, v]));

  return (
    <div className="space-y-4">
      <Link href="/admin/terminology" className="link-accent text-xs">← Back to Terminology</Link>
      <AdminPageChrome area="Vocabulary" title="Terminology · Vocabulary" subtitle="Set singular/plural labels for behaviour event language." />
      <Card className="text-sm text-muted">
        This controls event nouns (for example: detention/detentions). For broader UI wording, use <a className="link-accent" href="/admin/language">Language</a>.
      </Card>
      <form action={saveVocab} className="space-y-3">
        {REQUIRED_KEYS.map((key) => {
          const row = byKey.get(key);
          return (
            <Card key={key} className="grid gap-3 sm:grid-cols-[220px_1fr_1fr] sm:items-center">
              <div className="text-sm font-semibold uppercase tracking-[0.04em] text-muted">{key}</div>
              <input className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" name={`${key}_singular`} defaultValue={row?.labelSingular || ""} placeholder="Singular" />
              <input className="rounded-lg border border-border bg-bg px-3 py-2 text-sm" name={`${key}_plural`} defaultValue={row?.labelPlural || ""} placeholder="Plural" />
            </Card>
          );
        })}
        <Button type="submit">Save changes</Button>
      </form>
    </div>
  );
}
