import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import Link from "next/link";
import type { QualificationType, PointType } from "@prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUAL_LABELS: Record<QualificationType, string> = {
  GCSE: "GCSE",
  A_LEVEL: "A Level",
  PERCENTAGE: "Percentage",
  OTHER: "Other",
};

const QUAL_COLOURS: Record<QualificationType, string> = {
  GCSE: "bg-blue-100 text-blue-700",
  A_LEVEL: "bg-violet-100 text-violet-700",
  PERCENTAGE: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
};

function totalEntries(cycle: {
  points: Array<{ assessments: Array<{ entryCount: number }> }>;
}): number {
  return cycle.points.reduce(
    (s, p) => s + p.assessments.reduce((ss, a) => ss + a.entryCount, 0),
    0
  );
}

function totalSubjects(cycle: {
  points: Array<{ assessments: Array<unknown> }>;
}): number {
  const subjects = new Set<string>();
  return cycle.points.reduce((s, p) => s + p.assessments.length, 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default async function AssessmentsPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const cycles = await prisma.assessmentCycle.findMany({
    where: { tenantId: user.tenantId },
    include: {
      points: {
        orderBy: { ordinal: "asc" },
        include: {
          assessments: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
  });

  const activeCycles = cycles.filter((c) => c.isActive);
  const archivedCycles = cycles.filter((c) => !c.isActive);

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--on-surface)] sm:text-[28px]">
            Attainment Cycles
          </h1>
          <p className="mt-1 text-sm text-[var(--on-surface-muted)]">
            Track cohort-level outcomes across the academic year — from baselines through to final results.
          </p>
        </div>
        <Link
          href="/assessments/new"
          className="shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          New cycle
        </Link>
      </div>

      {cycles.length === 0 && (
        <Card className="py-16 text-center">
          <p className="text-lg font-medium text-[var(--on-surface)]">No attainment cycles yet</p>
          <p className="mt-2 text-sm text-[var(--on-surface-muted)]">
            Create a cycle for a cohort to start tracking attainment across the academic year.
          </p>
          <Link
            href="/assessments/new"
            className="mt-5 inline-block rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white"
          >
            Create your first cycle
          </Link>
        </Card>
      )}

      {/* Active cycles */}
      {activeCycles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[1rem] font-bold tracking-[-0.01em] text-[var(--on-surface)]">
            Active Cycles
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeCycles.map((cycle) => (
              <CycleCard key={cycle.id} cycle={cycle} />
            ))}
          </div>
        </section>
      )}

      {/* Archived cycles */}
      {archivedCycles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[1rem] font-bold tracking-[-0.01em] text-[var(--on-surface)]">
            Archived Cycles
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {archivedCycles.map((cycle) => (
              <CycleCard key={cycle.id} cycle={cycle} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CycleCard({ cycle }: {
  cycle: {
    id: string;
    label: string;
    cohortLabel: string;
    qualificationType: QualificationType;
    academicYear: string;
    isActive: boolean;
    status: string;
    points: Array<{
      id: string;
      label: string;
      pointType: PointType;
      assessments: Array<{ subject: string; entryCount: number; matchedStudentCount: number }>;
    }>;
  };
}) {
  const entries = totalEntries(cycle);
  const subjectCount = new Set(cycle.points.flatMap((p) => p.assessments.map((a) => a.subject))).size;
  const hasData = entries > 0;

  return (
    <Link
      href={`/assessments/${cycle.id}`}
      className="group block relative overflow-hidden rounded-2xl glass-card p-5 calm-transition hover:border-[var(--accent)]/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${QUAL_COLOURS[cycle.qualificationType]}`}>
              {QUAL_LABELS[cycle.qualificationType]}
            </span>
            {cycle.isActive && (
              <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--success)]">
                Active
              </span>
            )}
          </div>
          <h3 className="mt-3 text-lg font-bold tracking-[-0.01em] text-[var(--on-surface)] group-hover:text-[var(--accent)] calm-transition">
            {cycle.label}
          </h3>
          {cycle.cohortLabel && (
            <p className="mt-0.5 text-xs text-[var(--on-surface-muted)]">{cycle.cohortLabel}</p>
          )}
        </div>
        <span className="shrink-0 text-lg text-[var(--on-surface-muted)] group-hover:translate-x-0.5 group-hover:text-[var(--accent)] calm-transition">
          →
        </span>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 relative z-10">
        <StatCard label="Points" value={cycle.points.length} tone="softGrey" />
        <StatCard label="Subjects" value={subjectCount} tone="softGrey" />
        <StatCard label="Entries" value={entries.toLocaleString()} tone="softGrey" />
      </div>

      {!hasData && (
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--on-surface-muted)]">
          No results uploaded yet
        </p>
      )}
    </Link>
  );
}
