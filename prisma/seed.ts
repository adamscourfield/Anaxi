import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SIGNAL_DEFINITIONS } from "../modules/observations/signalDefinitions";
import { seedDemo } from "./seed.demo";

const prisma = new PrismaClient();
const FEATURES = [
  "OBSERVATIONS", "SIGNALS", "STUDENTS", "STUDENTS_IMPORT", "BEHAVIOUR_IMPORT",
  "LEAVE", "LEAVE_OF_ABSENCE", "ON_CALL", "MEETINGS", "TIMETABLE", "ADMIN", "ADMIN_SETTINGS",
  "ANALYSIS", "ASSESSMENTS"
] as const;

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: "tenant_demo" },
    update: { name: "Demo School", slug: "demo-school", status: "ACTIVE" },
    create: { id: "tenant_demo", name: "Demo School", slug: "demo-school", status: "ACTIVE" }
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const adminUser = await (prisma as any).user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@demo.school" } },
    update: { fullName: "Admin User", role: "ADMIN", isActive: true, canApproveAllLoa: true, receivesOnCallEmails: true, passwordHash },
    create: { tenantId: tenant.id, email: "admin@demo.school", fullName: "Admin User", role: "ADMIN", isActive: true, canApproveAllLoa: true, receivesOnCallEmails: true, passwordHash }
  });

  await (prisma as any).user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "god@anaxi.local" } },
    update: { fullName: "Platform Super Admin", role: "SUPER_ADMIN", isActive: true, passwordHash },
    create: { tenantId: tenant.id, email: "god@anaxi.local", fullName: "Platform Super Admin", role: "SUPER_ADMIN", isActive: true, passwordHash },
  });

  // Demo teachers for analysis
  const demoTeachers = [
    { email: "alice@demo.school", fullName: "Alice Thornton", role: "TEACHER" },
    { email: "ben@demo.school", fullName: "Ben Okafor", role: "TEACHER" },
    { email: "chloe@demo.school", fullName: "Chloe Davies", role: "TEACHER" },
  ];
  const teacherRecords: Record<string, any> = {};
  for (const t of demoTeachers) {
    teacherRecords[t.email] = await (prisma as any).user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: t.email } },
      update: { fullName: t.fullName, role: t.role, isActive: true, passwordHash },
      create: { tenantId: tenant.id, email: t.email, fullName: t.fullName, role: t.role, isActive: true, passwordHash }
    });
  }

  for (const key of FEATURES) {
    await (prisma as any).tenantFeature.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { enabled: true },
      create: { tenantId: tenant.id, key, enabled: true }
    });
  }

  const vocabRows = [
    ["positive_points", "Positive Point", "Positive Points"],
    ["detentions", "Detention", "Detentions"],
    ["internal_exclusions", "Internal Exclusion", "Internal Exclusions"],
    ["on_calls", "On Call", "On Calls"],
    ["suspensions", "Suspension", "Suspensions"]
  ] as const;

  for (const [key, singular, plural] of vocabRows) {
    await (prisma as any).tenantVocab.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { labelSingular: singular, labelPlural: plural },
      create: { tenantId: tenant.id, key, labelSingular: singular, labelPlural: plural }
    });
  }

  for (const label of ["Sick Leave", "Personal Leave", "Training"]) {
    await (prisma as any).loaReason.upsert({ where: { tenantId_label: { tenantId: tenant.id, label } }, update: {}, create: { tenantId: tenant.id, label } });
  }
  await (prisma as any).lOAAuthoriser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: adminUser.id } },
    update: {},
    create: { tenantId: tenant.id, userId: adminUser.id }
  });
  for (const name of ["Behaviour disruption", "Safeguarding", "Urgent support"]) {
    await (prisma as any).onCallReason.upsert({ where: { tenantId_label: { tenantId: tenant.id, label: name } }, update: {}, create: { tenantId: tenant.id, label: name } });
  }
  for (const name of ["Hallway", "Playground", "Canteen"]) {
    await (prisma as any).onCallLocation.upsert({ where: { tenantId_label: { tenantId: tenant.id, label: name } }, update: {}, create: { tenantId: tenant.id, label: name } });
  }
  for (const email of ["oncall@demo.school", "pastoral@demo.school"]) {
    await (prisma as any).onCallRecipient.upsert({ where: { tenantId_email: { tenantId: tenant.id, email } }, update: {}, create: { tenantId: tenant.id, email } });
  }

  for (const signal of SIGNAL_DEFINITIONS) {
    await (prisma as any).tenantSignalLabel.upsert({
      where: { tenantId_signalKey: { tenantId: tenant.id, signalKey: signal.key } },
      update: { displayName: signal.displayNameDefault, description: signal.descriptionDefault },
      create: { tenantId: tenant.id, signalKey: signal.key, displayName: signal.displayNameDefault, description: signal.descriptionDefault }
    });
  }

  // ─── Demo observations for Teacher Risk Index ─────────────────────────────
  // Seed observations so the Analysis page is populated in the demo environment.
  // Alice: stable (all CONSISTENT in both windows)
  // Ben: emerging drift (slight drop on 3 signals)
  // Chloe: low coverage (only 2 observations in current window)

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  // Helper to build signal data for an observation
  const allSignalKeys = SIGNAL_DEFINITIONS.map((s) => s.key);
  const makeSignals = (overrides: Partial<Record<string, string>> = {}) =>
    allSignalKeys.map((k) => ({ signalKey: k, valueKey: overrides[k] ?? "CONSISTENT", notObserved: false }));

  const aliceId = teacherRecords["alice@demo.school"].id;
  const benId = teacherRecords["ben@demo.school"].id;
  const chloeId = teacherRecords["chloe@demo.school"].id;

  // Alice — 7 current + 7 prev, all CONSISTENT → STABLE
  for (let i = 0; i < 7; i++) {
    await (prisma as any).observation.create({
      data: {
        tenantId: tenant.id, observedTeacherId: aliceId, observerId: adminUser.id,
        observedAt: daysAgo(i + 1), yearGroup: "Y10", subject: "Maths", phase: "INSTRUCTION",
        signals: { createMany: { data: makeSignals() } }
      }
    });
  }
  for (let i = 0; i < 7; i++) {
    await (prisma as any).observation.create({
      data: {
        tenantId: tenant.id, observedTeacherId: aliceId, observerId: adminUser.id,
        observedAt: daysAgo(22 + i), yearGroup: "Y10", subject: "Maths", phase: "INSTRUCTION",
        signals: { createMany: { data: makeSignals() } }
      }
    });
  }

  // Ben — 7 current (some LIMITED on key signals) + 7 prev (CONSISTENT) → EMERGING_DRIFT
  for (let i = 0; i < 7; i++) {
    await (prisma as any).observation.create({
      data: {
        tenantId: tenant.id, observedTeacherId: benId, observerId: adminUser.id,
        observedAt: daysAgo(i + 1), yearGroup: "Y9", subject: "English", phase: "GUIDED_PRACTICE",
        signals: {
          createMany: {
            data: makeSignals({
              BEHAVIOUR_CLIMATE: i < 4 ? "SOME" : "CONSISTENT",
              CFU_CYCLES: i < 4 ? "LIMITED" : "SOME",
              PARTICIPATION_EQUITY: i < 3 ? "LIMITED" : "SOME",
            })
          }
        }
      }
    });
  }
  for (let i = 0; i < 7; i++) {
    await (prisma as any).observation.create({
      data: {
        tenantId: tenant.id, observedTeacherId: benId, observerId: adminUser.id,
        observedAt: daysAgo(22 + i), yearGroup: "Y9", subject: "English", phase: "GUIDED_PRACTICE",
        signals: { createMany: { data: makeSignals() } }
      }
    });
  }

  // Chloe — only 2 observations → LOW_COVERAGE
  for (let i = 0; i < 2; i++) {
    await (prisma as any).observation.create({
      data: {
        tenantId: tenant.id, observedTeacherId: chloeId, observerId: adminUser.id,
        observedAt: daysAgo(i + 3), yearGroup: "Y8", subject: "Science", phase: "UNKNOWN",
        signals: { createMany: { data: makeSignals() } }
      }
    });
  }
  // ─── Demo student snapshots for Student Risk Index ───────────────────────
  // Seed students + snapshots for the SRI demo.
  // Jamie: URGENT (on calls spike + attendance drop + detentions up)
  // Priya: PRIORITY (detentions + lateness increase)
  // Lucas: WATCH (small attendance drop)
  // Ella: STABLE (minimal changes)

  const demoStudents = [
    { upn: "S001", fullName: "Jamie Reynolds", yearGroup: "Y10", sendFlag: true, ppFlag: false },
    { upn: "S002", fullName: "Priya Sharma", yearGroup: "Y9", sendFlag: false, ppFlag: true },
    { upn: "S003", fullName: "Lucas Green", yearGroup: "Y8", sendFlag: false, ppFlag: false },
    { upn: "S004", fullName: "Ella Morgan", yearGroup: "Y10", sendFlag: false, ppFlag: false },
  ];

  const studentRecords: Record<string, any> = {};
  for (const s of demoStudents) {
    studentRecords[s.upn] = await (prisma as any).student.upsert({
      where: { tenantId_upn: { tenantId: tenant.id, upn: s.upn } },
      update: { fullName: s.fullName, yearGroup: s.yearGroup, sendFlag: s.sendFlag, ppFlag: s.ppFlag },
      create: { tenantId: tenant.id, ...s, status: "ACTIVE" }
    });
  }

  // Helper: upsert a snapshot
  async function upsertSnapshot(studentId: string, date: Date, data: {
    attendancePct: number;
    detentionsCount: number;
    onCallsCount: number;
    latenessCount: number;
    internalExclusionsCount: number;
    suspensionsCount: number;
    positivePointsTotal: number;
  }) {
    // Use ISO date portion as the snapshotDate for uniqueness
    const snapshotDate = new Date(date.toISOString().slice(0, 10) + "T00:00:00.000Z");
    await (prisma as any).studentSnapshot.upsert({
      where: { tenantId_studentId_snapshotDate: { tenantId: tenant.id, studentId, snapshotDate } },
      update: data,
      create: { tenantId: tenant.id, studentId, snapshotDate, countScope: "TERM_TO_DATE", ...data }
    });
  }

  const jamieId = studentRecords["S001"].id;
  const priyaId = studentRecords["S002"].id;
  const lucasId = studentRecords["S003"].id;
  const ellaId = studentRecords["S004"].id;

  // Jamie — URGENT: attendance drops 8pp, on-calls +3, detentions +6
  await upsertSnapshot(jamieId, daysAgo(5), {
    attendancePct: 74, detentionsCount: 12, onCallsCount: 5, latenessCount: 8,
    internalExclusionsCount: 1, suspensionsCount: 0, positivePointsTotal: 3
  });
  await upsertSnapshot(jamieId, daysAgo(26), {
    attendancePct: 82, detentionsCount: 6, onCallsCount: 2, latenessCount: 5,
    internalExclusionsCount: 0, suspensionsCount: 0, positivePointsTotal: 8
  });

  // Priya — PRIORITY: detentions +4, lateness +4
  await upsertSnapshot(priyaId, daysAgo(4), {
    attendancePct: 91, detentionsCount: 7, onCallsCount: 1, latenessCount: 6,
    internalExclusionsCount: 0, suspensionsCount: 0, positivePointsTotal: 12
  });
  await upsertSnapshot(priyaId, daysAgo(25), {
    attendancePct: 93, detentionsCount: 3, onCallsCount: 0, latenessCount: 2,
    internalExclusionsCount: 0, suspensionsCount: 0, positivePointsTotal: 18
  });

  // Lucas — WATCH: attendance drops 2pp
  await upsertSnapshot(lucasId, daysAgo(6), {
    attendancePct: 87, detentionsCount: 2, onCallsCount: 0, latenessCount: 2,
    internalExclusionsCount: 0, suspensionsCount: 0, positivePointsTotal: 15
  });
  await upsertSnapshot(lucasId, daysAgo(27), {
    attendancePct: 89, detentionsCount: 1, onCallsCount: 0, latenessCount: 1,
    internalExclusionsCount: 0, suspensionsCount: 0, positivePointsTotal: 20
  });

  // Ella — STABLE: no significant changes
  await upsertSnapshot(ellaId, daysAgo(3), {
    attendancePct: 96, detentionsCount: 1, onCallsCount: 0, latenessCount: 0,
    internalExclusionsCount: 0, suspensionsCount: 0, positivePointsTotal: 25
  });
  await upsertSnapshot(ellaId, daysAgo(24), {
    attendancePct: 97, detentionsCount: 1, onCallsCount: 0, latenessCount: 0,
    internalExclusionsCount: 0, suspensionsCount: 0, positivePointsTotal: 22
  });
}

main()
  .then(async () => {
    // When prisma db seed is run in a non-production env, also seed the demo tenant.
    if (process.env.NODE_ENV !== "production" && process.env.DEMO_SEED === "true") {
      await seedDemo(prisma);
    }
  })
  .finally(async () => prisma.$disconnect());
