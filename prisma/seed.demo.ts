/**
 * prisma/seed.demo.ts
 *
 * Deterministic demo seed for "Demo Academy".
 * Produces a full dataset so every Anaxi feature can be exercised locally.
 *
 * Safety gates:
 *   - Refuses to run when NODE_ENV === "production"
 *   - Refuses to run unless DATABASE_URL includes "localhost"/"127.0.0.1"
 *     OR env var ALLOW_DEMO_SEED=true is set
 *
 * Usage:
 *   npm run seed:demo          — always deletes + recreates demo tenant
 *   npm run seed:demo:reset    — same, with an explicit reset confirmation log
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SIGNAL_DEFINITIONS } from "../modules/observations/signalDefinitions";

// ─── Safety Gates ─────────────────────────────────────────────────────────────

function assertSafe() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Demo seed REFUSED: NODE_ENV === 'production'. " +
        "This seed must never run against a production database."
    );
  }
  const dbUrl = process.env.DATABASE_URL ?? "";
  const isLocal =
    dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
  const hasFlag = process.env.ALLOW_DEMO_SEED === "true";
  if (!isLocal && !hasFlag) {
    throw new Error(
      "Demo seed REFUSED: DATABASE_URL does not include 'localhost' or '127.0.0.1', " +
        "and ALLOW_DEMO_SEED is not set to 'true'. " +
        "Set ALLOW_DEMO_SEED=true to override for non-local staging environments."
    );
  }
}

// ─── Deterministic PRNG (mulberry32) ─────────────────────────────────────────

function makePrng(seed: number) {
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Single global RNG — all calls must happen in the same deterministic order
const rng = makePrng(42);

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return rng() * (max - min) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_TENANT_ID = "demo_academy";

const FEATURES = [
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
  "ASSESSMENTS",
] as const;

const VOCAB_ROWS = [
  ["positive_points", "Positive Point", "Positive Points"],
  ["detentions", "Detention", "Detentions"],
  ["internal_exclusions", "Internal Exclusion", "Internal Exclusions"],
  ["on_calls", "On Call", "On Calls"],
  ["suspensions", "Suspension", "Suspensions"],
] as const;

const DEPARTMENTS = [
  "English",
  "Maths",
  "Science",
  "Humanities",
  "Languages",
  "PE",
] as const;

const YEAR_GROUPS = ["Y7", "Y8", "Y9", "Y10", "Y11"] as const;

const SUBJECTS_BY_DEPT: Record<string, string> = {
  English: "English",
  Maths: "Maths",
  Science: "Science",
  Humanities: "History",
  Languages: "French",
  PE: "PE",
};

const LESSON_PHASES = [
  "INSTRUCTION",
  "GUIDED_PRACTICE",
  "INDEPENDENT_PRACTICE",
] as const;

const ALL_SIGNAL_KEYS = SIGNAL_DEFINITIONS.map((s) => s.key);
type ScaleKey = "LIMITED" | "SOME" | "CONSISTENT" | "STRONG";

// ─── Name pools ───────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "Alice", "Ben", "Chloe", "Daniel", "Emily", "Frank", "Grace", "Harry",
  "Isla", "Jack", "Kezia", "Liam", "Maya", "Nathan", "Olivia", "Piotr",
  "Quinn", "Rebecca", "Samuel", "Tasha", "Uma", "Victor", "Wendy", "Xavier",
  "Yasmin", "Zoe", "Aaron", "Beth", "Carlos", "Diana", "Edward", "Fatima",
  "George", "Hana", "Ibrahim", "Jasmine", "Kevin", "Leila", "Marcus", "Nina",
  "Oscar", "Priya", "Reuben", "Sophie", "Tariq", "Ursula", "Vijay", "Winnie",
  "Xander", "Yusuf", "Zara", "Adam", "Bella", "Connor", "Daisy", "Ethan",
  "Fiona", "Glen", "Holly", "Ivan", "Julia", "Kieran", "Lucy", "Mohammed",
  "Nadia", "Oliver", "Pearl", "Quentin", "Rosa", "Stefan", "Tina", "Umar",
  "Vera", "Will", "Xena", "Yolanda", "Zeke", "Amara", "Brendan", "Ciara",
  "Declan", "Eloise", "Finn", "Gemma", "Hugo", "Ingrid", "Jerome", "Katie",
];

const LAST_NAMES = [
  "Thornton", "Okafor", "Davies", "Mitchell", "Patel", "Robinson", "Kim",
  "Brown", "Hughes", "Wilson", "Edwards", "Nguyen", "Scott", "Powell",
  "Martinez", "Kowalski", "Foster", "Adeyemi", "Turner", "Wright", "Sharma",
  "Olawale", "Clarke", "Patel", "Ali", "Henderson", "Marsh", "Fitzgerald",
  "Rivera", "Osei", "Taylor", "Jackson", "White", "Harris", "Thompson",
  "Garcia", "Anderson", "Lewis", "Robinson", "Walker", "Young", "Hall",
  "Allen", "King", "Wright", "Lopez", "Hill", "Green", "Adams", "Baker",
  "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Phillips",
  "Campbell", "Parker", "Evans", "Edwards", "Collins", "Stewart", "Sanchez",
  "Morris", "Rogers", "Reed", "Cook", "Morgan", "Bell", "Murphy", "Bailey",
  "Rivera", "Cooper", "Richardson", "Cox", "Howard", "Ward", "Torres",
  "Peterson", "Gray", "Ramirez", "James", "Watson", "Brooks", "Kelly", "Sanders",
];

// Use a deterministic name from pool by index
function demoName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

// Deterministic student names by index
const STUDENT_FIRST_POOL = [
  "Aiden", "Amelia", "Archie", "Ava", "Benjamin", "Charlotte", "Chloe",
  "Daniel", "Ella", "Ellie", "Emily", "Ethan", "Evie", "Finley", "Florence",
  "Freya", "George", "Grace", "Hannah", "Harry", "Henry", "Holly", "Isaac",
  "Isabella", "Jack", "Jacob", "Jake", "James", "Jessica", "Joseph",
  "Joshua", "Julia", "Katie", "Layla", "Liam", "Lily", "Logan", "Lucas",
  "Lucy", "Maisie", "Mason", "Matthew", "Max", "Mia", "Mohammed", "Noah",
  "Olivia", "Oscar", "Poppy", "Riley", "Ruby", "Samuel", "Sara", "Scarlett",
  "Sebastian", "Sienna", "Sofia", "Sophie", "Thomas", "Tyler", "William",
];

const STUDENT_LAST_POOL = [
  "Adams", "Ahmed", "Allen", "Bailey", "Baker", "Begum", "Bell", "Brown",
  "Campbell", "Carter", "Clarke", "Collins", "Cook", "Cooper", "Cox",
  "Davies", "Davis", "Evans", "Foster", "Garcia", "Green", "Hall", "Harris",
  "Harrison", "Hill", "Hughes", "Jackson", "James", "Johnson", "Jones",
  "Khan", "King", "Lee", "Lewis", "Martin", "Mason", "Miller", "Mitchell",
  "Moore", "Morgan", "Morris", "Murphy", "Nelson", "Owen", "Parker", "Patel",
  "Phillips", "Price", "Roberts", "Robinson", "Rogers", "Scott", "Smith",
  "Stewart", "Taylor", "Thomas", "Thompson", "Turner", "Walker", "White",
  "Williams", "Wilson", "Wood", "Wright", "Young",
];

function studentName(idx: number): string {
  const first = STUDENT_FIRST_POOL[idx % STUDENT_FIRST_POOL.length];
  const last = STUDENT_LAST_POOL[Math.floor(idx / STUDENT_FIRST_POOL.length) % STUDENT_LAST_POOL.length];
  return `${first} ${last}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const daysAgo = (d: number) =>
  new Date(Date.now() - d * 24 * 60 * 60 * 1000);

function makeSignals(overrides: Partial<Record<string, ScaleKey>> = {}) {
  return ALL_SIGNAL_KEYS.map((k) => ({
    signalKey: k,
    valueKey: overrides[k] ?? "CONSISTENT",
    notObserved: false,
  }));
}

/**
 * Signals for a "stable" teacher: mostly CONSISTENT with occasional STRONG/SOME
 */
