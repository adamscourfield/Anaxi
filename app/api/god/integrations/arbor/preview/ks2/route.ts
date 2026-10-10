import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { runArborGraphqlQuery } from "@/lib/integrations/arbor/graphqlClient";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Read-only source discovery for the KS2 standardised-assessment importer. */
export async function GET(req: Request) {
  await requireSuperAdminUser();
  const integration = await prisma.sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") return NextResponse.json({ error: "Arbor is not connected" }, { status: 409 });
  const credentials = decryptCredentials<ArborCredentials>(integration.credentialsCiphertext);
  const data = await runArborGraphqlQuery<{ __schema: { types: Array<{ name: string; fields: unknown[] | null }> } }>(credentials, `{
    __schema { types { name fields { name type { name kind ofType { name kind ofType { name kind } } } args { name type { name kind ofType { name kind } } } } } }
  }`);
  return NextResponse.json({ sources: data.__schema.types.filter((type) => /StandardizedAssessment|^Grade$/.test(type.name)) });
}
