import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { runArborGraphqlQuery } from "@/lib/integrations/arbor/graphqlClient";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";

/** Read-only schema metadata; never returns pupil records or credentials. */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const integrations = await prisma.sharedIntegration.findMany({
    where: { provider: "ARBOR", status: "CONNECTED" },
    select: { id: true, credentialsCiphertext: true },
  });
  const results = [];
  for (const integration of integrations) {
    if (!integration.credentialsCiphertext) continue;
    const credentials = decryptCredentials<ArborCredentials>(integration.credentialsCiphertext);
    const schema = await runArborGraphqlQuery<{ __schema: { types: { name: string }[]; queryType: { fields: { name: string; args: { name: string }[] }[] } } }>(credentials,
      "{ __schema { types { name } queryType { fields { name args { name } } } } }");
    const names = schema.__schema.types.map(type => type.name).filter(name => ["AttendanceRollCallRecord", "AttendanceRollCall", "AttendanceMark"].includes(name));
    const fields: Record<string, unknown> = {};
    for (const name of names) {
      const data = await runArborGraphqlQuery<{ __type: unknown }>(credentials,
        `{ __type(name: ${JSON.stringify(name)}) { name fields { name type { name kind ofType { name kind ofType { name kind } } } } } }`);
      fields[name] = data.__type;
    }
    let accessResult: Record<string, unknown>;
    try {
      const access = await runArborGraphqlQuery<{ AttendanceRollCallRecord: { id: string }[] }>(credentials,
        "{ AttendanceRollCallRecord(page_size: 1, page_num: 0) { id recordDate student { id } attendanceRollCall { id code } attendanceMark { code isStatisticalPresent isStatisticalApprovedEducationalActivity isStatisticalPossibleAttendance isDefaultLate } minutesLate } }");
      const rollCalls = await runArborGraphqlQuery<{ AttendanceRollCall: { id: string; code: string; shortName: string }[] }>(credentials,
        "{ AttendanceRollCall(page_size: 10, page_num: 0) { id code shortName } }");
      accessResult = { rollCalls: rollCalls.AttendanceRollCall, statutoryReadConfirmed: Array.isArray(access.AttendanceRollCallRecord) };
    } catch (error) {
      accessResult = { statutoryReadConfirmed: false, error: error instanceof Error ? error.message : "Statutory attendance access check failed" };
    }
    results.push({ ...accessResult, connectionId: integration.id,
      queries: schema.__schema.queryType.fields.filter(field => ["AttendanceRollCallRecord", "AttendanceRollCall"].includes(field.name)), fields });
  }
  return NextResponse.json({ results });
}
