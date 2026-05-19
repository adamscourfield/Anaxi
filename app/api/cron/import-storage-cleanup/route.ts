import { NextResponse } from "next/server";
import { deleteImportFile } from "@/lib/importStorage";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = Number(process.env.IMPORT_RETENTION_DAYS || "90");

/** Cron: delete stored import CSV files for jobs finished more than N days ago. */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const jobs = await (prisma as any).importJob.findMany({
    where: {
      storagePath: { not: null },
      finishedAt: { lte: cutoff },
      status: { in: ["SUCCESS", "FAILED", "COMPLETED"] },
    },
    select: { id: true, storagePath: true },
    take: 200,
  });

  let deleted = 0;
  for (const job of jobs) {
    if (!job.storagePath) continue;
    await deleteImportFile(job.storagePath);
    await (prisma as any).importJob.update({
      where: { id: job.id },
      data: { storagePath: null },
    });
    deleted++;
  }

  return NextResponse.json({
    retentionDays: RETENTION_DAYS,
    scanned: jobs.length,
    deleted,
    checkedAt: new Date().toISOString(),
  });
}