function stableSignals(): ReturnType<typeof makeSignals> {
  const overrides: Partial<Record<string, ScaleKey>> = {};
  for (const key of ALL_SIGNAL_KEYS) {
    const roll = rng();
    if (roll < 0.15) overrides[key] = "STRONG";
    else if (roll < 0.25) overrides[key] = "SOME";
    // else CONSISTENT (default)
  }
  return makeSignals(overrides);
}

/**
 * Signals for a "drifting" teacher in the current window:
 * RETRIEVAL_PRESENCE, CFU_CYCLES, COLD_CALL_DENSITY drift to LIMITED/SOME
 */
function driftingCurrentSignals(): ReturnType<typeof makeSignals> {
  return makeSignals({
    RETRIEVAL_PRESENCE: "SOME",
    CFU_CYCLES: "LIMITED",
    COLD_CALL_DENSITY: "SOME",
    LIVE_ADJUSTMENT: "SOME",
  });
}

/**
 * Signals for an "improving" teacher in the current window:
 * RETRIEVAL_PRESENCE, CFU_CYCLES improve from SOME → CONSISTENT/STRONG
 */
function improvingCurrentSignals(): ReturnType<typeof makeSignals> {
  return makeSignals({
    RETRIEVAL_PRESENCE: "STRONG",
    CFU_CYCLES: "CONSISTENT",
    PARTICIPATION_EQUITY: "STRONG",
  });
}

/**
 * Signals for an "improving" teacher in the previous window (worse):
 */
function improvingPrevSignals(): ReturnType<typeof makeSignals> {
  return makeSignals({
    RETRIEVAL_PRESENCE: "SOME",
    CFU_CYCLES: "SOME",
    PARTICIPATION_EQUITY: "SOME",
  });
}

// ─── Main Seed Function ───────────────────────────────────────────────────────

