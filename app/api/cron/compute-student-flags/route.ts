import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cronAuth";
import { prisma } from "@/lib/prisma";
import { computeFlags } from "@/modules/students/flags";

const BATCH_SIZE = 100;

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
      const flags = computeFlags(
        student.snapshots.map((s) => ({
          snapshotDate: new Date(s.snapshotDate),
          attendancePct: Number(s.attendancePct),
          detentionsCount: s.detentionsCount,
          internalExclusionsCount: s.internalExclusionsCount,
          suspensionsCount: s.suspensionsCount,
          onCallsCount: s.onCallsCount,
          latenessCount: s.latenessCount,
        })),
      );

      if (!flags.length || !student.snapshots.length) continue;

      const latestDate = new Date(student.snapshots[student.snapshots.length - 1].snapshotDate);
      const currentFrom = new Date(+latestDate - 7 * 24 * 3600 * 1000);
      const baselineFrom = new Date(+latestDate - 35 * 24 * 3600 * 1000);
      const baselineTo = new Date(+latestDate - 8 * 24 * 3600 * 1000);

      for (const flag of flags) {
        const duplicate = await prisma.studentChangeFlag.findFirst({
          where: {
            tenantId: student.tenantId,
            studentId: student.id,
            flagKey: flag.flagKey,
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
              flagKey: flag.flagKey,
              severity: flag.severity,
              baselineFrom,
              baselineTo,
              currentFrom,
              currentTo: latestDate,
              detailsJson: flag.details,
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

    cursor = students[students.length - 1].id;
    if (students.length < BATCH_SIZE) break;
  }

  return NextResponse.json({ created, scanned });
}

/** Vercel Cron always triggers via GET. */
export const GET = POST;
