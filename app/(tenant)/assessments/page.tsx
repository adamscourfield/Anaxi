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
        eyebrowClassName="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[#6B7280]"
        eyebrow="Attainment"
        titleClassName="text-[1.75rem] font-bold tracking-tight text-[#111827] md:text-[2rem]"
        subtitleClassName="max-w-3xl text-[0.9375rem] font-medium leading-relaxed text-[#374151]"
        title="Cycles"
        subtitle="Track cohort-level outcomes across the academic year — from baselines through to final results."
        actions={
          <Button
            asChild
            className="h-10 min-h-0 rounded-[0.625rem] border-0 bg-[#111827] px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:bg-[#111827]/90 hover:opacity-95"
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
        <section className="space-y-5">
          <h2 className="text-lg font-bold tracking-tight text-[#111827]">Active Cycles</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {activeCycles.map((cycle) => (
              <CycleCard key={cycle.id} cycle={cycle} />
            ))}
          </div>
        </section>
      )}

      {/* Archived cycles */}
      {archivedCycles.length > 0 && (
        <section className="space-y-5">
          <h2 className="text-lg font-bold tracking-tight text-[#111827]">Archived Cycles</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {archivedCycles.map((cycle) => (
              <CycleCard key={cycle.id} cycle={cycle} />
            ))}
          </div>
        </section>
      )}

      {(activeCycles.length > 0 || archivedCycles.length > 0) && (
        <div className="flex flex-col gap-6 rounded-xl border border-[color-mix(in_srgb,#e5e7eb_90%,transparent)] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-600 [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l4-4 4 4 6-8" />
              </svg>
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">All cycles</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-[#111827]">{totalActive} active</p>
            </div>
          </div>
          <div className="hidden h-10 w-px shrink-0 bg-[#e5e7eb] sm:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Total subjects</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-[#111827]">{totalSubjectsAll}</p>
            </div>
          </div>
          <div className="hidden h-10 w-px shrink-0 bg-[#e5e7eb] sm:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-600 [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Total entries</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-[#111827]">{totalEntriesAll.toLocaleString()}</p>
            </div>
          </div>
          <div className="hidden h-10 w-px shrink-0 bg-[#e5e7eb] sm:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600 [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 18h16" strokeLinecap="round" />
                <path d="M7 15l3-3 3 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">Predicted Progress 8</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-[#111827]">
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

  const accentKey = String(cycle.qualificationType);
  const accentBar =
    accentKey === "GCSE"
      ? "bg-[var(--cat-blue-text)]"
      : accentKey === "A_LEVEL"
        ? "bg-[var(--cat-violet-text)]"
        : accentKey === "PERCENTAGE"
          ? "bg-[var(--status-approved-text)]"
          : "bg-muted";

  const cardToneClass =
    accentKey === "GCSE"
      ? "anx-attainment-cycle-card--gcse"
      : accentKey === "A_LEVEL"
        ? "anx-attainment-cycle-card--alevel"
        : accentKey === "PERCENTAGE"
          ? "anx-attainment-cycle-card--pct"
          : "";

  return (
    <Link
      href={`/assessments/${cycle.id}`}
      className={`anx-attainment-cycle-card group relative block overflow-hidden rounded-2xl border border-[color-mix(in_srgb,#e5e7eb_90%,transparent)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-12px_rgba(15,23,42,0.08)] calm-transition hover:border-[#d1d5db] hover:shadow-[0_16px_48px_-16px_rgba(15,23,42,0.1)] ${cardToneClass}`}
    >
      <div className="anx-attainment-wave" aria-hidden />
      <div className={`relative z-[1] h-1 w-full ${accentBar}`} aria-hidden />
      <div className="relative z-10 flex items-start justify-between gap-3 p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${QUAL_COLOURS[cycle.qualificationType]}`}>
              {QUAL_LABELS[cycle.qualificationType]}
            </span>
            {cycle.isActive ? (
              <span className="rounded-md bg-[var(--pill-success-bg)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--pill-success-text)] ring-1 ring-inset ring-[var(--pill-success-ring)]">
                Active
              </span>
            ) : (
              <span className="rounded-md bg-[var(--surface-container-high)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted ring-1 ring-inset ring-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)]">
                Archived
              </span>
            )}
          </div>
          <h3 className="mt-3 text-lg font-bold tracking-tight text-[#111827] group-hover:opacity-90 calm-transition">
            {cycle.label}
          </h3>
          {cycle.cohortLabel && (
            <p className="mt-0.5 text-sm text-[#6B7280]">{cycle.cohortLabel}</p>
          )}
        </div>
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[color-mix(in_srgb,var(--outline-variant)_35%,transparent)] bg-[var(--surface-container-low)] text-text shadow-sm calm-transition group-hover:border-text/20 group-hover:bg-[var(--surface-container)]"
          aria-hidden
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-px border-t border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] bg-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)]">
        <CycleMetric label="Points" value={cycle.points.length} icon="star" tone={accentKey} />
        <CycleMetric label="Subjects" value={subjectCount} icon="book" tone={accentKey} />
        <CycleMetric label="Entries" value={entries.toLocaleString()} icon="doc" tone={accentKey} />
      </div>

      {!hasData && (
        <p className="border-t border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted sm:px-6">
          No results uploaded yet
        </p>
      )}
    </Link>
  );
}

function CycleMetric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: "star" | "book" | "doc";
  tone: string;
}) {
  const well =
    tone === "GCSE"
      ? "bg-[var(--cat-blue-bg)] text-[var(--cat-blue-text)]"
      : tone === "A_LEVEL"
        ? "bg-[var(--cat-violet-bg)] text-[var(--cat-violet-text)]"
        : tone === "PERCENTAGE"
          ? "bg-[var(--status-approved-light)] text-[var(--status-approved-text)]"
          : "bg-[var(--surface-container)] text-muted";

  return (
    <div className="flex flex-col items-center bg-[var(--surface-container-lowest)] px-2 py-4 text-center sm:py-5">
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-md [&_svg]:h-[18px] [&_svg]:w-[18px] ${well}`}
        aria-hidden
      >
        {icon === "star" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path strokeLinejoin="round" d="M12 3.5l1.8 5.7h5.9l-4.8 3.6 1.8 5.6L12 15.9l-4.7 3.5 1.8-5.6-4.8-3.6h5.9L12 3.5Z" />
          </svg>
        )}
        {icon === "book" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path strokeLinejoin="round" d="M4 6.75A2.75 2.75 0 016.75 4h4.5v16H6.75A2.75 2.75 0 014 18.25V6.75zm16 0A2.75 2.75 0 0017.25 4h-4.5v16h4.5A2.75 2.75 0 0020 18.25V6.75z" />
          </svg>
        )}
        {icon === "doc" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
            <path strokeLinecap="round" d="M14 2v6h6M9 13h6M9 17h4" />
          </svg>
        )}
      </span>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-text sm:text-2xl">{value}</p>
    </div>
  );
}
