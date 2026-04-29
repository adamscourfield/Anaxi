import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { H2 } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DataTableEmpty } from "@/components/ui/data-table-empty";
import Link from "next/link";
import type { QualificationType, PointType } from "@prisma/client";
import { qualificationTypePillClasses } from "@/modules/assessments/attainmentColours";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUAL_LABELS: Record<QualificationType, string> = {
  GCSE: "GCSE",
  A_LEVEL: "A Level",
  PERCENTAGE: "Percentage",
  OTHER: "Other",
};

const QUAL_COLOURS = qualificationTypePillClasses;

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
    <div className="w-full space-y-10">
      <PageHeader
        eyebrow="Attainment"
        title="Cycles"
        subtitle="Track cohort-level outcomes across the academic year — from baselines through to final results."
        actions={
          <Link
            href="/assessments/new"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[0.75rem] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] px-5 py-2.5 text-sm font-semibold tracking-[0.01em] text-[var(--on-primary)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] calm-transition hover:opacity-90 active:scale-[0.98]"
          >
            New cycle
          </Link>
        }
      />

      {cycles.length === 0 && (
        <Card className="overflow-hidden p-0">
          <DataTableEmpty
            title="No attainment cycles yet"
            description="Create a cycle for a cohort to start tracking attainment across the academic year."
            action={
              <Link
                href="/assessments/new"
                className="inline-flex items-center justify-center gap-2 rounded-[0.75rem] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] px-5 py-2.5 text-sm font-semibold tracking-[0.01em] text-[var(--on-primary)] shadow-[0_4px_16px_rgba(0,0,0,0.12)] calm-transition hover:opacity-90 active:scale-[0.98]"
              >
                Create your first cycle
              </Link>
            }
          />
        </Card>
      )}

      {/* Active cycles */}
      {activeCycles.length > 0 && (
        <section className="space-y-3">
          <H2>Active Cycles</H2>
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
          <H2>Archived Cycles</H2>
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
      className="group block relative overflow-hidden rounded-2xl glass-card p-5 calm-transition hover:border-[var(--accent)]/40 hover:shadow-lg"
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
