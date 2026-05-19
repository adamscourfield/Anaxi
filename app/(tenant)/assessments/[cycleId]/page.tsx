import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTableEmpty } from "@/components/ui/data-table-empty";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import { Card } from "@/components/ui/card";
import type { PointType, ResultStatus, QualificationType } from "@prisma/client";
import { pointTypePillClasses } from "@/modules/assessments/attainmentColours";
import { CycleArchiveControl } from "@/components/assessments/CycleArchiveControl";
import { CycleCompareLink } from "@/components/assessments/CycleCompareLink";
import { ResultPointStatusControl } from "@/components/assessments/ResultPointStatusControl";

// ─── Type badges ─────────────────────────────────────────────────────────────

const POINT_TYPE_LABELS: Record<PointType, string> = {
  BASELINE: "Baseline",
  INTERNAL_ASSESSMENT: "Internal Assessment",
  INTERNAL_MOCK: "Internal Mock",
  TEACHER_PREDICTION: "Teacher Prediction",
  EXTERNAL_FINAL: "External Final",
  OTHER: "Other",
};

const POINT_TYPE_COLOURS = pointTypePillClasses;

const QUAL_LABELS: Record<QualificationType, string> = {
  GCSE: "GCSE",
  A_LEVEL: "A Level",
  PERCENTAGE: "Percentage",
  OTHER: "Other",
};

function formatAssessedDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Icons (inline SVG — no icon dependency) ──────────────────────────────────

function IconTarget({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </svg>
  );
}

