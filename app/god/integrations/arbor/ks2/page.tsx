import Link from "next/link";
import { requireSuperAdminUser } from "@/lib/admin";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { loadArborKs2Results } from "@/lib/integrations/arbor/ks2Source";
import { planKs2Backfill } from "@/lib/integrations/arbor/ks2PriorAttainment";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";
import { SubmitButton } from "@/components/ui/submit-button";
import { importArborKs2 } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export default async function Ks2ImportPage({ searchParams }: { searchParams: Promise<{ connectionId?: string; updated?: string; scores?: string }> }) {
  await requireSuperAdminUser();
  const params = await searchParams;
  const integration = await prisma.sharedIntegration.findFirst({ where: { provider: "ARBOR", ...(params.connectionId ? { id: params.connectionId } : {}) }, include: { schools: { where: { enabled: true }, select: { tenantId: true } } } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return <p>Arbor is not connected.</p>;
  const students = await prisma.student.findMany({ where: { tenantId: { in: integration.schools.map((school) => school.tenantId) }, externalId: { not: null } }, select: { id: true, tenantId: true, externalId: true, ks2ReadingScaledScore: true, ks2MathsScaledScore: true } });
  try {
    const source = await loadArborKs2Results(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext));
    const plan = planKs2Backfill(students, source.results);
    const paired = students.filter((student) => student.ks2ReadingScaledScore !== null && student.ks2MathsScaledScore !== null).length;
    const scoreCount = plan.updates.reduce((total, update) => total + Object.keys(update.data).length, 0);
    return <main className="mx-auto max-w-5xl space-y-6 p-8">
      <Link href={`/god/integrations/arbor?connectionId=${integration.id}`}>← Back to Arbor connection</Link>
      <h1 className="text-2xl font-semibold">KS2 prior attainment</h1>
      <p>Import reading and maths scaled scores from {integration.label}. Existing Anaxi values are preserved.</p>
      {params.updated !== undefined ? <p role="status" className="rounded border border-border p-4">Imported {params.scores} scores for {params.updated} students.</p> : null}
      <dl className="grid gap-4 sm:grid-cols-3">
        <div><dt>Students with both scores</dt><dd className="text-2xl">{paired} / {students.length}</dd></div>
        <div><dt>Students ready to update</dt><dd className="text-2xl">{plan.updates.length}</dd></div>
        <div><dt>Missing scores found in Arbor</dt><dd className="text-2xl">{scoreCount}</dd></div>
      </dl>
      <p>{source.results.length} valid scaled marks found across {source.matchedDefinitions.length} KS2 assessment definitions. {source.scanned} source marks checked. {plan.conflicts} conflicting scores skipped; {source.invalid} invalid or unavailable marks skipped.</p>
      {plan.updates.length ? <form action={importArborKs2}><input type="hidden" name="connectionId" value={integration.id} /><SubmitButton>Import missing KS2 scores</SubmitButton></form> : <p>No missing scores can currently be filled from this source.</p>}
      <h2 className="text-lg font-semibold">Matched KS2 assessments</h2>
      <ul>{source.matchedDefinitions.map((definition) => <li key={definition.id}>{definition.assessmentName || definition.displayName} ({definition.subject})</li>)}</ul>
      {!source.matchedDefinitions.length ? <details><summary>Available KS2 source definitions</summary><pre className="whitespace-pre-wrap text-sm">{JSON.stringify(source.catalogue, null, 2)}</pre></details> : null}
      <p className="text-sm text-muted">Only existing students linked to this connection’s enabled schools are updated. Missing scores remain blank. Each imported change is recorded in the integration audit trail.</p>
    </main>;
  } catch (error) {
    return <main className="space-y-4 p-8"><h1>KS2 prior attainment</h1><p role="alert">{error instanceof Error ? error.message : "Unable to read Arbor KS2 scores."}</p><p>No scores were changed. Check Arbor source access, then refresh this page.</p></main>;
  }
}
