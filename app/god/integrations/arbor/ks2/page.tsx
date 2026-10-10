import { requireSuperAdminUser } from "@/lib/admin";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { runArborGraphqlQuery } from "@/lib/integrations/arbor/graphqlClient";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

type TypeRef = { name: string | null; kind: string; ofType?: TypeRef | null };
type Field = { name: string; type: TypeRef };
type Source = { name: string; fields: Field[] | null };
function unwrap(type: TypeRef): TypeRef { return type.ofType ? unwrap(type.ofType) : type; }
export const dynamic = "force-dynamic";
export default async function Ks2SourcePage({ searchParams }: { searchParams: Promise<{ connectionId?: string }> }) {
  await requireSuperAdminUser();
  const { connectionId } = await searchParams;
  const integration = await prisma.sharedIntegration.findFirst({ where: { provider: "ARBOR", ...(connectionId ? { id: connectionId } : {}) } });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return <p>Arbor is not connected.</p>;
  const credentials = decryptCredentials<ArborCredentials>(integration.credentialsCiphertext);
  const data = await runArborGraphqlQuery<{ __schema: { types: Source[]; queryType: { fields: Array<{ name: string }> } } }>(credentials, `{
    __schema { queryType { fields { name } } types { name fields { name type { name kind ofType { name kind ofType { name kind } } } } } }
  }`);
  const sources = data.__schema.types.filter((type) => /StandardizedAssessment|^Grade$/.test(type.name));
  const samples: Record<string, unknown> = {};
  for (const source of sources) {
    if (!data.__schema.queryType.fields.some((field) => field.name === source.name)) continue;
    const selection = (source.fields ?? []).flatMap((field) => {
      const type = unwrap(field.type);
      if (type.kind === "SCALAR" || type.kind === "ENUM") return [field.name];
      const related = data.__schema.types.find((candidate) => candidate.name === type.name);
      const childFields = (related?.fields ?? []).filter((child) => /^(id|displayName|name|assessmentName|assessmentShortName|code|value|numericValue)$/.test(child.name) && ["SCALAR", "ENUM"].includes(unwrap(child.type).kind)).map((child) => child.name);
      return childFields.length && field.type.kind !== "LIST" ? [`${field.name} { ${childFields.join(" ")} }`] : [];
    }).join(" ");
    if (!selection) continue;
    try { samples[source.name] = await runArborGraphqlQuery(credentials, `{ ${source.name}(page_size: 3, page_num: 0) { ${selection} } }`); }
    catch (error) { samples[source.name] = error instanceof Error ? error.message : "Source unavailable"; }
  }
  return <main className="p-8"><h1>KS2 source discovery</h1><p>Read-only Arbor schema and source samples. No student records have been changed.</p><pre className="mt-6 whitespace-pre-wrap text-sm">{JSON.stringify({ sources, samples }, null, 2)}</pre></main>;
}
