import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { parseStudentsCsv } from "@/modules/students/csv";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { csv, mapping } = body as { csv: string; mapping: Record<string, string> };
  if (!csv || !mapping) return NextResponse.json({ error: "csv and mapping required" }, { status: 400 });

  const { parsed, errors } = parseStudentsCsv(csv, mapping);

  return NextResponse.json({
    valid: errors.length === 0,
    rowsToProcess: parsed.length,
    errors,
    warnings: [],
  });
});
