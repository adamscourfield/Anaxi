import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import type { QualificationType, PointType } from "@prisma/client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const QUAL_LABELS: Record<QualificationType, string> = {
  GCSE: "GCSE",
  A_LEVEL: "A Level",
  VOCATIONAL: "Vocational",
  OTHER: "Other",
};

const QUAL_COLOURS: Record<QualificationType, string> = {
  GCSE: "bg-blue-100 text-blue-700",
  A_LEVEL: "bg-violet-100 text-violet-700",
  VOCATIONAL: "bg-emerald-100 text-emerald-700",
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

  const activeCycles = cycles.filter((c) => c.status === "active" && c.isActive);
  const archivedCycles = cycles.filter((c) => c.status === "archived" || !c.isActive);

  return (
    <div className="max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <PageHeader
          title="Attainment Cycles"
          subtitle="Track cohort-level outcomes across the academic year — from baselines through to final results."
        />
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
            Active
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
            Archived
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
      className="group block rounded-2xl bg-[var(--surface)] p-5 shadow-sm ring-1 ring-[var(--outline-variant)]/30 transition-all hover:ring-[var(--accent)]/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${QUAL_COLOURS[cycle.qualificationType]}`}>
              {QUAL_LABELS[cycle.qualificationType]}
            </span>
            {cycle.isActive && cycle.status === "active" && (
              <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                Active
              </span>
            )}
          </div>
          <h3 className="mt-2 text-base font-semibold text-[var(--on-surface)] group-hover:text-[var(--accent)]">
            {cycle.label}
          </h3>
          {cycle.cohortLabel && (
            <p className="text-xs text-[var(--on-surface-muted)]">{cycle.cohortLabel}</p>
          )}
        </div>
        <span className="shrink-0 text-sm text-[var(--on-surface-muted)] group-hover:text-[var(--accent)]">
          →
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
            Result points
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--on-surface)]">
            {cycle.points.length}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
            Subjects
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--on-surface)]">
            {subjectCount}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--surface-container-low)] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
            Entries
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-[var(--on-surface)]">
            {entries.toLocaleString()}
          </p>
        </div>
      </div>

      {!hasData && (
        <p className="mt-3 text-xs text-[var(--on-surface-muted)]">
          No results uploaded yet
        </p>
      )}
    </Link>
  );
}
