import { NextResponse } from "next/server";
import { arborConnectionWhere } from "@/lib/integrations/arbor/connectionScope";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

const SECTIONS = new Set(["connection", "photos", "timetable", "people", "behaviour", "attendance", "leave", "assessments"]);

/** Records that a God Mode administrator has seen an Arbor section's alert. */
export const POST = withApi(async function POST(req: Request) {
  await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  const section = form.get("section");
  if (typeof section !== "string" || !SECTIONS.has(section)) {
    return NextResponse.json({ error: "Invalid Arbor section" }, { status: 400 });
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration) return NextResponse.json({ error: "Arbor connection not found" }, { status: 404 });
  const config = integration.config && typeof integration.config === "object" ? integration.config : {};
  const attention = config.attention && typeof config.attention === "object" ? config.attention : {};
  await db.sharedIntegration.update({
    where: { id: integration.id },
    data: { config: { ...config, attention: { ...attention, [section]: null } } },
  });
  return NextResponse.json({ acknowledged: true });
});
