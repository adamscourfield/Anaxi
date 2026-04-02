import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import type { PointType, ResultStatus, QualificationType } from "@prisma/client";

// ─── Type badges ─────────────────────────────────────────────────────────────

const POINT_TYPE_LABELS: Record<PointType, string> = {
  BASELINE: "Baseline",
  INTERNAL_ASSESSMENT: "Internal Assessment",
  INTERNAL_MOCK: "Internal Mock",
  TEACHER_PREDICTION: "Teacher Prediction",
  EXTERNAL_FINAL: "External Final",
  OTHER: "Other",
};

const POINT_TYPE_COLOURS: Record<PointType, string> = {
  BASELINE: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
  INTERNAL_ASSESSMENT: "bg-blue-100 text-blue-700",
  INTERNAL_MOCK: "bg-amber-100 text-amber-700",
  TEACHER_PREDICTION: "bg-violet-100 text-violet-700",
  EXTERNAL_FINAL: "bg-emerald-100 text-emerald-700",
  OTHER: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
};

const STATUS_LABELS: Record<ResultStatus, string> = {
  DRAFT: "Draft",
  VALIDATED: "Validated",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

const STATUS_COLOURS: Record<ResultStatus, string> = {
  DRAFT: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
  VALIDATED: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  LOCKED: "bg-[var(--on-surface)] text-[var(--surface)]",
};

const QUAL_LABELS: Record<QualificationType, string> = {
  GCSE: "GCSE",
  A_LEVEL: "A Level",
  PERCENTAGE: "Percentage",
  OTHER: "Other",
};

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

  const totalEntries = cycle.points.reduce(
    (s, p) => s + p.assessments.reduce((ss, a) => ss + a.entryCount, 0),
    0
  );
  const totalSubjects = new Set(
    cycle.points.flatMap((p) => p.assessments.map((a) => a.subject))
  ).size;
  const comparisonPoints = cycle.points.filter((p) => p.comparisonEligible && p.assessments.length > 0);

  return (
    <div className="max-w-5xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--on-surface-muted)]">
        <Link href="/assessments" className="hover:underline">Attainment Cycles</Link>
        <span>›</span>
        <span className="text-[var(--on-surface)]">{cycle.label}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full bg-[var(--surface-container)] px-2.5 py-0.5 text-xs font-semibold text-[var(--on-surface-muted)]">
              {QUAL_LABELS[cycle.qualificationType]}
            </span>
            {cycle.academicYear && (
              <span className="text-xs text-[var(--on-surface-muted)]">{cycle.academicYear}</span>
            )}
            {cycle.isActive && (
              <span className="rounded-full bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                Active
              </span>
            )}
          </div>
          <PageHeader title={cycle.label} />
          {cycle.cohortLabel && (
            <p className="mt-0.5 text-sm text-[var(--on-surface-muted)]">{cycle.cohortLabel}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/assessments/${cycle.id}/points/new`}
            className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
          >
            + Add result point
          </Link>
          {comparisonPoints.length >= 2 && (
            <Link
              href={`/assessments/${cycle.id}/compare`}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Compare points
            </Link>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Result points", value: cycle.points.length },
          { label: "Subjects", value: totalSubjects },
          { label: "Entries recorded", value: totalEntries.toLocaleString() },
          { label: "Status", value: cycle.isActive ? "Active" : "Archived" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-[var(--surface)] p-4 shadow-sm ring-1 ring-[var(--outline-variant)]/30">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-muted)]">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--on-surface)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Result point timeline */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--on-surface)]">Result Points</h2>
          <Link
            href={`/assessments/${cycle.id}/points/new`}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            + Add point
          </Link>
        </div>

        {cycle.points.length === 0 && (
          <Card className="py-10 text-center">
            <p className="text-[var(--on-surface-muted)]">No result points yet.</p>
            <Link
              href={`/assessments/${cycle.id}/points/new`}
              className="mt-2 inline-block text-sm text-[var(--accent)] hover:underline"
            >
              Add the first result point
            </Link>
          </Card>
        )}

        <div className="space-y-3">
          {cycle.points.map((point, idx) => {
            const entries = point.assessments.reduce((s, a) => s + a.entryCount, 0);
            const matched = point.assessments.reduce((s, a) => s + a.matchedStudentCount, 0);
            const hasData = entries > 0;

            return (
              <div
                key={point.id}
                className={`relative rounded-2xl border p-5 shadow-sm transition-all ${
                  point.isFinalPoint
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-[var(--outline-variant)]/30 bg-[var(--surface)]"
                }`}
              >
                {/* Timeline connector */}
                {idx < cycle.points.length - 1 && (
                  <div className="absolute -bottom-3 left-7 h-3 w-0.5 bg-[var(--outline-variant)]/40" />
                )}

                <div className="flex items-start gap-4">
                  {/* Ordinal bubble */}
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    point.isFinalPoint
                      ? "bg-emerald-600 text-white"
                      : "bg-[var(--surface-container)] text-[var(--on-surface-muted)]"
                  }`}>
                    {point.ordinal}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${POINT_TYPE_COLOURS[point.pointType]}`}>
                        {POINT_TYPE_LABELS[point.pointType]}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOURS[point.resultStatus]}`}>
                        {STATUS_LABELS[point.resultStatus]}
                      </span>
                      {point.isFinalPoint && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Final
                        </span>
                      )}
                    </div>

                    <h3 className="mt-1.5 text-base font-semibold text-[var(--on-surface)]">
                      {point.label}
                    </h3>
                    {point.assessedAt && (
                      <p className="text-xs text-[var(--on-surface-muted)]">
                        {new Date(point.assessedAt).toLocaleDateString("en-GB", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                    )}

                    {/* Subjects + stats */}
                    {hasData ? (
                      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg bg-[var(--surface-container-low)] px-3 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">Subjects</p>
                          <p className="text-base font-bold text-[var(--on-surface)]">{point.assessments.length}</p>
                        </div>
                        <div className="rounded-lg bg-[var(--surface-container-low)] px-3 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">Entries</p>
                          <p className="text-base font-bold text-[var(--on-surface)]">{entries.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-[var(--surface-container-low)] px-3 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">Students</p>
                          <p className="text-base font-bold text-[var(--on-surface)]">{matched}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-[var(--on-surface-muted)]">No results uploaded yet</p>
                    )}

                    {/* Subject chips */}
                    {point.assessments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {point.assessments.slice(0, 8).map((a) => (
                          <span
                            key={a.id}
                            className="rounded-full border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] px-2.5 py-0.5 text-[11px] text-[var(--on-surface-muted)]"
                          >
                            {a.subject}
                          </span>
                        ))}
                        {point.assessments.length > 8 && (
                          <span className="text-[11px] text-[var(--on-surface-muted)]">
                            +{point.assessments.length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {point.resultStatus !== "LOCKED" && (
                      <Link
                        href={`/assessments/${cycle.id}/points/${point.id}/upload`}
                        className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-center text-xs font-medium text-white hover:opacity-90"
                      >
                        Upload results
                      </Link>
                    )}
                    {hasData && (
                      <Link
                        href={`/assessments/${cycle.id}/points/${point.id}`}
                        className="rounded-lg border border-[var(--outline-variant)] px-3 py-1.5 text-center text-xs text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
                      >
                        View analysis
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comparison quick-access */}
      {comparisonPoints.length >= 2 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--on-surface)]">Comparisons</h2>
          <Card className="space-y-3">
            <p className="text-sm text-[var(--on-surface-muted)]">
              Compare any two result points to track progress, accuracy, or mock-to-final movement.
            </p>
            <div className="flex flex-wrap gap-2">
              {comparisonPoints.slice(0, -1).map((from, i) =>
                comparisonPoints.slice(i + 1).map((to) => (
                  <Link
                    key={`${from.id}-${to.id}`}
                    href={`/assessments/${cycle.id}/compare?from=${from.id}&to=${to.id}`}
                    className="rounded-full border border-[var(--outline-variant)] px-3 py-1 text-sm text-[var(--on-surface)] hover:bg-[var(--surface-container-low)]"
                  >
                    {from.shortLabel ?? from.label} → {to.shortLabel ?? to.label}
                  </Link>
                ))
              )}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
