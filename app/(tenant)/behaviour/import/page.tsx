import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SnapshotUploader } from "@/components/import/SnapshotUploader";
import { SnapshotImportHistory } from "@/components/import/SnapshotImportHistory";
import { PageHeader } from "@/components/ui/page-header";

export default async function BehaviourImportPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS_IMPORT");
  if (!hasPermission(user.role, "import:write")) redirect("/tenant");

  /* ── Fetch stats from the database ────────────────────────────── */
  const [totalRecords, jobs, totalJobs, prevTotalRecords] = await Promise.all([
    // Total student snapshot rows synced for this tenant
    (prisma as any).studentSnapshot.count({
      where: { tenantId: user.tenantId },
    }) as Promise<number>,
    // Recent import jobs for this tenant
    (prisma as any).importJob.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    // Total import job count
    (prisma as any).importJob.count({
      where: { tenantId: user.tenantId },
    }) as Promise<number>,
    // Snapshot count from 30 days ago for growth calculation
    (prisma as any).studentSnapshot.count({
      where: {
        tenantId: user.tenantId,
        createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }) as Promise<number>,
  ]);

  // Calculate growth percentage
  const growthPct = prevTotalRecords > 0
    ? Math.round(((totalRecords - prevTotalRecords) / prevTotalRecords) * 100)
    : 0;

  // Calculate integrity score: percentage of successful import jobs (from the fetched window)
  const jobsList = jobs as any[];
  const successfulJobs = jobsList.filter(
    (j: any) => j.status === "SUCCESS" || j.status === "COMPLETED",
  ).length;
  const integrityScore =
    jobsList.length > 0
      ? ((successfulJobs / jobsList.length) * 100).toFixed(1)
      : "100.0";

  // Serialize jobs for the client component
  const serializedJobs = jobsList.map((j: any) => ({
    id: j.id,
    type: j.type,
    status: j.status,
    fileName: j.fileName,
    rowCount: j.rowCount ?? 0,
    rowsProcessed: j.rowsProcessed ?? 0,
    rowsFailed: j.rowsFailed ?? 0,
    errorSummary: j.errorSummary ?? null,
    createdAt: j.createdAt?.toISOString?.() ?? new Date().toISOString(),
  }));

  return (
    <div className="space-y-8">
      <PageHeader variant="ledger"
        title="Import Student Snapshot Data"
        subtitle={
          <>
            Bulk synchronize student behavior and assessment records using standardized CSV snapshots.
            Ensure all headers match the institutional ledger template.
          </>
        }
      />

      <SnapshotUploader />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="home-hero-glass flex items-center justify-between gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] p-5 shadow-[var(--anx-elevated-shadow)] sm:p-6">
          <div className="min-w-0">
            <p className="anx-label-micro">
              Total Records Sync&apos;d
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-[2rem] font-bold leading-none tracking-[-0.03em] text-text tabular-nums sm:text-[2.25rem]">
                {totalRecords.toLocaleString()}
              </span>
              {growthPct !== 0 && (
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    growthPct > 0 ? "text-[var(--success)]" : "text-[var(--error)]"
                  }`}
                >
                  {growthPct > 0 ? "↗" : "↘"}
                  {Math.abs(growthPct)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
        </div>

        <div className="home-hero-glass flex items-center justify-between gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_16%,transparent)] p-5 shadow-[var(--anx-elevated-shadow)] sm:p-6">
          <div className="min-w-0">
            <p className="anx-label-micro">Integrity Score</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="text-[2rem] font-bold leading-none tracking-[-0.03em] text-text tabular-nums sm:text-[2.25rem]">
                {integrityScore}%
              </span>
              <span className="text-xs font-medium text-muted">Institutional Std</span>
            </div>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted ring-1 ring-[color-mix(in_srgb,var(--outline-variant)_20%,transparent)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11.25 14.25 15 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Recent Import History ──────────────────────────────────── */}
      <SnapshotImportHistory jobs={serializedJobs} total={totalJobs} />
    </div>
  );
}
