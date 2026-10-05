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
  const fingerprint = form.get("fingerprint");
  if (typeof section !== "string" || !SECTIONS.has(section)) {
    return NextResponse.json({ error: "Invalid Arbor section" }, { status: 400 });
  }
  if (typeof fingerprint !== "string" || !fingerprint || fingerprint.length > 500) {
    return NextResponse.json({ error: "Invalid alert acknowledgement" }, { status: 400 });
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findFirst({ where: arborConnectionWhere(req) });
  if (!integration) return NextResponse.json({ error: "Arbor connection not found" }, { status: 404 });
  const config = integration.config && typeof integration.config === "object" ? integration.config : {};
  const acknowledgedAttention = config.acknowledgedAttention && typeof config.acknowledgedAttention === "object" ? config.acknowledgedAttention : {};
  await db.sharedIntegration.update({
    where: { id: integration.id },
    // Keep the source alert intact. Its fingerprint changes on a new check or
    // sync failure, which makes the next issue visible without losing history.
    data: { config: { ...config, acknowledgedAttention: { ...acknowledgedAttention, [section]: fingerprint } } },
  });
  return NextResponse.json({ acknowledged: true });
});
