import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DataTableEmpty } from "@/components/ui/data-table-empty";
import { Button } from "@/components/ui/button";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import { getProgress8DashboardSummary } from "@/modules/assessments/progress8";
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
  points: Array<{ assessments: Array<{ subject: string }> }>;
}): number {
  const subjects = new Set<string>();
  for (const p of cycle.points) {
    for (const a of p.assessments) subjects.add(a.subject);
  }
  return subjects.size;
}

// ─── Cycle table ─────────────────────────────────────────────────────────────

type CycleRow = {
  id: string;
  label: string;
  cohortLabel: string;
  qualificationType: QualificationType;
  academicYear: string;
  isActive: boolean;
  points: Array<{
    id: string;
    pointType: PointType;
    assessments: Array<{ subject: string; entryCount: number; matchedStudentCount: number }>;
  }>;
};

function CycleTable({ cycles, emptyLabel }: { cycles: CycleRow[]; emptyLabel: string }) {
  if (cycles.length === 0) {
    return <p className="text-sm text-[var(--on-surface-muted)]">{emptyLabel}</p>;
  }
  return (
    <div className="table-shell">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="table-head-row">
              <th className="px-5 py-3 text-left">Cycle</th>
              <th className="px-4 py-3 text-left">Cohort</th>
              <th className="px-4 py-3 text-right">Points</th>
              <th className="px-4 py-3 text-right">Subjects</th>
              <th className="px-5 py-3 text-right">Entries</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((cycle) => {
              const entries = totalEntries(cycle);
              const subjects = totalSubjects(cycle);
              return (
                <tr
                  key={cycle.id}
                  className={`table-row group ${!cycle.isActive ? "opacity-75 bg-[var(--surface-container-low)]/40" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/assessments/${cycle.id}`}
                      className="flex items-center gap-2.5 group/link"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${QUAL_COLOURS[cycle.qualificationType]}`}>
                            {QUAL_LABELS[cycle.qualificationType]}
                          </span>
                          {cycle.isActive ? (
                            <span className="rounded bg-[var(--pill-success-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--pill-success-text)] ring-1 ring-inset ring-[var(--pill-success-ring)]">
                              Active
                            </span>
                          ) : (
                            <span className="rounded bg-[var(--surface-container-high)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-muted)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)]">
                              Archived
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-[var(--on-surface)] group-hover/link:text-[var(--accent)] calm-transition">
                          {cycle.label}
                        </span>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-[var(--on-surface-muted)]">
                    {cycle.cohortLabel || <span className="text-[var(--on-surface-muted)]/40">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[var(--on-surface)]">
                    {cycle.points.length}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums text-[var(--on-surface-muted)]">
                    {subjects}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-[var(--on-surface-muted)]">
                    {entries > 0 ? entries.toLocaleString() : <span className="text-[var(--on-surface-muted)]/40">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
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

  const totalActive = activeCycles.length;
  const totalSubjectsAll = new Set(
    cycles.flatMap((c) => c.points.flatMap((p) => p.assessments.map((a) => a.subject))),
  ).size;
  const totalEntriesAll = cycles.reduce(
    (s, c) => s + c.points.reduce((ss, p) => ss + p.assessments.reduce((sss, a) => sss + a.entryCount, 0), 0),
    0,
  );
  const progress8Summary = await getProgress8DashboardSummary(user.tenantId);

  return (
    <AttainmentPageShell>
      <PageHeader
        variant="ledger"
        className="!mb-0 border-0 !pb-0"
        eyebrowClassName="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted"
        eyebrow="Attainment"
        titleClassName="text-[1.75rem] font-bold tracking-tight text-text md:text-[2rem]"
        subtitleClassName="max-w-3xl text-[0.9375rem] font-medium leading-relaxed text-muted"
        title="Cycles"
        subtitle="Attainment cycles and grade imports — track cohort outcomes from baseline through to final results."
        actions={
          <Button
            asChild
            className="h-10 min-h-0 rounded-sm border border-border bg-[var(--on-surface)] px-5 text-sm font-semibold text-[var(--surface-bright)] shadow-none hover:bg-[var(--on-surface)]/90 hover:opacity-95"
          >
            <Link href="/assessments/new" className="gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              New cycle
            </Link>
          </Button>
        }
      />

      {cycles.length > 0 && (
        <Card className="flex flex-col gap-3 border border-border bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">Dual-flagged students</p>
            <p className="mt-0.5 text-sm text-muted">
              Students with high pastoral risk and low attainment — highest priority for intervention.
            </p>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link href="/assessments/triangulation">View triangulation</Link>
          </Button>
        </Card>
      )}

      {cycles.length === 0 && (
        <Card className="overflow-hidden p-0">
          <DataTableEmpty
            title="No attainment cycles yet"
            description="Create a cycle for a cohort to start tracking attainment across the academic year."
            action={
              <Button asChild>
                <Link href="/assessments/new">Create your first cycle</Link>
              </Button>
            }
          />
        </Card>
      )}

      {/* Active cycles */}
      {activeCycles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-muted)]">
            Active Cycles
          </h2>
          <Card className="overflow-hidden p-0">
            <CycleTable cycles={activeCycles} emptyLabel="No active cycles" />
          </Card>
        </section>
      )}

      {/* Archived cycles */}
      {archivedCycles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-muted)]">
            Archived Cycles
          </h2>
          <Card className="overflow-hidden p-0">
            <CycleTable cycles={archivedCycles} emptyLabel="No archived cycles" />
          </Card>
        </section>
      )}

      {(activeCycles.length > 0 || archivedCycles.length > 0) && (
        <div className="flex flex-col gap-5 rounded-sm border border-border bg-surface-container-lowest p-5 shadow-none sm:flex-row sm:items-center sm:gap-0 sm:p-0">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:p-5">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l4-4 4 4 6-8" />
              </svg>
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">All cycles</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-text">{totalActive} active</p>
            </div>
          </div>
          <div className="hidden h-10 w-px shrink-0 bg-[var(--outline-variant)] sm:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:p-5">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Total subjects</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-text">{totalSubjectsAll}</p>
            </div>
          </div>
          <div className="hidden h-10 w-px shrink-0 bg-[var(--outline-variant)] sm:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:p-5">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Total entries</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-text">{totalEntriesAll.toLocaleString()}</p>
            </div>
          </div>
          <div className="hidden h-10 w-px shrink-0 bg-[var(--outline-variant)] sm:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:p-5">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 18h16" strokeLinecap="round" />
                <path d="M7 15l3-3 3 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Predicted Progress 8</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-text">
                {progress8Summary?.averagePredictedProgress8 !== null && progress8Summary?.averagePredictedProgress8 !== undefined
                  ? `${progress8Summary.averagePredictedProgress8 > 0 ? "+" : ""}${progress8Summary.averagePredictedProgress8.toFixed(2)}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </AttainmentPageShell>
  );
}
