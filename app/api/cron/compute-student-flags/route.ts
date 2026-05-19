import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeFlags } from "@/modules/students/flags";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const students = await (prisma as any).student.findMany({ include: { snapshots: { orderBy: { snapshotDate: "asc" } } } });
  let created = 0;

  for (const student of students as any[]) {
    const flags = computeFlags((student.snapshots || []).map((s: any) => ({
      snapshotDate: new Date(s.snapshotDate),
      attendancePct: Number(s.attendancePct),
      detentionsCount: s.detentionsCount,
      internalExclusionsCount: s.internalExclusionsCount,
      suspensionsCount: s.suspensionsCount,
      onCallsCount: s.onCallsCount,
      latenessCount: s.latenessCount
    })));

    if (!flags.length || !student.snapshots?.length) continue;

    const latestDate = new Date(student.snapshots[student.snapshots.length - 1].snapshotDate);
    const currentFrom = new Date(+latestDate - 7 * 24 * 3600 * 1000);
    const baselineFrom = new Date(+latestDate - 35 * 24 * 3600 * 1000);
    const baselineTo = new Date(+latestDate - 8 * 24 * 3600 * 1000);

    for (const flag of flags) {
      const duplicate = await (prisma as any).studentChangeFlag.findFirst({
        where: {
          tenantId: student.tenantId,
          studentId: student.id,
          flagKey: flag.flagKey,
          resolvedAt: null,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) }
        }
      });
      if (duplicate) continue;

      try {
        await (prisma as any).studentChangeFlag.create({
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

  return NextResponse.json({ created });
}
