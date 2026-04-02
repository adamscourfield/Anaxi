import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");
  if (!hasPermission(user.role, "students:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const yearGroup = String(searchParams.get("yearGroup") || "").trim();

  const students = await (prisma as any).student.findMany({
    where: {
      tenantId: user.tenantId,
      status: "ACTIVE",
      ...(yearGroup ? { yearGroup } : {}),
    },
    select: { upn: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  const lines = [
    "UPN,Name,Subject,Grade",
    ...(students as Array<{ upn: string | null; fullName: string }>)
      .map((student) => [student.upn ?? "", student.fullName, "", ""]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="assessment-template-prefilled.csv"',
    },
  });
}
