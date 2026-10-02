import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";
import { computeFlags, FLAG_WINDOW_OPTIONS_DAYS } from "@/modules/students/flags";

const BATCH_SIZE = 100;

/** Flags are computed per rolling window; the window is folded into the key so a
 * 7-day spike and a 28-day spike on the same metric don't dedupe each other out. */
function windowedFlagKey(flagKey: string, windowDays: number): string {
  return `${flagKey}_${windowDays}D`;
}

export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  let created = 0;
  let scanned = 0;
  let cursor: string | undefined;

  for (;;) {
    const students = await prisma.student.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      include: { snapshots: { orderBy: { snapshotDate: "asc" } } },
    });

    if (!students.length) break;

    for (const student of students) {
      scanned += 1;
      if (!student.snapshots.length) continue;

      const snapshotMetrics = student.snapshots.map((s) => ({
        snapshotDate: new Date(s.snapshotDate),
        attendancePct: Number(s.attendancePct),
        detentionsCount: s.detentionsCount,
        internalExclusionsCount: s.internalExclusionsCount,
        suspensionsCount: s.suspensionsCount,
        onCallsCount: s.onCallsCount,
        latenessCount: s.latenessCount,
      }));
      const latestDate = new Date(student.snapshots[student.snapshots.length - 1].snapshotDate);

      for (const windowDays of FLAG_WINDOW_OPTIONS_DAYS) {
        const flags = computeFlags(snapshotMetrics, windowDays);
        if (!flags.length) continue;

        const currentFrom = new Date(+latestDate - windowDays * 24 * 3600 * 1000);
        const baselineFrom = new Date(+latestDate - 5 * windowDays * 24 * 3600 * 1000);
        const baselineTo = new Date(+latestDate - (windowDays + 1) * 24 * 3600 * 1000);

        for (const flag of flags) {
          const flagKey = windowedFlagKey(flag.flagKey, windowDays);
          const duplicate = await prisma.studentChangeFlag.findFirst({
            where: {
              tenantId: student.tenantId,
              studentId: student.id,
              flagKey,
              resolvedAt: null,
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
            },
          });
          if (duplicate) continue;

          try {
            await prisma.studentChangeFlag.create({
              data: {
                tenantId: student.tenantId,
                studentId: student.id,
                flagKey,
                severity: flag.severity,
                baselineFrom,
                baselineTo,
                currentFrom,
                currentTo: latestDate,
                detailsJson: { ...flag.details, windowDays },
              },
            });
            created += 1;
          } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code === "P2002") continue;
            throw err;
          }
        }
      }
    }

    cursor = students[students.length - 1].id;
    if (students.length < BATCH_SIZE) break;
  }

  return NextResponse.json({ created, scanned });
}

/** Vercel Cron always triggers via GET. */
export const GET = POST;