export async function seedDemo(prisma: PrismaClient, isReset = false) {
  assertSafe();

  const label = isReset ? "RESET" : "SEED";
  console.log(`\n🌱  Demo ${label}: Starting — Demo Academy\n`);

  // ── Step 0: Clean up existing demo data ────────────────────────────────────
  console.log("  🗑️  Removing existing demo data…");
  // TenantSettings has no cascade from Tenant, remove first
  await prisma.tenantSettings.deleteMany({
    where: { tenantId: DEMO_TENANT_ID },
  });
  // Everything else cascades from Tenant delete
  await prisma.tenant.deleteMany({ where: { id: DEMO_TENANT_ID } });
  console.log("  ✓  Previous demo data cleared");

  // ── Step 1: Tenant ─────────────────────────────────────────────────────────
  console.log("  🏫  Creating tenant…");
  const tenant = await prisma.tenant.create({
    data: { id: DEMO_TENANT_ID, name: "Demo Academy" },
  });

  // TenantSettings
  await prisma.tenantSettings.create({
    data: {
      tenantId: tenant.id,
      schoolName: "Demo Academy",
      timezone: "Europe/London",
      defaultInsightWindowDays: 21,
      minObservationCount: 6,
      driftDeltaThreshold: 0.35,
      positivePointsLabel: "Positive Points",
      detentionLabel: "Detentions",
      internalExclusionLabel: "Internal Exclusions",
      suspensionLabel: "Suspensions",
      onCallLabel: "On Calls",
    },
  });

  // Features
  for (const key of FEATURES) {
    await prisma.tenantFeature.create({
      data: { tenantId: tenant.id, key, enabled: true },
    });
  }

  // Vocab
  for (const [key, singular, plural] of VOCAB_ROWS) {
    await prisma.tenantVocab.create({
      data: { tenantId: tenant.id, key, labelSingular: singular, labelPlural: plural },
    });
  }

  // Signal labels
  for (const signal of SIGNAL_DEFINITIONS) {
    await prisma.tenantSignalLabel.create({
      data: {
        tenantId: tenant.id,
        signalKey: signal.key,
        displayName: signal.displayNameDefault,
        description: signal.descriptionDefault,
      },
    });
  }
  console.log("  ✓  Tenant configured");

  // ── Step 2: Users ──────────────────────────────────────────────────────────
  console.log("  👥  Creating users…");
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Admin
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "admin@demo.school",
      fullName: "Admin User",
      role: "ADMIN",
      isActive: true,
      canApproveAllLoa: true,
      receivesOnCallEmails: true,
      passwordHash,
    },
  });

  // SLT (also coaches)
  const sltData = [
    { email: "sarah.chen@demo.school", fullName: "Sarah Chen" },
    { email: "james.morrison@demo.school", fullName: "James Morrison" },
    { email: "patricia.okafor@demo.school", fullName: "Patricia Okafor" },
  ];
  const sltUsers: typeof admin[] = [];
  for (const u of sltData) {
    sltUsers.push(
      await prisma.user.create({
        data: { tenantId: tenant.id, ...u, role: "SLT", isActive: true, passwordHash },
      })
    );
  }

  // HODs (one per department)
  const hodData = [
    { email: "emma.walsh@demo.school", fullName: "Emma Walsh", dept: "English" },
    { email: "david.kumar@demo.school", fullName: "David Kumar", dept: "Maths" },
    { email: "rachel.thompson@demo.school", fullName: "Rachel Thompson", dept: "Science" },
    { email: "michael.stevens@demo.school", fullName: "Michael Stevens", dept: "Humanities" },
    { email: "isabelle.martin@demo.school", fullName: "Isabelle Martin", dept: "Languages" },
    { email: "tony.adesanya@demo.school", fullName: "Tony Adesanya", dept: "PE" },
  ];
  const hodUsers: (typeof admin & { dept: string })[] = [];
  for (const u of hodData) {
    const { dept, ...rest } = u;
    const created = await prisma.user.create({
      data: { tenantId: tenant.id, ...rest, role: "HOD", isActive: true, passwordHash },
    });
    hodUsers.push({ ...created, dept });
  }

  // Teachers (30)
  const teacherDefs = [
    // English (01–05)
    { email: "alice.thornton@demo.school", fullName: "Alice Thornton", dept: "English" },
    { email: "ben.okafor@demo.school", fullName: "Ben Okafor", dept: "English" },
    { email: "chloe.davies@demo.school", fullName: "Chloe Davies", dept: "English" },
    { email: "daniel.mitchell@demo.school", fullName: "Daniel Mitchell", dept: "English" },
    { email: "emily.patel@demo.school", fullName: "Emily Patel", dept: "English" },
    // Maths (06–10)
    { email: "frank.robinson@demo.school", fullName: "Frank Robinson", dept: "Maths" },
    { email: "grace.kim@demo.school", fullName: "Grace Kim", dept: "Maths" },
    { email: "harry.brown@demo.school", fullName: "Harry Brown", dept: "Maths" },
    { email: "isla.hughes@demo.school", fullName: "Isla Hughes", dept: "Maths" },
    { email: "jack.wilson@demo.school", fullName: "Jack Wilson", dept: "Maths" },
    // Science (11–15)
    { email: "kezia.edwards@demo.school", fullName: "Kezia Edwards", dept: "Science" },
    { email: "liam.nguyen@demo.school", fullName: "Liam Nguyen", dept: "Science" },
    { email: "maya.scott@demo.school", fullName: "Maya Scott", dept: "Science" },
    { email: "nathan.powell@demo.school", fullName: "Nathan Powell", dept: "Science" },
    { email: "olivia.martinez@demo.school", fullName: "Olivia Martinez", dept: "Science" },
    // Humanities (16–20)
    { email: "piotr.kowalski@demo.school", fullName: "Piotr Kowalski", dept: "Humanities" },
    { email: "quinn.foster@demo.school", fullName: "Quinn Foster", dept: "Humanities" },
    { email: "rebecca.adeyemi@demo.school", fullName: "Rebecca Adeyemi", dept: "Humanities" },
    { email: "samuel.turner@demo.school", fullName: "Samuel Turner", dept: "Humanities" },
    { email: "tasha.wright@demo.school", fullName: "Tasha Wright", dept: "Humanities" },
    // Languages (21–25) — includes 5 drifting teachers
    { email: "uma.sharma@demo.school", fullName: "Uma Sharma", dept: "Languages" },
    { email: "victor.olawale@demo.school", fullName: "Victor Olawale", dept: "Languages" },
    { email: "wendy.clarke@demo.school", fullName: "Wendy Clarke", dept: "Languages" },
    { email: "xavier.patel@demo.school", fullName: "Xavier Patel", dept: "Languages" },
    { email: "yasmin.ali@demo.school", fullName: "Yasmin Ali", dept: "Languages" },
    // PE (26–30) — 2 improving + 1 low coverage + 1 drifting + 1 stable
    { email: "zoe.henderson@demo.school", fullName: "Zoe Henderson", dept: "PE" },
    { email: "aaron.marsh@demo.school", fullName: "Aaron Marsh", dept: "PE" },
    { email: "beth.fitzgerald@demo.school", fullName: "Beth Fitzgerald", dept: "PE" },
    { email: "carlos.rivera@demo.school", fullName: "Carlos Rivera", dept: "PE" },
    { email: "diana.osei@demo.school", fullName: "Diana Osei", dept: "PE" },
  ];

  const teacherUsers: (typeof admin & { dept: string })[] = [];
  for (const t of teacherDefs) {
    const { dept, ...rest } = t;
    const created = await prisma.user.create({
      data: { tenantId: tenant.id, ...rest, role: "TEACHER", isActive: true, passwordHash },
    });
    teacherUsers.push({ ...created, dept });
  }
  console.log(`  ✓  ${1 + sltUsers.length + hodUsers.length + teacherUsers.length} users created`);

  // ── Step 3: Departments + Memberships ──────────────────────────────────────
  console.log("  🏛️  Creating departments…");
  const deptMap: Record<string, { id: string }> = {};
  for (const name of DEPARTMENTS) {
    deptMap[name] = await prisma.department.create({
      data: { tenantId: tenant.id, name },
    });
  }

  // HOD memberships
  for (const hod of hodUsers) {
    await prisma.departmentMembership.create({
      data: {
        tenantId: tenant.id,
        departmentId: deptMap[hod.dept].id,
        userId: hod.id,
        isHeadOfDepartment: true,
      },
    });
  }

  // Teacher memberships
  for (const t of teacherUsers) {
    await prisma.departmentMembership.create({
      data: {
        tenantId: tenant.id,
        departmentId: deptMap[t.dept].id,
        userId: t.id,
        isHeadOfDepartment: false,
      },
    });
  }

  // SLT membership in all departments
  for (const slt of sltUsers) {
    for (const name of DEPARTMENTS) {
      await prisma.departmentMembership.create({
        data: {
          tenantId: tenant.id,
          departmentId: deptMap[name].id,
          userId: slt.id,
          isHeadOfDepartment: false,
        },
      });
    }
  }
  console.log("  ✓  Departments + memberships created");

  // ── Step 4: Coach Assignments ──────────────────────────────────────────────
  console.log("  🤝  Creating coach assignments…");
  // Sarah Chen coaches teachers 01–06 (0-indexed 0–5)
  // James Morrison coaches teachers 07–12 (0-indexed 6–11)
  // Patricia Okafor coaches teachers 13–18 (0-indexed 12–17)
  const coachBatches: [typeof sltUsers[0], number, number][] = [
    [sltUsers[0], 0, 5],
    [sltUsers[1], 6, 11],
    [sltUsers[2], 12, 17],
  ];
  for (const [coach, start, end] of coachBatches) {
    for (let i = start; i <= end; i++) {
      await prisma.coachAssignment.create({
        data: {
          tenantId: tenant.id,
          coachUserId: coach.id,
          coacheeUserId: teacherUsers[i].id,
        },
      });
    }
  }
  console.log("  ✓  Coach assignments created");

  // ── Step 5: LOA + OnCall Config ────────────────────────────────────────────
  console.log("  📋  Creating LOA + OnCall config…");
  const loaReasonLabels = ["Medical", "Family", "Training", "Conference", "Bereavement"];
  const loaReasonRecords: { id: string; label: string }[] = [];
  for (const label of loaReasonLabels) {
    loaReasonRecords.push(
      await prisma.loaReason.create({ data: { tenantId: tenant.id, label } })
    );
  }

  // Admin as LOA authoriser
  await prisma.lOAAuthoriser.create({
    data: { tenantId: tenant.id, userId: admin.id },
  });
  // SLT as LOA authorisers too
  for (const slt of sltUsers) {
    await prisma.lOAAuthoriser.create({
      data: { tenantId: tenant.id, userId: slt.id },
    });
  }

  for (const label of ["Behaviour disruption", "Safeguarding", "Urgent support", "First aid"]) {
    await prisma.onCallReason.create({ data: { tenantId: tenant.id, label } });
  }
  for (const label of ["Hallway", "Playground", "Canteen", "Classroom 12", "Sports Hall"]) {
    await prisma.onCallLocation.create({ data: { tenantId: tenant.id, label } });
  }
  for (const email of ["oncall@demo.school", "pastoral@demo.school"]) {
    await prisma.onCallRecipient.create({ data: { tenantId: tenant.id, email } });
  }
  console.log("  ✓  LOA + OnCall config created");

  // ── Step 6: Students + Snapshots ───────────────────────────────────────────
  console.log("  🎒  Creating students + snapshots (900)…");

  const STUDENTS_PER_YEAR = 180;
  const prevDate = daysAgo(42);
  const midDate = daysAgo(21);
  const currentDate = daysAgo(1);

  // Track student IDs for later use (OnCall events)
  const studentIdsByYear: Record<string, string[]> = {
    Y7: [], Y8: [], Y9: [], Y10: [], Y11: [],
  };

  let globalStudentIdx = 0;

  for (const year of YEAR_GROUPS) {
    const yearNum = parseInt(year.slice(1), 10); // 7, 8, 9, 10, 11
    for (let i = 0; i < STUDENTS_PER_YEAR; i++) {
      const upn = `D${yearNum}${String(i + 1).padStart(3, "0")}`;
      const name = studentName(globalStudentIdx++);
      const isSEND = i % 10 === 0; // every 10th
      const isPP = i % 5 === 0;    // every 5th

      const student = await prisma.student.create({
        data: {
          tenantId: tenant.id,
          upn,
          fullName: name,
          yearGroup: year,
          sendFlag: isSEND,
          ppFlag: isPP,
          status: "ACTIVE",
        },
      });
      studentIdsByYear[year].push(student.id);

      // ── Snapshot values ────────────────────────────────────────────────────

      // Base attendance: 92–98%
      const baseAttendance = randFloat(92, 98);

      // Default baseline (prev)
      let prevAtt = baseAttendance;
      let prevDetentions = randInt(0, 3);
      let prevOnCalls = 0;
      let prevLateness = randInt(0, 2);
      let prevIntExclusions = 0;
      let prevSuspensions = 0;
      let prevPositive = randInt(5, 20);

      // Default current (same or slight drift)
      let curAtt = prevAtt + randFloat(-0.5, 0.5);
      let curDetentions = prevDetentions + randInt(-1, 1);
      let curOnCalls = 0;
      let curLateness = prevLateness + randInt(-1, 1);
      let curIntExclusions = 0;
      let curSuspensions = 0;
      let curPositive = prevPositive + randInt(-3, 3);

      // ── Injected patterns ──────────────────────────────────────────────────

      // URGENT students: first 3 per year group (indices 0–2)
      if (i < 3) {
        // Attendance drop > 6pp
        prevAtt = randFloat(80, 86);
        curAtt = prevAtt - randFloat(6.5, 10);
        curOnCalls = randInt(2, 4);
        prevOnCalls = 0;
        curDetentions = prevDetentions + randInt(3, 6);
        if (i === 2) {
          curSuspensions = 1; // suspension case
          prevSuspensions = 0;
        }
      }

      // PRIORITY students: indices 3–8 per year group
      else if (i < 9) {
        prevAtt = randFloat(85, 91);
        curAtt = prevAtt - randFloat(3, 6);
        curDetentions = prevDetentions + randInt(2, 4);
        curLateness = prevLateness + randInt(2, 4);
      }

      // Year 9 cohort attendance drop: ~60% of remaining students
      if (year === "Y9" && i >= 9 && rng() < 0.6) {
        curAtt = prevAtt - randFloat(2, 4);
      }

      // Year 8 OnCalls spike: 15–30 students (indices 9–38)
      if (year === "Y8" && i >= 9 && i < 39) {
        curOnCalls = randInt(1, 2);
      }

      // Clamp values
      curAtt = Math.max(50, Math.min(100, curAtt));
      curDetentions = Math.max(0, curDetentions);
      curOnCalls = Math.max(0, curOnCalls);
      curLateness = Math.max(0, curLateness);
      curIntExclusions = Math.max(0, curIntExclusions);
      curSuspensions = Math.max(0, curSuspensions);
      curPositive = Math.max(0, curPositive);

      const snapBase = {
        tenantId: tenant.id,
        studentId: student.id,
        countScope: "TERM_TO_DATE" as const,
      };

      // Previous snapshot
      await prisma.studentSnapshot.create({
        data: {
          ...snapBase,
          snapshotDate: new Date(prevDate.toISOString().slice(0, 10) + "T00:00:00.000Z"),
          attendancePct: parseFloat(prevAtt.toFixed(1)),
          detentionsCount: prevDetentions,
          onCallsCount: prevOnCalls,
          latenessCount: prevLateness,
          internalExclusionsCount: prevIntExclusions,
          suspensionsCount: prevSuspensions,
          positivePointsTotal: prevPositive,
        },
      });

      // Mid snapshot (for a subset — every 3rd student)
      if (i % 3 === 0) {
        await prisma.studentSnapshot.create({
          data: {
            ...snapBase,
            snapshotDate: new Date(midDate.toISOString().slice(0, 10) + "T00:00:00.000Z"),
            attendancePct: parseFloat(((prevAtt + curAtt) / 2).toFixed(1)),
            detentionsCount: Math.round((prevDetentions + curDetentions) / 2),
            onCallsCount: Math.round((prevOnCalls + curOnCalls) / 2),
            latenessCount: Math.round((prevLateness + curLateness) / 2),
            internalExclusionsCount: 0,
            suspensionsCount: 0,
            positivePointsTotal: Math.round((prevPositive + curPositive) / 2),
          },
        });
      }

      // Current snapshot
      await prisma.studentSnapshot.create({
        data: {
          ...snapBase,
          snapshotDate: new Date(currentDate.toISOString().slice(0, 10) + "T00:00:00.000Z"),
          attendancePct: parseFloat(curAtt.toFixed(1)),
          detentionsCount: curDetentions,
          onCallsCount: curOnCalls,
          latenessCount: curLateness,
          internalExclusionsCount: curIntExclusions,
          suspensionsCount: curSuspensions,
          positivePointsTotal: curPositive,
        },
      });
    }
  }
  console.log("  ✓  Students + snapshots created");

  // ── Step 7: Observations ───────────────────────────────────────────────────
  console.log("  👁️  Creating observations…");

  /**
   * Teacher profiles (0-indexed into teacherUsers):
   * 0–19:  STABLE    (20 teachers) — mostly CONSISTENT
   * 20–26: DRIFTING  (7 teachers)  — current window shows deterioration
   * 27–28: IMPROVING (2 teachers)  — current window shows improvement
   * 29:    LOW_COVERAGE (1 teacher) — only 2 observations
   */

  // Mapping from teacher index to observer (coach or admin)
  function observerFor(tIdx: number): string {
    if (tIdx >= 0 && tIdx <= 5) return sltUsers[0].id; // Sarah Chen
    if (tIdx >= 6 && tIdx <= 11) return sltUsers[1].id; // James Morrison
    if (tIdx >= 12 && tIdx <= 17) return sltUsers[2].id; // Patricia Okafor
    return admin.id; // fallback
  }

  let totalObservations = 0;

  for (let tIdx = 0; tIdx < teacherUsers.length; tIdx++) {
    const teacher = teacherUsers[tIdx];
    const observerId = observerFor(tIdx);
    const subject = SUBJECTS_BY_DEPT[teacher.dept] ?? "Other";
    const phase = pick(LESSON_PHASES) as string;
    const yearGroup = pick(YEAR_GROUPS) as string;

    const isLowCoverage = tIdx === 29;
    const isDrifting = tIdx >= 20 && tIdx <= 26;
    const isImproving = tIdx >= 27 && tIdx <= 28;

    if (isLowCoverage) {
      // Only 2 observations in current window
      for (let i = 0; i < 2; i++) {
        await prisma.observation.create({
          data: {
            tenantId: tenant.id,
            observedTeacherId: teacher.id,
            observerId,
            observedAt: daysAgo(randInt(3, 15)),
            yearGroup,
            subject,
            phase,
            signals: { createMany: { data: makeSignals() } },
          },
        });
        totalObservations++;
      }
      continue;
    }

    // Current window (last 21 days): 8 observations for most teachers
    const currentObs = isDrifting || isImproving ? 8 : 7;
    for (let i = 0; i < currentObs; i++) {
      const dayOffset = randInt(1, 20);
      let signals: ReturnType<typeof makeSignals>;
      if (isDrifting) {
        signals = driftingCurrentSignals();
      } else if (isImproving) {
        signals = improvingCurrentSignals();
      } else {
        signals = stableSignals();
      }
      await prisma.observation.create({
        data: {
          tenantId: tenant.id,
          observedTeacherId: teacher.id,
          observerId,
          observedAt: daysAgo(dayOffset),
          yearGroup,
          subject,
          phase,
          signals: { createMany: { data: signals } },
        },
      });
      totalObservations++;
    }

    // Previous window (21–42 days ago): 5–6 observations
    const prevObs = isDrifting ? 6 : 5;
    for (let i = 0; i < prevObs; i++) {
      const dayOffset = randInt(22, 41);
      let signals: ReturnType<typeof makeSignals>;
      if (isImproving) {
        signals = improvingPrevSignals(); // worse in prev window
      } else {
        signals = stableSignals(); // stable in both windows (or was stable before drifting)
      }
      await prisma.observation.create({
        data: {
          tenantId: tenant.id,
          observedTeacherId: teacher.id,
          observerId,
          observedAt: daysAgo(dayOffset),
          yearGroup,
          subject,
          phase,
          signals: { createMany: { data: signals } },
        },
      });
      totalObservations++;
    }
  }
  console.log(`  ✓  ${totalObservations} observations created`);

  // ── Book Look observations ─────────────────────────────────────────────────
  console.log("  📚  Creating book look observations…");
  const bookTeacherIndices = [0, 5, 10, 15];
  const bookScoresets: Partial<Record<string, ScaleKey>>[] = [
    { PRESENTATION_STANDARD: "LIMITED",    WORK_COMPLETION: "SOME",       SUSTAINED_EFFORT: "LIMITED",    TASK_APPROPRIATENESS: "SOME",       VOLUME_OF_WORK: "LIMITED"    },
    { PRESENTATION_STANDARD: "CONSISTENT", WORK_COMPLETION: "CONSISTENT", SUSTAINED_EFFORT: "SOME",       TASK_APPROPRIATENESS: "CONSISTENT", VOLUME_OF_WORK: "SOME"       },
    { PRESENTATION_STANDARD: "STRONG",     WORK_COMPLETION: "STRONG",     SUSTAINED_EFFORT: "CONSISTENT", TASK_APPROPRIATENESS: "STRONG",     VOLUME_OF_WORK: "CONSISTENT" },
    { PRESENTATION_STANDARD: "SOME",       WORK_COMPLETION: "LIMITED",    SUSTAINED_EFFORT: "SOME",       TASK_APPROPRIATENESS: "LIMITED",    VOLUME_OF_WORK: "SOME"       },
    { PRESENTATION_STANDARD: "CONSISTENT", WORK_COMPLETION: "STRONG",     SUSTAINED_EFFORT: "STRONG",     TASK_APPROPRIATENESS: "CONSISTENT", VOLUME_OF_WORK: "STRONG"     },
  ];
  const bookSignalKeys = [
    "PRESENTATION_STANDARD",
    "WORK_COMPLETION",
    "SUSTAINED_EFFORT",
    "TASK_APPROPRIATENESS",
    "VOLUME_OF_WORK",
  ] as const;

  let totalBookObservations = 0;
  for (let bi = 0; bi < bookTeacherIndices.length; bi++) {
    const teacher = teacherUsers[bookTeacherIndices[bi]];
    const observerId = observerFor(bookTeacherIndices[bi]);
    const subject = SUBJECTS_BY_DEPT[teacher.dept] ?? "Other";
    const yearGroup = pick(YEAR_GROUPS) as string;
    const obsCount = bi % 2 === 0 ? 2 : 1;
    for (let oi = 0; oi < obsCount; oi++) {
      const scores = bookScoresets[(bi * 2 + oi) % bookScoresets.length];
      await prisma.observation.create({
        data: {
          tenantId: tenant.id,
          observedTeacherId: teacher.id,
          observerId,
          observedAt: daysAgo(randInt(3, 18)),
          yearGroup,
          subject,
          phase: "BOOKS",
          signals: {
            createMany: {
              data: bookSignalKeys.map((k) => ({
                signalKey: k,
                valueKey: scores[k] ?? "CONSISTENT",
                notObserved: false,
              })),
            },
          },
        },
      });
      totalBookObservations++;
    }
  }
  console.log(`  ✓  ${totalBookObservations} book look observations created`);

  // ── Step 8: LOA Requests ───────────────────────────────────────────────────
  console.log("  📝  Creating LOA requests…");
  const loaStatuses = ["PENDING", "PENDING", "APPROVED", "APPROVED", "APPROVED", "DENIED", "PENDING"];
  for (let i = 0; i < 10; i++) {
    const teacher = teacherUsers[i % teacherUsers.length];
    const reason = loaReasonRecords[i % loaReasonRecords.length];
    const startOffset = randInt(2, 30);
    const status = loaStatuses[i % loaStatuses.length];
    await prisma.lOARequest.create({
      data: {
        tenantId: tenant.id,
        requesterId: teacher.id,
        reasonId: reason.id,
        startDate: daysAgo(-startOffset), // future
        endDate: daysAgo(-(startOffset + randInt(1, 5))),
        notes: `Cover required for ${teacher.fullName}.`,
        status,
      },
    });
  }
  console.log("  ✓  LOA requests created");

  // ── Step 9: OnCall Events ──────────────────────────────────────────────────
  console.log("  🚨  Creating OnCall events…");
  const onCallTypes: Array<"BEHAVIOUR" | "FIRST_AID"> = [
    "BEHAVIOUR", "BEHAVIOUR", "BEHAVIOUR", "FIRST_AID", "BEHAVIOUR",
    "FIRST_AID", "BEHAVIOUR", "BEHAVIOUR", "FIRST_AID", "BEHAVIOUR",
  ];
  const onCallStatuses: Array<"OPEN" | "ACKNOWLEDGED" | "RESOLVED"> = [
    "OPEN", "OPEN", "ACKNOWLEDGED", "RESOLVED", "RESOLVED",
    "OPEN", "ACKNOWLEDGED", "RESOLVED", "OPEN", "RESOLVED",
  ];
  const locations = ["Hallway", "Playground", "Canteen", "Classroom 12", "Sports Hall"];

  // Use Y9 students for on-call events
  const y9Students = studentIdsByYear["Y9"];
  const y8Students = studentIdsByYear["Y8"];

  for (let i = 0; i < 20; i++) {
    const requester = teacherUsers[i % teacherUsers.length];
    const studentId = i < 10 ? y9Students[i] : y8Students[i - 10];
    const requestType = onCallTypes[i % onCallTypes.length];
    const status = onCallStatuses[i % onCallStatuses.length];
    const createdAt = daysAgo(randInt(1, 14));
    const responder = status !== "OPEN" ? sltUsers[i % sltUsers.length] : null;

    await prisma.onCallRequest.create({
      data: {
        tenantId: tenant.id,
        requesterUserId: requester.id,
        studentId,
        requestType,
        location: locations[i % locations.length],
        behaviourReasonCategory:
          requestType === "BEHAVIOUR" ? "Disruption to learning" : null,
        notes: `${requestType === "BEHAVIOUR" ? "Student refusing to follow instructions" : "Student injury in corridor"}.`,
        status,
        responderUserId: responder?.id ?? null,
        createdAt,
        acknowledgedAt: status !== "OPEN" ? new Date(createdAt.getTime() + 5 * 60 * 1000) : null,
        resolvedAt: status === "RESOLVED" ? new Date(createdAt.getTime() + 30 * 60 * 1000) : null,
      },
    });
  }
  console.log("  ✓  OnCall events created");

  // ── Step 10: Meetings + Actions ────────────────────────────────────────────
  console.log("  📅  Creating meetings + actions…");
  const meetingTypes: Array<"LINE_MANAGEMENT" | "DEPARTMENT" | "PASTORAL" | "SEN" | "OTHER"> = [
    "LINE_MANAGEMENT", "DEPARTMENT", "PASTORAL", "LINE_MANAGEMENT",
    "DEPARTMENT", "LINE_MANAGEMENT", "PASTORAL", "OTHER", "SEN", "LINE_MANAGEMENT",
  ];
  const meetingTitles = [
    "Sarah Chen — Line Management", "English Department Meeting",
    "Year 9 Pastoral Review", "James Morrison — Line Management",
    "Maths Department Planning", "Patricia Okafor — Coaching",
    "Year 8 Pastoral Update", "SLT Weekly Briefing",
    "SEND Review Meeting", "Whole-School Focus: Retrieval Practice",
  ];

  const actionDescriptions = [
    "Review marking policy and update class records",
    "Prepare data analysis for governor report",
    "Complete lesson observation self-reflection form",
    "Update student seating plans for autumn term",
    "Follow up with SENCO regarding support plan",
    "Submit CPD evidence portfolio by end of month",
    "Arrange department book scrutiny",
    "Review and respond to pupil survey results",
    "Plan and deliver retrieval practice pilot",
    "Share best practice example with department",
    "Update assessment tracker with autumn data",
    "Create cover work for planned absence",
    "Meet with parents regarding behaviour plan",
    "Complete safeguarding refresher training",
    "Update timetable for period 5 swap",
    "Review last 3 observations with coach",
    "Attend SEND network meeting this term",
    "Prepare year group assembly slot",
    "Update department improvement plan",
    "Facilitate peer observation with colleague",
    "Complete mid-year performance review paperwork",
    "Write up notes from department meeting",
    "Submit year 11 predicted grades",
    "Complete CEIAG referral for year 10 student",
    "Finalise revision schedule for year 11",
    "Review attendance data for tutor group",
    "Plan differentiation strategies for set 4",
    "Chase outstanding homework submissions",
    "Schedule observation with line manager",
    "Prepare agenda for upcoming department meeting",
  ];

  const actionStatuses: Array<"OPEN" | "DONE" | "BLOCKED"> = [
    "OPEN", "OPEN", "DONE", "OPEN", "BLOCKED",
    "DONE", "OPEN", "OPEN", "DONE", "OPEN",
    "OPEN", "DONE", "BLOCKED", "OPEN", "DONE",
    "OPEN", "OPEN", "DONE", "OPEN", "OPEN",
    "DONE", "OPEN", "OPEN", "BLOCKED", "DONE",
    "OPEN", "OPEN", "DONE", "OPEN", "OPEN",
  ];

  for (let mIdx = 0; mIdx < 10; mIdx++) {
    const creator = mIdx < 3 ? sltUsers[mIdx % sltUsers.length] : admin;
    const mDate = daysAgo(randInt(-7, 14)); // mix of past and upcoming
    const meeting = await prisma.meeting.create({
      data: {
        tenantId: tenant.id,
        title: meetingTitles[mIdx],
        type: meetingTypes[mIdx],
        status: mIdx % 3 === 0 ? "PENDING" : "CONFIRMED",
        startDateTime: mDate,
        endDateTime: new Date(mDate.getTime() + 60 * 60 * 1000),
        location: pick(["Room 14", "Head's Office", "Conference Room", "Department Base", "Library"]),
        notes: `Agenda: review progress, set next steps, actions to follow.`,
        createdByUserId: creator.id,
      },
    });

    // Add 2–4 attendees
    const numAttendees = randInt(2, 4);
    const attendeeSet = new Set<string>([creator.id]);
    for (let a = 0; a < numAttendees; a++) {
      const t = teacherUsers[(mIdx * 3 + a) % teacherUsers.length];
      if (!attendeeSet.has(t.id)) {
        attendeeSet.add(t.id);
        await prisma.meetingAttendee.create({
          data: { tenantId: tenant.id, meetingId: meeting.id, userId: t.id },
        });
      }
    }

    // Add 3 actions per meeting (= 30 actions total)
    for (let aIdx = 0; aIdx < 3; aIdx++) {
      const globalAIdx = mIdx * 3 + aIdx;
      const owner = teacherUsers[(mIdx * 3 + aIdx) % teacherUsers.length];
      const status = actionStatuses[globalAIdx % actionStatuses.length];
      const isOverdue = globalAIdx % 4 === 0;
      const dueDateOffset = isOverdue ? -randInt(2, 7) : randInt(3, 21);

      await prisma.meetingAction.create({
        data: {
          tenantId: tenant.id,
          meetingId: meeting.id,
          description: actionDescriptions[globalAIdx % actionDescriptions.length],
          ownerUserId: owner.id,
          dueDate: daysAgo(-dueDateOffset),
          status,
          createdByUserId: creator.id,
          completedAt: status === "DONE" ? daysAgo(randInt(1, 5)) : null,
        },
      });
    }
  }
  console.log("  ✓  Meetings + actions created");

  // ─── Assessments ───────────────────────────────────────────────────────────

  console.log("  →  Seeding assessment data…");

  // GCSE Cycle: Year 11 Mock exams
  const gcseSubjects = [
    "Maths", "English Language", "English Literature",
    "Biology", "Chemistry", "Physics",
    "History", "Geography", "French", "RE",
    "Statistics", "Sociology",
  ];

  const gcseGrades = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;
  type GcseGrade = (typeof gcseGrades)[number];

  // Grade distribution weights: bell-curve centred around 5-6
  const gradeWeights = [2, 5, 10, 18, 22, 20, 13, 7, 3]; // 9,8,7,6,5,4,3,2,1

  function pickGcseGrade(baseShift = 0): GcseGrade {
    const weights = gradeWeights.map((w, i) => {
      const shift = i + baseShift;
      return Math.max(1, w + shift * (shift > 0 ? -1 : 2));
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return gcseGrades[i];
    }
    return 4;
  }

  const aLevelGrades = ["A*", "A", "B", "C", "D", "E", "U"] as const;
  type ALevelGrade = (typeof aLevelGrades)[number];
  const aLevelWeights = [8, 20, 28, 22, 13, 7, 2]; // A*, A, B, C, D, E, U

  function pickALevelGrade(baseShift = 0): ALevelGrade {
    const weights = aLevelWeights.map((w, i) => {
      const shift = i + baseShift;
      return Math.max(1, w - Math.abs(baseShift) * 1.5);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return aLevelGrades[i];
    }
    return "C";
  }

  // ── GCSE: Year 11 Mock cycle ──
  const gcseCycle = await prisma.assessmentCycle.upsert({
    where: { tenantId_label: { tenantId: tenant.id, label: "Year 11 GCSE 2024/25" } },
    update: {},
    create: {
      tenantId: tenant.id,
      label: "Year 11 GCSE 2024/25",
      cohortLabel: "Year 11",
      qualificationType: "GCSE",
      academicYear: "2024/25",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-07-31"),
      isActive: true,
      status: "active",
    },
  });

  const gcseMock1 = await prisma.assessmentPoint.upsert({
    where: { tenantId_cycleId_label: { tenantId: tenant.id, cycleId: gcseCycle.id, label: "Mock 1" } },
    update: {},
    create: {
      tenantId: tenant.id,
      cycleId: gcseCycle.id,
      label: "Mock 1",
      shortLabel: "M1",
      ordinal: 1,
      pointType: "INTERNAL_MOCK",
      resultStatus: "PUBLISHED",
      isFinalPoint: false,
      comparisonEligible: true,
      assessedAt: new Date("2024-11-15"),
    },
  });

  const gcseMock2 = await prisma.assessmentPoint.upsert({
    where: { tenantId_cycleId_label: { tenantId: tenant.id, cycleId: gcseCycle.id, label: "Mock 2" } },
    update: {},
    create: {
      tenantId: tenant.id,
      cycleId: gcseCycle.id,
      label: "Mock 2",
      shortLabel: "M2",
      ordinal: 2,
      pointType: "INTERNAL_MOCK",
      resultStatus: "PUBLISHED",
      isFinalPoint: false,
      comparisonEligible: true,
      assessedAt: new Date("2025-02-20"),
    },
  });

  // Fetch Y11 students
  const y11Students = await prisma.student.findMany({
    where: { tenantId: tenant.id, yearGroup: "Y11" },
    select: { id: true, upn: true, fullName: true, ppFlag: true, sendFlag: true },
  });

  // Create GCSE assessments for both mock points
  for (const point of [gcseMock1, gcseMock2]) {
    for (const subject of gcseSubjects) {
      // Determine enrolled students first to set entryCount
      const isCoreSubjectPre = ["Maths", "English Language", "English Literature"].includes(subject);
      const preEnrolled = isCoreSubjectPre
        ? y11Students
        : y11Students.filter(() => rng() > 0.35);
      const expectedCount = preEnrolled.length;

      const assessment = await prisma.assessment.upsert({
        where: {
          id: `demo-gcse-${point.id}-${subject.replace(/\s+/g, "_").toLowerCase()}`,
        },
        update: {},
        create: {
          id: `demo-gcse-${point.id}-${subject.replace(/\s+/g, "_").toLowerCase()}`,
          tenantId: tenant.id,
          pointId: point.id,
          subject,
          yearGroup: "Y11",
          title: `${subject} — Y11 ${point.label}`,
          gradeFormat: "GCSE",
          uploadStatus: "VALIDATED",
          entryCount: expectedCount,
          matchedStudentCount: expectedCount,
          createdByUserId: admin.id,
        },
      });

      // Use pre-enrolled students (already computed above)
      const isCoreSubject = isCoreSubjectPre;
      const enrolledStudents = preEnrolled;

      for (const student of enrolledStudents) {
        // PP students slightly lower grades on average
        const baseShift = student.ppFlag ? 1 : student.sendFlag ? 2 : 0;
        // Mock 2 = slight improvement on average
        const mockShift = point.label === "Mock 2" ? -1 : 0;
        const rawGrade = pickGcseGrade(baseShift + mockShift);

        // 3% absent
        const isAbsent = rng() < 0.03;
        const rawValue = isAbsent ? "Absent" : String(rawGrade);
        const status = isAbsent ? "ABSENT" : "PRESENT";
        const normalizedScore = isAbsent ? null : rawGrade / 9;

        await prisma.assessmentResult.upsert({
          where: {
            tenantId_assessmentId_studentId: {
              tenantId: tenant.id,
              assessmentId: assessment.id,
              studentId: student.id,
            },
          },
          update: { rawValue, normalizedScore, status },
          create: {
            tenantId: tenant.id,
            assessmentId: assessment.id,
            studentId: student.id,
            rawValue,
            normalizedScore,
            status,
          },
        });
      }
    }
  }
  console.log("  ✓  GCSE Year 11 assessment data seeded");

  // ── A-Level: Year 13 cycle ──
  // First, create/upsert Year 13 students (not in the default YEAR_GROUPS)
  const A_LEVEL_SUBJECTS = [
    "Maths", "Further Maths", "Biology", "Chemistry", "Physics",
    "History", "Geography", "Politics", "Sociology", "Psychology",
    "English Literature", "Economics", "French",
  ];

  const y13StudentNames = [
    "Adeyemi Praise", "Akinoso Grace", "Amjad Javeria", "Ampofo Charlotte",
    "Asif Moaaz", "Atuegwu Ify", "Ayoola Abimbola", "Ayoola Abisola",
    "Bamiduro Adenike", "Birch Keira", "Botnaru Adrian", "Crawford Alec",
    "Dohal Pranay", "Durowoju Jordan", "E Steffi", "Ekunola Keyra",
    "Etwijer Dkhil Lama", "Gogoman Denisa", "Gyamfi Princessa", "Heysman Jocelyn",
    "Igbogbahaka Chisimdi", "Izuchukwu Sommie", "Jabang Lamin", "Kankam-Boadu Sharon",
    "Kazmi Aziza", "Khan Adnan", "Kiani Nusayba", "Mahabubul Nila",
    "Maimane Lwazi", "Migan Esther", "Mirza Shanzay", "Morris Jayden",
    "Musaddiq Rohaan", "Nwobu Angel", "Odubola Josiah", "Ojukwu Chinenye",
    "Okpoti-Paulo Claive", "Oriowo Michelle", "Rahman Jayan", "Saif Kazi Sidra",
    "Salifu Amira", "Salim Zawad", "Sampong Jessica", "Sendi Rihana",
    "Thomas Shayne Jacob", "Tolentino Summer", "Torchynovich Marharyta",
    "Vatavu Cosmin", "Vickers Jessica", "Wireko Asante",
  ];

  const y13Students: Array<{ id: string; ppFlag: boolean; sendFlag: boolean }> = [];
  for (let i = 0; i < y13StudentNames.length; i++) {
    const name = y13StudentNames[i];
    const upn = `D13${String(i + 1).padStart(3, "0")}`;
    const student = await prisma.student.upsert({
      where: { tenantId_upn: { tenantId: tenant.id, upn } },
      update: { fullName: name, yearGroup: "Y13" },
      create: {
        tenantId: tenant.id,
        upn,
        fullName: name,
        yearGroup: "Y13",
        ppFlag: i % 7 === 0,
        sendFlag: i % 12 === 0,
        status: "ACTIVE",
      },
    });
    y13Students.push({ id: student.id, ppFlag: student.ppFlag, sendFlag: student.sendFlag });
  }

  const aLevelCycle = await prisma.assessmentCycle.upsert({
    where: { tenantId_label: { tenantId: tenant.id, label: "Year 13 A-Level 2024/25" } },
    update: {},
    create: {
      tenantId: tenant.id,
      label: "Year 13 A-Level 2024/25",
      cohortLabel: "Year 13",
      qualificationType: "A_LEVEL",
      academicYear: "2024/25",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-07-31"),
      isActive: true,
      status: "active",
    },
  });

  const aLevelMock1 = await prisma.assessmentPoint.upsert({
    where: { tenantId_cycleId_label: { tenantId: tenant.id, cycleId: aLevelCycle.id, label: "Mock 1" } },
    update: {},
    create: {
      tenantId: tenant.id,
      cycleId: aLevelCycle.id,
      label: "Mock 1",
      shortLabel: "M1",
      ordinal: 1,
      pointType: "INTERNAL_MOCK",
      resultStatus: "PUBLISHED",
      isFinalPoint: false,
      comparisonEligible: true,
      assessedAt: new Date("2024-11-10"),
    },
  });

  const aLevelMock2 = await prisma.assessmentPoint.upsert({
    where: { tenantId_cycleId_label: { tenantId: tenant.id, cycleId: aLevelCycle.id, label: "Mock 2" } },
    update: {},
    create: {
      tenantId: tenant.id,
      cycleId: aLevelCycle.id,
      label: "Mock 2",
      shortLabel: "M2",
      ordinal: 2,
      pointType: "INTERNAL_MOCK",
      resultStatus: "PUBLISHED",
      isFinalPoint: false,
      comparisonEligible: true,
      assessedAt: new Date("2025-02-15"),
    },
  });

  // Assign ~3 A-Level subjects per student
  const studentSubjectMap = new Map<string, string[]>();
  for (const student of y13Students) {
    // Each student takes 3-4 subjects
    const numSubjects = 3 + (rng() < 0.25 ? 1 : 0);
    const shuffled = [...A_LEVEL_SUBJECTS].sort(() => rng() - 0.5);
    studentSubjectMap.set(student.id, shuffled.slice(0, numSubjects));
  }

  for (const point of [aLevelMock1, aLevelMock2]) {
    for (const subject of A_LEVEL_SUBJECTS) {
      const studentsForSubject = y13Students.filter((s) =>
        studentSubjectMap.get(s.id)?.includes(subject)
      );
      if (studentsForSubject.length === 0) continue;

      const assessment = await prisma.assessment.upsert({
        where: {
          id: `demo-alevel-${point.id}-${subject.replace(/\s+/g, "_").toLowerCase()}`,
        },
        update: {},
        create: {
          id: `demo-alevel-${point.id}-${subject.replace(/\s+/g, "_").toLowerCase()}`,
          tenantId: tenant.id,
          pointId: point.id,
          subject,
          yearGroup: "Y13",
          title: `${subject} — Y13 ${point.label}`,
          gradeFormat: "A_LEVEL",
          uploadStatus: "VALIDATED",
          entryCount: studentsForSubject.length,
          matchedStudentCount: studentsForSubject.length,
          createdByUserId: admin.id,
        },
      });

      for (const student of studentsForSubject) {
        const baseShift = student.ppFlag ? 1 : 0;
        const rawGrade = pickALevelGrade(baseShift);
        const isAbsent = rng() < 0.02;
        const rawValue = isAbsent ? "Absent" : rawGrade;
        const status = isAbsent ? "ABSENT" : "PRESENT";

        const A_LEVEL_SCORE: Record<string, number> = {
          "A*": 1.0, A: 6 / 7, B: 5 / 7, C: 4 / 7, D: 3 / 7, E: 2 / 7, U: 0,
        };
        const normalizedScore = isAbsent ? null : (A_LEVEL_SCORE[rawGrade] ?? null);

        await prisma.assessmentResult.upsert({
          where: {
            tenantId_assessmentId_studentId: {
              tenantId: tenant.id,
              assessmentId: assessment.id,
              studentId: student.id,
            },
          },
          update: { rawValue, normalizedScore, status },
          create: {
            tenantId: tenant.id,
            assessmentId: assessment.id,
            studentId: student.id,
            rawValue,
            normalizedScore,
            status,
          },
        });
      }
    }
  }
  console.log("  ✓  A-Level Year 13 assessment data seeded");

  // ── PERCENTAGE: Year 7 Assessment cycle ───────────────────────────────────
  console.log("  →  Seeding Year 7 percentage assessment data…");

  const y7Subjects = [
    "English", "Maths", "Science",
    "Geography", "History", "French",
    "RE", "Music", "Graphics", "Art",
  ];

  function pickPercentageScore(baseShift = 0): number {
    // Generates a percentage score with a rough bell curve centred ~60%
    const raw = 30 + rng() * 70 + baseShift * 5;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  const y7Cycle = await prisma.assessmentCycle.upsert({
    where: { tenantId_label: { tenantId: tenant.id, label: "Year 7 Assessment 2024/25" } },
    update: {},
    create: {
      tenantId: tenant.id,
      label: "Year 7 Assessment 2024/25",
      cohortLabel: "Year 7",
      qualificationType: "PERCENTAGE",
      academicYear: "2024/25",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-07-31"),
      isActive: true,
      status: "active",
    },
  });

  const y7Point1 = await prisma.assessmentPoint.upsert({
    where: { tenantId_cycleId_label: { tenantId: tenant.id, cycleId: y7Cycle.id, label: "Assessment 1" } },
    update: {},
    create: {
      tenantId: tenant.id,
      cycleId: y7Cycle.id,
      label: "Assessment 1",
      shortLabel: "A1",
      ordinal: 1,
      pointType: "INTERNAL_ASSESSMENT",
      resultStatus: "PUBLISHED",
      isFinalPoint: false,
      comparisonEligible: true,
      assessedAt: new Date("2024-11-22"),
    },
  });

  const y7Point2 = await prisma.assessmentPoint.upsert({
    where: { tenantId_cycleId_label: { tenantId: tenant.id, cycleId: y7Cycle.id, label: "Assessment 2" } },
    update: {},
    create: {
      tenantId: tenant.id,
      cycleId: y7Cycle.id,
      label: "Assessment 2",
      shortLabel: "A2",
      ordinal: 2,
      pointType: "INTERNAL_ASSESSMENT",
      resultStatus: "PUBLISHED",
      isFinalPoint: true,
      comparisonEligible: true,
      assessedAt: new Date("2025-03-14"),
    },
  });

  // Fetch Y7 students
  const y7Students = await prisma.student.findMany({
    where: { tenantId: tenant.id, yearGroup: "Y7" },
    select: { id: true, upn: true, fullName: true, ppFlag: true, sendFlag: true },
  });

  for (const point of [y7Point1, y7Point2]) {
    // Slight score improvement from A1 → A2
    const pointShift = point.ordinal === 2 ? 1 : 0;

    for (const subject of y7Subjects) {
      const isCoreSubject = ["English", "Maths", "Science"].includes(subject);
      // Optional subjects: ~85% of students enrolled
      const enrolledStudents = isCoreSubject
        ? y7Students
        : y7Students.filter(() => rng() > 0.15);

      const assessment = await prisma.assessment.upsert({
        where: {
          id: `demo-y7-${point.id}-${subject.replace(/\s+/g, "_").toLowerCase()}`,
        },
        update: {},
        create: {
          id: `demo-y7-${point.id}-${subject.replace(/\s+/g, "_").toLowerCase()}`,
          tenantId: tenant.id,
          pointId: point.id,
          subject,
          yearGroup: "Y7",
          title: `${subject} — Y7 ${point.label}`,
          gradeFormat: "PERCENTAGE",
          uploadStatus: "VALIDATED",
          entryCount: enrolledStudents.length,
          matchedStudentCount: enrolledStudents.length,
          createdByUserId: admin.id,
        },
      });

      for (const student of enrolledStudents) {
        const isAbsent = rng() < 0.05; // 5% absent rate
        const baseShift = student.ppFlag ? -1 : (student.sendFlag ? -0.5 : 0);
        const score = isAbsent ? null : pickPercentageScore(baseShift + pointShift);
        const rawValue = isAbsent ? "Absent" : `${score}%`;
        const normalizedScore = isAbsent || score === null ? null : score / 100;

        await prisma.assessmentResult.upsert({
          where: {
            tenantId_assessmentId_studentId: {
              tenantId: tenant.id,
              assessmentId: assessment.id,
              studentId: student.id,
            },
          },
          update: { rawValue, normalizedScore, status: isAbsent ? "ABSENT" : "PRESENT" },
          create: {
            tenantId: tenant.id,
            assessmentId: assessment.id,
            studentId: student.id,
            rawValue,
            normalizedScore,
            status: isAbsent ? "ABSENT" : "PRESENT",
          },
        });
      }
    }
  }
  console.log("  ✓  Year 7 percentage assessment data seeded");

  console.log(`
✅  Demo seed complete!

  Tenant:   Demo Academy  (id: ${DEMO_TENANT_ID})
  Admin:    admin@demo.school / Password123!
  SLT:      sarah.chen@demo.school / james.morrison@demo.school / patricia.okafor@demo.school
  Teachers: alice.thornton@demo.school … diana.osei@demo.school (Password123!)

  Patterns seeded:
  • 7 drifting teachers (RETRIEVAL, CFU, COLD_CALL drift down)
  • 2 improving teachers (RETRIEVAL, CFU trending up)
  • 1 low-coverage teacher (2 observations)
  • Year 9 cohort attendance drop (−2–4pp for ~60% of cohort)
  • Year 8 OnCall spike (15–30 students)
  • 15+ urgent students (attendance/onCalls/suspension triggers)
  • 10 LOA requests (mix Pending/Approved/Denied)
  • 20 OnCall events
  • 10 meetings + 30 actions (mix overdue/due soon)
  • Year 7 Assessment 2024/25 (% format, 10 subjects, 2 points: A1 Nov / A2 Mar)
`);
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const isReset = process.argv.includes("--reset");
  const prisma = new PrismaClient();
  seedDemo(prisma, isReset)
    .catch((e) => {
      console.error("❌  Demo seed failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
