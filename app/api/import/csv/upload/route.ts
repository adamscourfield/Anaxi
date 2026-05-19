import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { parseStudentsCsv, REQUIRED_FIELDS } from "@/modules/students/csv";
import { validateAgainstTemplate } from "@/modules/import/csv-templates";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const text = await file.text();
  const firstLine = text.split("\n")[0] ?? "";
  const headers = firstLine.split(",").map((h) => h.trim());

  const { valid, missingColumns } = validateAgainstTemplate(headers);

  // Use identity mapping (column name = field name) by default
  const mapping = Object.fromEntries(REQUIRED_FIELDS.map((f) => [f, f])) as Record<string, string>;
  const { parsed, errors, preview } = parseStudentsCsv(text, mapping);

  return NextResponse.json({
    success: valid,
    validation: { valid, missingColumns },
    mappingRequired: !valid,
    preview: preview.slice(0, 5),
    headers,
    rowCount: parsed.length,
    errors: errors.slice(0, 20),
  });
});
