import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { parseStaffCsv } from "@/modules/staff-import/csv";
import { runStaffImport } from "@/modules/staff-import/importer";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request) {
  const user = await requireAdminUser();

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const text = await file.text();
  const { parsed, errors } = parseStaffCsv(text);

  const blockingErrors = errors.filter((e) => e.errorCode !== "MISSING_FULL_NAME");
  if (blockingErrors.length > 0 && parsed.length === 0) {
    return NextResponse.json(
      { error: "CSV has validation errors", errors: blockingErrors.slice(0, 20) },
      { status: 422 }
    );
  }

  const result = await runStaffImport(user.tenantId, user.id, file.name, parsed, errors);

  return NextResponse.json(result);
});
