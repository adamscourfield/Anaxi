import { NextResponse } from "next/server";
import { generateCSVTemplate } from "@/modules/import/csv-templates";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");
  if (!hasPermission(user.role, "students:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const prefill = searchParams.get("prefill") === "1";

  const csv = generateCSVTemplate();
  if (!prefill) {
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="student-snapshot-template.csv"',
      },
    });
  }

  const students = await (prisma as any).student.findMany({
    where: { tenantId: user.tenantId, status: "ACTIVE" },
    select: {
      upn: true,
      fullName: true,
      yearGroup: true,
      ks2ReadingScaledScore: true,
      ks2MathsScaledScore: true,
      sendFlag: true,
      ppFlag: true,
    },
    orderBy: { fullName: "asc" },
  });

  const lines = [
    "UPN,Name,YearGroup,KS2ReadingScaledScore,KS2MathsScaledScore,PositivePointsTotal,Detentions,InternalExclusions,Suspensions,Attendance,Lateness,SEND,PP,Status",
    ...(students as Array<{
      upn: string | null;
      fullName: string;
      yearGroup: string | null;
      ks2ReadingScaledScore: number | null;
      ks2MathsScaledScore: number | null;
      sendFlag: boolean;
      ppFlag: boolean;
    }>)
      .map((student) =>
        [
          student.upn ?? "",
          student.fullName,
          student.yearGroup ?? "",
          student.ks2ReadingScaledScore ?? "",
          student.ks2MathsScaledScore ?? "",
          "0",
          "0",
          "0",
          "0",
          "",
          "0",
          student.sendFlag ? "Yes" : "No",
          student.ppFlag ? "Yes" : "No",
          "ACTIVE",
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="student-snapshot-template-prefilled.csv"',
    },
  });
}
