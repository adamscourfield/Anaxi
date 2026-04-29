import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

/** CSV export of staff and departments for the Institutional Dashboard “Export ledger” action. */
export async function GET() {
  try {
    const admin = await requireAdminUser();

    const [users, departments] = await Promise.all([
      (prisma as any).user.findMany({
        where: { tenantId: admin.tenantId },
        orderBy: { fullName: "asc" },
        select: { fullName: true, email: true, role: true, isActive: true },
      }),
      (prisma as any).department.findMany({
        where: { tenantId: admin.tenantId },
        orderBy: { name: "asc" },
        include: {
          memberships: {
            include: { user: { select: { fullName: true } } },
          },
        },
      }),
    ]);

    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

    const rows: string[] = [
      [
        "Record type",
        "Name / Department",
        "Email / Faculty",
        "Role / HOD",
        "Status / Member count",
        "Department members",
      ]
        .map((h) => esc(h))
        .join(","),
    ];

    for (const u of users as any[]) {
      rows.push(
        ["Staff", u.fullName, u.email, u.role, u.isActive ? "active" : "inactive", ""]
          .map((c) => esc(String(c)))
          .join(","),
      );
    }

    for (const d of departments as any[]) {
      const hod = (d.memberships as any[]).find((m: any) => m.isHeadOfDepartment);
      const names = (d.memberships as any[]).map((m: any) => m.user.fullName).join("; ");
      rows.push(
        [
          "Department",
          d.name,
          d.faculty ?? "",
          hod?.user?.fullName ?? "",
          String(d.memberships.length),
          names,
        ]
          .map((c) => esc(String(c)))
          .join(","),
      );
    }

    const csv = rows.join("\n");
    const filename = `institutional-ledger_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "UNAUTHENTICATED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
