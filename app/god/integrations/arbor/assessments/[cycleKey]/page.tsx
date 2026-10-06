import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdminUser } from "@/lib/admin";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { arborAssessmentLabel, mapArborAssessment, mapArborAssessmentForYearGroup } from "@/lib/integrations/arbor/assessmentPolicy";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
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

function assessmentYearRange(academicYear: string): { from: string; before: string } | undefined {
  const match = academicYear.match(/^(20\d{2})\/(20\d{2})$/);
  if (!match) return undefined;
  return { from: `${match[1]}-09-01`, before: `${match[2]}-09-01` };
}

function gradeValue(mark: { displayName: string | null; grade: { displayName: string | null; shortName: string | null; code: string | null } | null }): string {
  return [mark.grade?.displayName, mark.grade?.shortName, mark.grade?.code, mark.displayName].find((value): value is string => Boolean(value?.trim())) ?? "No recorded grade";
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
  const [marks, students] = await Promise.all([
    new ArborClient(decryptCredentials<ArborCredentials>(integration.credentialsCiphertext)).listAssessmentMarks(100, 0, matchingDefinitions.slice(0, 20).map((definition) => definition.id), assessmentYearRange(cycle.academicYear)),
    db.student.findMany({ where: { externalId: { not: null } }, select: { externalId: true, fullName: true, yearGroup: true } }),
  ]);
  const studentsByExternalId = new Map<string, { externalId: string; fullName: string; yearGroup: string | null }>(
    (students as Array<{ externalId: string; fullName: string; yearGroup: string | null }>).map((student) => [student.externalId, student]),
  );
  const visibleMarks = marks
    .filter((mark) => mapArborAssessmentForYearGroup(mapArborAssessment(arborAssessmentLabel(mark.assessment ?? { displayName: null, assessmentName: null, assessmentShortName: null }), mark.assessmentDate, mark.displayName) ?? firstMapping, yearGroup)?.cycleExternalId === cycleKey)
    .slice(0, 50);
  const linkedMarks = visibleMarks.filter((mark) => studentsByExternalId.has(mark.student.id)).length;

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

      <Card className="grid gap-4 sm:grid-cols-3">
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Grade format</div><div className="mt-1 font-semibold">{cycle.gradeFormat === "PERCENTAGE" ? "Percentage" : cycle.gradeFormat === "A_LEVEL" ? "A-Level" : "GCSE"}</div></div>
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Arbor definitions</div><div className="mt-1 font-semibold">{matchingDefinitions.length}</div></div>
        <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Linked in this sample</div><div className="mt-1 font-semibold">{linkedMarks} of {visibleMarks.length}</div></div>
      </Card>

      <Card className="space-y-3">
        <H3>Included Arbor assessments</H3>
        <div className="divide-y divide-border/70 rounded-sm border border-border/70">
          {matchingDefinitions.map((definition) => <div key={definition.id} className="px-4 py-3 text-sm">{definition.label}</div>)}
        </div>
      </Card>

      <Card className="space-y-3">
        <div>
          <H3>Recorded marks</H3>
          <MetaText className="mt-1">Showing up to 50 of the first 100 Arbor marks across this cycle&apos;s definitions. This review is deliberately read-only.</MetaText>
        </div>
        {visibleMarks.length ? (
          <div className="overflow-x-auto rounded-sm border border-border/70">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <thead className="bg-[var(--surface-container-low)] text-xs uppercase tracking-[0.1em] text-muted"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Result</th></tr></thead>
              <tbody className="divide-y divide-border/70">
                {visibleMarks.map((mark) => {
                  const student = studentsByExternalId.get(mark.student.id);
                  return <tr key={mark.id}><td className="px-4 py-3 font-medium">{student?.fullName ?? "Not linked to Anaxi"}</td><td className="px-4 py-3">{arborAssessmentLabel(mark.assessment ?? { displayName: null, assessmentName: null, assessmentShortName: null })}</td><td className="px-4 py-3">{mark.assessmentDate ? new Date(mark.assessmentDate).toLocaleDateString("en-GB") : "Not supplied"}</td><td className="px-4 py-3 font-semibold">{gradeValue(mark)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        ) : <MetaText>No marks were returned in the first Arbor sample for this proposed cycle.</MetaText>}
      </Card>
    </div>
  );
}
