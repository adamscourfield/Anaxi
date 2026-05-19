import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { parseStaffCsv } from "@/modules/staff-import/csv";
import { withApi } from "@/lib/apiRoute";

export const POST = withApi(async function POST(req: Request) {
  await requireAdminUser();

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const text = await file.text();
  const firstLine = text.split("\n")[0] ?? "";
  const headers = firstLine.split(",").map((h) => h.trim());

  const { parsed, errors, preview } = parseStaffCsv(text);

  return NextResponse.json({
    headers,
    rowCount: parsed.length,
    preview,
    errors: errors.slice(0, 20),
    valid: errors.filter((e) => e.errorCode !== "MISSING_FULL_NAME").length === 0,
  });
});