function IconBook({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrend({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m7 14 4-4 4 4 6-6" />
    </svg>
  );
}

function IconShieldCheck({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconCalendar({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconUploadCloud({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v9m-4-4 4-4 4 4" />
    </svg>
  );
}

function IconBarChart({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function IconDocument({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
    </svg>
  );
}

function IconUsers({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  );
}


function sumPointEntries(point: {
  assessments: Array<{ entryCount: number }>;
}): number {
  return point.assessments.reduce((s, a) => s + a.entryCount, 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;

  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const cycle = await prisma.assessmentCycle.findFirst({
    where: { id: cycleId, tenantId: user.tenantId },
    include: {
      points: {
        orderBy: { ordinal: "asc" },
        include: {
          assessments: {
            select: {
              id: true,
              subject: true,
              yearGroup: true,
              gradeFormat: true,
              uploadStatus: true,
              entryCount: true,
              matchedStudentCount: true,
              expectedStudentCount: true,
              rawFileName: true,
            },
          },
        },
      },
    },
  });

  if (!cycle) notFound();

  const pointIds = cycle.points.map((p) => p.id);
  const [integrityTotal, integrityValid] =
    pointIds.length === 0
      ? [0, 0]
      : await Promise.all([
          prisma.assessmentResult.count({
            where: { tenantId: user.tenantId, assessment: { pointId: { in: pointIds } } },
          }),
          prisma.assessmentResult.count({
            where: {
              tenantId: user.tenantId,
              isValid: true,
              assessment: { pointId: { in: pointIds } },
            },
          }),
        ]);
  const integrityPct =
    integrityTotal === 0 ? null : Math.round((integrityValid / integrityTotal) * 1000) / 10;
  const integrityDisplay = integrityPct !== null ? `${integrityPct.toFixed(1)}%` : "—";

  const totalEntries = cycle.points.reduce(
    (s, p) => s + p.assessments.reduce((ss, a) => ss + a.entryCount, 0),
    0
  );
  const totalSubjects = new Set(
    cycle.points.flatMap((p) => p.assessments.map((a) => a.subject))
  ).size;

  const sortedPoints = [...cycle.points].sort(
    (a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0),
  );
  let priorTotalEntries = 0;
  if (sortedPoints.length >= 2) {
    priorTotalEntries = sumPointEntries(sortedPoints[sortedPoints.length - 2]!);
  }
  const entriesTrendPct =
    priorTotalEntries > 0
      ? Math.round(((totalEntries - priorTotalEntries) / priorTotalEntries) * 100)
      : totalEntries > 0
        ? 100
        : 0;
  const entriesTrendLabel =
    priorTotalEntries > 0
      ? `${entriesTrendPct >= 0 ? "↗" : "↘"} ${entriesTrendPct >= 0 ? "+" : ""}${entriesTrendPct}% vs prior point`
      : sortedPoints.length < 2
        ? "Add a prior point to see trend"
        : "First data in cycle";

  return (
    <AttainmentPageShell>
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: cycle.label },
        ]}
      />

      <PageHeader
        variant="ledger"
        className="!mb-0 border-0 !pb-0"
        eyebrowClassName="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted"
        eyebrow="Attainment cycle"
        titleClassName="text-[1.75rem] font-bold tracking-tight text-text md:text-[2rem]"
        subtitleClassName="max-w-3xl text-[0.9375rem] font-medium leading-relaxed text-muted"
        title={cycle.label}
        subtitle={
          cycle.cohortLabel
            ? `${cycle.cohortLabel} · ${cycle.academicYear}`
            : cycle.academicYear
        }
        meta={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <IconCalendar className="h-4 w-4 shrink-0 text-muted" />
              {cycle.cohortLabel ?? "Cohort"} · {cycle.academicYear}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconBarChart className="h-4 w-4 shrink-0 text-muted" />
              {QUAL_LABELS[cycle.qualificationType]} · {cycle.points.length} result point
              {cycle.points.length !== 1 ? "s" : ""}
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CycleCompareLink
              cycleId={cycle.id}
              points={cycle.points.map((p) => ({
                id: p.id,
                entryCount: p.assessments.reduce((s, a) => s + a.entryCount, 0),
              }))}
            />
            <CycleArchiveControl cycleId={cycle.id} isActive={cycle.isActive} />
            <Button asChild>
              <Link href={`/assessments/${cycle.id}/points/new`}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Add point
              </Link>
            </Button>
          </div>
        }
      />

      {/* Overview — compact stat strip */}
      <div className="flex flex-col gap-5 rounded-sm border border-border bg-surface-container-lowest p-5 shadow-none sm:flex-row sm:items-center sm:gap-0 sm:p-0">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75]" aria-hidden>
            <IconTarget />
          </span>
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Result points</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-text">{cycle.points.length}</p>
          </div>
        </div>
        <div className="hidden h-10 w-px shrink-0 bg-[var(--outline-variant)] sm:block" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75]" aria-hidden>
            <IconBook />
          </span>
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Total subjects</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-text">{totalSubjects}</p>
          </div>
        </div>
        <div className="hidden h-10 w-px shrink-0 bg-[var(--outline-variant)] sm:block" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75]" aria-hidden>
            <IconTrend />
          </span>
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Entries recorded</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-text">{totalEntries.toLocaleString()}</p>
            <p className={`mt-0.5 text-[0.75rem] font-semibold ${entriesTrendPct >= 0 ? "text-[var(--status-approved-text)]" : "text-[var(--status-denied-text)]"}`}>{entriesTrendLabel}</p>
          </div>
        </div>
        <div className="hidden h-10 w-px shrink-0 bg-[var(--outline-variant)] sm:block" aria-hidden />
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container-low)] text-muted [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:stroke-[1.75]" aria-hidden>
            <IconShieldCheck />
          </span>
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted">Data integrity</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-text">{integrityDisplay}</p>
            <p className="mt-0.5 text-[0.75rem] text-muted">Rows marked present</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-muted)]">Result Points</h2>
          <div className="flex flex-wrap items-center gap-2">
            <CycleCompareLink
              cycleId={cycle.id}
              points={cycle.points.map((p) => ({
                id: p.id,
                entryCount: p.assessments.reduce((s, a) => s + a.entryCount, 0),
              }))}
            />
            <Button asChild variant="secondary" className="h-8 py-0 text-xs">
              <Link href={`/assessments/${cycle.id}/points/new`}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Add point
              </Link>
            </Button>
          </div>
        </div>

        {cycle.points.length === 0 ? (
          <Card className="overflow-hidden rounded-sm border border-border bg-surface-container-lowest p-0 shadow-none">
            <DataTableEmpty
              title="No result points yet"
              description="Add a baseline, mock, or final results snapshot to start recording grades for this cycle."
              action={
                <Link
                  href={`/assessments/${cycle.id}/points/new`}
                  className="link-accent text-sm font-semibold underline-offset-2"
                >
                  Add the first result point
                </Link>
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="table-shell border-0 rounded-none shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="table-head-row">
                      <th className="w-8 px-5 py-3 text-center">#</th>
                      <th className="px-4 py-3 text-left">Point</th>
                      <th className="hidden px-4 py-3 text-left sm:table-cell">Date</th>
                      <th className="hidden px-4 py-3 text-left lg:table-cell">Subjects</th>
                      <th className="px-4 py-3 text-right">Entries</th>
                      <th className="px-4 py-3 text-right">Students</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycle.points.map((point, idx) => {
                      const entries = point.assessments.reduce((s, a) => s + a.entryCount, 0);
                      const matched = point.assessments.reduce((s, a) => s + a.matchedStudentCount, 0);
                      const hasData = entries > 0;
                      const assessedDateLabel = formatAssessedDate(point.assessedAt);
                      const ordinal = point.ordinal || idx + 1;
                      const subjectsShown = point.assessments.slice(0, 5);
                      const subjectsRemainder = point.assessments.length - 5;

                      return (
                        <tr
                          key={point.id}
                          className={`table-row ${point.resultStatus === "LOCKED" ? "opacity-90" : ""}`}
                        >
                          <td className="px-5 py-3.5 text-center tabular-nums text-[var(--on-surface-muted)]">
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[var(--surface-container-low)] text-[11px] font-bold text-[var(--on-surface-muted)]">
                              {ordinal}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${POINT_TYPE_COLOURS[point.pointType]}`}>
                                {POINT_TYPE_LABELS[point.pointType]}
                              </span>
                              <ResultPointStatusControl pointId={point.id} status={point.resultStatus} compact />
                            </div>
                            <span className="font-semibold text-[var(--on-surface)]">{point.label}</span>
                          </td>
                          <td className="hidden px-4 py-3.5 text-[var(--on-surface-muted)] sm:table-cell">
                            {assessedDateLabel ? (
                              <span className="flex items-center gap-1.5 text-xs">
                                <IconCalendar className="h-3.5 w-3.5 shrink-0" />
                                {assessedDateLabel}
                              </span>
                            ) : (
                              <span className="text-[var(--on-surface-muted)]/40">—</span>
                            )}
                          </td>
                          <td className="hidden px-4 py-3.5 lg:table-cell">
                            {point.assessments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {subjectsShown.map((a) => (
                                  <span
                                    key={a.id}
                                    className="rounded border border-[var(--outline-variant)]/40 bg-[var(--surface-container)] px-2 py-0.5 text-[10px] font-medium text-[var(--on-surface)]"
                                  >
                                    {a.subject}
                                  </span>
                                ))}
                                {subjectsRemainder > 0 && (
                                  <span className="rounded border border-[var(--outline-variant)]/40 bg-[var(--surface-container)] px-2 py-0.5 text-[10px] font-medium text-[var(--on-surface-muted)]">
                                    +{subjectsRemainder}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-[var(--on-surface-muted)]/40">No uploads yet</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-[var(--on-surface-muted)]">
                            {hasData ? entries.toLocaleString() : <span className="text-[var(--on-surface-muted)]/40">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-[var(--on-surface-muted)]">
                            {hasData ? matched.toLocaleString() : <span className="text-[var(--on-surface-muted)]/40">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {point.resultStatus !== "LOCKED" && (
                                <Button asChild className="h-7 py-0 text-[11px]">
                                  <Link href={`/assessments/${cycle.id}/points/${point.id}/upload`}>
                                    <IconUploadCloud />
                                    Upload
                                  </Link>
                                </Button>
                              )}
                              {hasData && (
                                <Button asChild variant="secondary" className="h-7 py-0 text-[11px]">
                                  <Link href={`/assessments/${cycle.id}/points/${point.id}`}>
                                    <IconBarChart />
                                    Analysis
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}
      </section>
    </AttainmentPageShell>
  );
}
