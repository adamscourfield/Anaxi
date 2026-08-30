import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { withApi } from "@/lib/apiRoute";

export const GET = withApi(async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  if (!hasPermission(user.role, "students:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearGroup = String(searchParams.get("yearGroup") || "").trim();
  const subjects = String(searchParams.get("subjects") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const students = await (prisma as any).student.findMany({
    where: {
      tenantId: user.tenantId,
      status: "ACTIVE",
      ...(yearGroup ? { yearGroup } : {}),
    },
    select: { upn: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  const csvCell = (value: string) => `"${String(value).replaceAll('"', '""')}"`;

  // With subjects specified, generate a wide-format template -- one row per
  // student, one column per subject -- since that's what the parser already
  // treats as the default layout and it removes any ambiguity about where
  // per-subject grades go (no need to duplicate rows per subject).
  const lines = subjects.length > 0
    ? [
        ["UPN", "Name", ...subjects].map(csvCell).join(","),
        ...(students as Array<{ upn: string | null; fullName: string }>).map((student) =>
          [student.upn ?? "", student.fullName, ...subjects.map(() => "")].map(csvCell).join(",")
        ),
      ]
    : [
        ["UPN", "Name", "Subject", "Grade"].map(csvCell).join(","),
        ...(students as Array<{ upn: string | null; fullName: string }>).map((student) =>
          [student.upn ?? "", student.fullName, "", ""].map(csvCell).join(",")
        ),
      ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="assessment-template-prefilled.csv"',
    },
  });
});
