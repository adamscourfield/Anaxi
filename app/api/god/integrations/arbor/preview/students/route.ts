import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/admin";
import { withApi } from "@/lib/apiRoute";
import { assertCsrfFromForm } from "@/lib/csrf";
import { decryptCredentials } from "@/lib/integrationSecrets";
import { ArborClient } from "@/lib/integrations/arbor/client";
import { routeArborStudentByAcademicLevel } from "@/lib/integrations/arbor/studentRouting";
import type { ArborCredentials } from "@/lib/integrations/arbor/types";
import { PLATFORM_TENANT_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const POST = withApi(async function POST(req: Request) {
  const actor = await requireSuperAdminUser();
  const form = await req.formData();
  try {
    await assertCsrfFromForm(form);
  } catch {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  const db = prisma as any;
  const integration = await db.sharedIntegration.findUnique({
    where: { provider: "ARBOR" },
    include: {
      schools: {
        where: { enabled: true },
        include: { tenant: { include: { tenantSettings: { select: { schoolType: true } } } } },
      },
    },
  });

  if (!integration?.credentialsCiphertext || integration.status !== "CONNECTED") {
    return NextResponse.redirect(new URL("/god/integrations/arbor?preview=not-connected", req.url));
  }

  try {
    const credentials = decryptCredentials<ArborCredentials>(integration.credentialsCiphertext);
    const students = await new ArborClient(credentials).listAllStudents();
    const destinations = new Set(
      integration.schools.map((school: { tenant: { tenantSettings: { schoolType: string } | null } }) =>
        school.tenant.tenantSettings?.schoolType
      )
    );
    const counts = { primary: 0, secondary: 0, skippedOffRoll: 0, needsReview: 0 };
    const unrecognisedLevels = new Map<string, number>();

    for (const student of students) {
      const destination = routeArborStudentByAcademicLevel(student.displayAcademicLevel?.displayName);
      if (destination === "SKIP_OFF_ROLL") {
        counts.skippedOffRoll++;
      } else if (destination === "REVIEW" || !destinations.has(destination)) {
        counts.needsReview++;
        const label = student.displayAcademicLevel?.displayName?.trim() || "No matching Anaxi school";
        unrecognisedLevels.set(label, (unrecognisedLevels.get(label) ?? 0) + 1);
      } else if (destination === "PRIMARY") {
        counts.primary++;
      } else {
        counts.secondary++;
      }
    }

    await db.auditLog.create({
      data: {
        tenantId: PLATFORM_TENANT_ID,
        actorUserId: actor.id,
        action: "integration.arbor.students_previewed",
        targetType: "SharedIntegration",
        targetId: integration.id,
        afterJson: { total: students.length, ...counts },
      },
    });

    const url = new URL("/god/integrations/arbor", req.url);
    url.searchParams.set("preview", "success");
    url.searchParams.set("total", String(students.length));
    url.searchParams.set("primary", String(counts.primary));
    url.searchParams.set("secondary", String(counts.secondary));
    url.searchParams.set("offRoll", String(counts.skippedOffRoll));
    url.searchParams.set("review", String(counts.needsReview));
    for (const [label, count] of [...unrecognisedLevels.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(0, 10)) {
      url.searchParams.append("unrecognised", `${label}: ${count}`);
    }
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/god/integrations/arbor?preview=failed", req.url));
  }
});
