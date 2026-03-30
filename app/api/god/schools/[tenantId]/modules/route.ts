import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminUser } from "@/lib/admin";

const ALLOWED_MODULES = new Set([
  "OBSERVATIONS",
  "SIGNALS",
  "STUDENTS",
  "STUDENTS_IMPORT",
  "BEHAVIOUR_IMPORT",
  "LEAVE",
  "ON_CALL",
  "MEETINGS",
  "TIMETABLE",
  "ADMIN",
  "ADMIN_SETTINGS",
  "ANALYSIS",
  "STUDENT_ANALYSIS",
  "ASSESSMENTS",
]);

export async function POST(req: Request, { params }: { params: { tenantId: string } }) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  const enabledModules = new Set(
    form
      .getAll("modules")
      .map((v) => String(v))
      .filter((m) => ALLOWED_MODULES.has(m))
  );

  const tenant = await prisma.tenant.findUnique({ where: { id: params.tenantId } });
  if (!tenant) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const existing = await prisma.tenantFeature.findMany({ where: { tenantId: params.tenantId } });

  const upserts = Array.from(enabledModules).map((key) =>
    prisma.tenantFeature.upsert({
      where: { tenantId_key: { tenantId: params.tenantId, key } },
      update: { enabled: true },
      create: { tenantId: params.tenantId, key, enabled: true },
    })
  );

  const disable = existing
    .filter((f) => !enabledModules.has(f.key))
    .map((f) => prisma.tenantFeature.update({ where: { id: f.id }, data: { enabled: false } }));

  await prisma.$transaction([...upserts, ...disable]);

  await (prisma as any).auditLog.create({
    data: {
      tenantId: params.tenantId,
      actorUserId: actor.id,
      action: "school.modules.update",
      targetType: "Tenant",
      targetId: params.tenantId,
      beforeJson: { enabled: existing.filter((f) => f.enabled).map((f) => f.key) },
      afterJson: { enabled: Array.from(enabledModules) },
    },
  });

  return NextResponse.redirect(new URL(`/god/schools/${params.tenantId}`, req.url));
}
