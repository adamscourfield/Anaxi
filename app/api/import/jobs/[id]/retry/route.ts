import { NextResponse } from "next/server";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const original = await (prisma as any).importJob.findFirst({
    where: { id: params.id, tenantId: user.tenantId },
  });
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (original.status !== "FAILED") {
    return NextResponse.json({ error: "Only failed jobs can be retried" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Automatic retry is not available because import files are not stored. Please re-upload your CSV file.",
    },
    { status: 400 }
  );
}
