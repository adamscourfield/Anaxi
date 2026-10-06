import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminUser } from "@/lib/admin";
import { mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { H3, MetaText } from "@/components/ui/typography";
import { arborConnectionHref } from "@/lib/integrations/arbor/connectionScope";

type PreparedDefinition = { id: string; label: string; assessmentDate?: string | null; periodHint?: string | null };

function decodeCycleKey(value: string): string {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    return decoded.startsWith("ARBOR:assessment-cycle:") ? decoded : value;
  } catch {
    return value;
  }
}

export default async function ArborAssessmentCycleReviewPage({ params, searchParams }: { params: Promise<{ cycleKey: string }>; searchParams?: Promise<{ connectionId?: string }> }) {
  await requireSuperAdminUser();
  const { cycleKey: encodedCycleKey } = await params;
  const query = await searchParams;
  const cycleKey = decodeCycleKey(encodedCycleKey);
  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({
    where: { provider: "ARBOR", ...(query?.connectionId ? { id: query.connectionId } : {}) },
  });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") notFound();

  const config = integration.config && typeof integration.config === "object" ? integration.config as Record<string, unknown> : {};
  const sync = config.assessmentSync && typeof config.assessmentSync === "object" ? config.assessmentSync as Record<string, unknown> : {};
  const definitions = Array.isArray(sync.historicalDefinitions)
    ? sync.historicalDefinitions.filter((item): item is PreparedDefinition => Boolean(item) && typeof (item as PreparedDefinition).id === "string" && typeof (item as PreparedDefinition).label === "string")
    : [];
  const matchingDefinitions = definitions.filter((definition) => {
    const mapping = mapArborAssessment(definition.label, definition.assessmentDate, definition.periodHint);
    return mapping?.yearGroups.some((yearGroup) => mapArborAssessmentForYearGroup(mapping, yearGroup)?.cycleExternalId === cycleKey);
  });
  if (!matchingDefinitions.length) notFound();

  const firstMapping = mapArborAssessment(matchingDefinitions[0].label, matchingDefinitions[0].assessmentDate, matchingDefinitions[0].periodHint)!;
  const yearGroup = firstMapping.yearGroups.find((value) => mapArborAssessmentForYearGroup(firstMapping, value)?.cycleExternalId === cycleKey)!;
  const cycle = mapArborAssessmentForYearGroup(firstMapping, yearGroup)!;
  const historicDiscoveryComplete = sync.historicComplete === true;
  const cyclePath = `/god/integrations/arbor/assessments/${encodeURIComponent(Buffer.from(cycleKey).toString("base64url"))}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        eyebrow="God Mode · Arbor"
        title={cycle.cycleLabel}
        subtitle={historicDiscoveryComplete
          ? "Read-only review of the Arbor marks that would be imported into this cycle. No results are created or changed here."
          : "Read-only partial review while historic discovery continues. More matching Arbor subjects can appear here before this cycle becomes available for approval."}
        actions={<Link href={integration ? arborConnectionHref("/god/integrations/arbor", integration.id) : "/god/integrations/arbor"}><Button variant="secondary">Back to Arbor</Button></Link>}
      />

      <Card className="grid gap-4 sm:grid-cols-2">
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Grade format</div><div className="mt-1 font-semibold">{cycle.gradeFormat === "PERCENTAGE" ? "Percentage" : cycle.gradeFormat === "A_LEVEL" ? "A-Level" : "GCSE"}</div></div>
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Arbor definitions</div><div className="mt-1 font-semibold">{matchingDefinitions.length}</div></div>
      </Card>

      <Card className="space-y-3">
        <div>
          <H3>Subject assessments</H3>
          <MetaText className="mt-1">Open an assessment to review its full Arbor mark sheet. Rows come only from the pupils Arbor has associated with that subject.</MetaText>
        </div>
        <div className="divide-y divide-border/70 rounded-sm border border-border/70">
          {matchingDefinitions.map((definition) => (
            <div key={definition.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0 text-sm font-medium">{definition.label}</div>
              <Link className="shrink-0 text-sm font-semibold underline underline-offset-4" href={arborConnectionHref(`${cyclePath}/${encodeURIComponent(definition.id)}`, integration.id)}>Open mark sheet</Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
