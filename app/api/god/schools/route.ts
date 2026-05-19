import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminUser } from "@/lib/admin";
import { assertCsrfFromForm } from "@/lib/csrf";
import { withApi } from "@/lib/apiRoute";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export const GET = withApi(async function GET() {
  await requireSuperAdminUser();
  const schools = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
  });
  return NextResponse.json({ schools });
});

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const name = String(form.get("name") ?? "").trim();
  const slugInput = String(form.get("slug") ?? "").trim();
  const adminName = String(form.get("adminName") ?? "").trim();
  const adminEmail = String(form.get("adminEmail") ?? "").trim().toLowerCase();
  const temporaryPassword = String(form.get("temporaryPassword") ?? "ChangeMe123!");
  const modules = form.getAll("modules").map((v) => String(v));

  if (!name || !adminName || !adminEmail) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const slugBase = slugify(slugInput || name);

  const slugTaken = await prisma.tenant.findUnique({ where: { slug: slugBase } });
  if (slugTaken) {
    return NextResponse.json({ error: "School slug already exists" }, { status: 409 });
  }

  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug: slugBase,
      status: "ACTIVE",
    },
  });

  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: adminEmail,
      fullName: adminName,
      role: "ADMIN",
      isActive: true,
      passwordHash,
      canApproveAllLoa: true,
    },
  });

  if (modules.length > 0) {
    await prisma.tenantFeature.createMany({
      data: modules.map((key) => ({ tenantId: tenant.id, key, enabled: true })),
      skipDuplicates: true,
    });
  }

  await (prisma as any).auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: actor.id,
      action: "school.create",
      targetType: "Tenant",
      targetId: tenant.id,
      afterJson: {
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status },
        admin: { id: adminUser.id, email: adminUser.email, role: adminUser.role },
        modules,
      },
    },
  });

  return NextResponse.redirect(new URL(`/god/schools/${tenant.id}`, req.url));
});
