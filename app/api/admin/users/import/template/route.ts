import { NextResponse } from "next/server";
import { generateStaffCSVTemplate } from "@/modules/staff-import/csv";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET() {
  const csv = generateStaffCSVTemplate();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="staff-import-template.csv"',
    },
  });
});
