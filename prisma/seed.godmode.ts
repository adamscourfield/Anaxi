/**
 * Production setup script for god mode account and initial schools.
 *
 * Creates:
 *   - A platform tenant (tenant_anaxi_platform) to house god mode users
 *   - SUPER_ADMIN user: hi@anaxi.io
 *   - Goresbrook Secondary school (tenant_goresbrook_secondary)
 *   - Goresbrook Primary school (tenant_goresbrook_primary)
 *
 * Usage:
 *   GODMODE_PASSWORD=<password> tsx prisma/seed.godmode.ts
 *
 * If GODMODE_PASSWORD is not set, defaults to "ChangeMe123!" — change it
 * immediately after first login.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SIGNAL_DEFINITIONS } from "../modules/observations/signalDefinitions";
import { PRIMARY_SIGNAL_DEFINITIONS } from "../modules/observations/signalDefinitionsPrimary";

const prisma = new PrismaClient();

const ALL_FEATURES = [
  "OBSERVATIONS", "SIGNALS", "STUDENTS", "STUDENTS_IMPORT", "BEHAVIOUR_IMPORT",
  "LEAVE", "LEAVE_OF_ABSENCE", "ON_CALL", "MEETINGS", "TIMETABLE", "ADMIN",
  "ADMIN_SETTINGS", "ANALYSIS", "ASSESSMENTS",
] as const;

const VOCAB_ROWS = [
  ["positive_points", "Positive Point", "Positive Points"],
  ["detentions", "Detention", "Detentions"],
  ["internal_exclusions", "Internal Exclusion", "Internal Exclusions"],
  ["on_calls", "On Call", "On Calls"],
  ["suspensions", "Suspension", "Suspensions"],
] as const;

async function seedSchool(
  tenantId: string,
  tenantName: string,
  slug: string,
  schoolType: "PRIMARY" | "SECONDARY",
) {
  console.log(`  → Creating school: ${tenantName}`);

  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: { name: tenantName, slug, status: "ACTIVE" },
    create: { id: tenantId, name: tenantName, slug, status: "ACTIVE" },
  });

  await (prisma as any).tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: { schoolName: tenantName, schoolType },
    create: { tenantId: tenant.id, schoolName: tenantName, schoolType },
  });

  for (const key of ALL_FEATURES) {
    await (prisma as any).tenantFeature.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { enabled: true },
      create: { tenantId: tenant.id, key, enabled: true },
    });
  }

  for (const [key, singular, plural] of VOCAB_ROWS) {
    await (prisma as any).tenantVocab.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { labelSingular: singular, labelPlural: plural },
      create: { tenantId: tenant.id, key, labelSingular: singular, labelPlural: plural },
    });
  }

  for (const label of ["Sick Leave", "Personal Leave", "Training"]) {
    await (prisma as any).loaReason.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label } },
      update: {},
      create: { tenantId: tenant.id, label },
    });
  }

  for (const name of ["Behaviour disruption", "Safeguarding", "Urgent support"]) {
    await (prisma as any).onCallReason.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label: name } },
      update: {},
      create: { tenantId: tenant.id, label: name },
    });
  }

  for (const name of ["Hallway", "Playground", "Canteen"]) {
    await (prisma as any).onCallLocation.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label: name } },
      update: {},
      create: { tenantId: tenant.id, label: name },
    });
  }

  const signalDefs =
    schoolType === "PRIMARY"
      ? [...SIGNAL_DEFINITIONS, ...PRIMARY_SIGNAL_DEFINITIONS]
      : SIGNAL_DEFINITIONS;

  const seenKeys = new Set<string>();
  for (const signal of signalDefs) {
    if (seenKeys.has(signal.key)) continue;
    seenKeys.add(signal.key);
    await (prisma as any).tenantSignalLabel.upsert({
      where: { tenantId_signalKey: { tenantId: tenant.id, signalKey: signal.key } },
      update: { displayName: signal.displayNameDefault, description: signal.descriptionDefault },
      create: {
        tenantId: tenant.id,
        signalKey: signal.key,
        displayName: signal.displayNameDefault,
        description: signal.descriptionDefault,
      },
    });
  }

  return tenant;
}

async function main() {
  const godPassword = process.env.GODMODE_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(godPassword, 10);

  // ── Platform tenant (home for god mode users) ─────────────────────────────
  console.log("  → Creating platform tenant");
  const platformTenant = await prisma.tenant.upsert({
    where: { id: "tenant_anaxi_platform" },
    update: { name: "Anaxi Platform", slug: "anaxi-platform", status: "ACTIVE" },
    create: { id: "tenant_anaxi_platform", name: "Anaxi Platform", slug: "anaxi-platform", status: "ACTIVE" },
  });

  // ── God mode account ───────────────────────────────────────────────────────
  console.log("  → Creating god mode user: hi@anaxi.io");
  await (prisma as any).user.upsert({
    where: { tenantId_email: { tenantId: platformTenant.id, email: "hi@anaxi.io" } },
    update: { fullName: "Anaxi Admin", role: "SUPER_ADMIN", isActive: true, passwordHash },
    create: {
      tenantId: platformTenant.id,
      email: "hi@anaxi.io",
      fullName: "Anaxi Admin",
      role: "SUPER_ADMIN",
      isActive: true,
      passwordHash,
    },
  });

  // ── Schools ────────────────────────────────────────────────────────────────
  await seedSchool(
    "tenant_goresbrook_secondary",
    "Goresbrook Secondary",
    "goresbrook-secondary",
    "SECONDARY",
  );

  await seedSchool(
    "tenant_goresbrook_primary",
    "Goresbrook Primary",
    "goresbrook-primary",
    "PRIMARY",
  );

  const usingDefault = !process.env.GODMODE_PASSWORD;
  console.log("\n✓ Setup complete.");
  console.log("  God mode login: hi@anaxi.io");
  if (usingDefault) {
    console.log("  Password:       ChangeMe123!  ← CHANGE THIS after first login");
  } else {
    console.log("  Password:       (set via GODMODE_PASSWORD)");
  }
  console.log("  Schools:        Goresbrook Secondary, Goresbrook Primary");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
