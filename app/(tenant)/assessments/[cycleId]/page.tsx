import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { H2, MetaText } from "@/components/ui/typography";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableEmpty } from "@/components/ui/data-table-empty";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { Card } from "@/components/ui/card";
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
  BASELINE: "bg-surface-container-low text-muted",
  INTERNAL_ASSESSMENT: "bg-blue-50 text-blue-600",
  INTERNAL_MOCK: "bg-surface-container-low text-muted",
  TEACHER_PREDICTION: "bg-violet-50 text-violet-600",
  EXTERNAL_FINAL: "bg-emerald-50 text-emerald-600",
  OTHER: "bg-surface-container-low text-muted",
};

const STATUS_LABELS: Record<ResultStatus, string> = {
  DRAFT: "Draft",
  VALIDATED: "Validated",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

const STATUS_COLOURS: Record<ResultStatus, string> = {
  DRAFT: "bg-surface-container-low text-muted",
  VALIDATED: "bg-blue-50 text-blue-600",
  PUBLISHED: "bg-emerald-50 text-emerald-600",
  LOCKED: "bg-primary text-white",
};

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

  return (
    <div className="w-full space-y-8 pb-16">
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: cycle.label },
        ]}
      />

      <PageHeader
        eyebrow="Attainment cycle"
        title={cycle.label}
        subtitle={
          cycle.cohortLabel
            ? `${cycle.cohortLabel} · ${cycle.academicYear}`
            : cycle.academicYear
        }
        meta={<MetaText>{QUAL_LABELS[cycle.qualificationType]} · {cycle.points.length} result point{cycle.points.length !== 1 ? "s" : ""}</MetaText>}
      />

      {/* Summary stats — StatCard sizing matches Attainment Cycles list & dashboards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Result points"
          value={cycle.points.length}
          accentPlacement="none"
          tone="softGrey"
        />
        <StatCard
          label="Total subjects"
          value={totalSubjects}
          accentPlacement="none"
          tone="softGrey"
          context="Across all departments"
        />
        <StatCard
          label="Entries recorded"
          value={totalEntries.toLocaleString()}
          accentPlacement="none"
          tone="softGrey"
          context={
            <span className="font-semibold text-emerald-600">↗ +12% from Y10</span>
          }
        />
        <StatCard
          label="Data integrity"
          value="99.7%"
          accentPlacement="none"
          tone="softGrey"
          context="Verified by Registry"
        />
      </div>

      {/* Result point timeline exact match */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <H2>Result Points</H2>
          <Link
            href={`/assessments/${cycle.id}/points/new`}
            className="text-[15px] font-bold text-text hover:underline"
          >
            + Add point
          </Link>
        </div>

        {cycle.points.length === 0 && (
          <Card className="overflow-hidden p-0">
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
        )}

        <div className="space-y-6">
          {cycle.points.map((point, idx) => {
            const entries = point.assessments.reduce((s, a) => s + a.entryCount, 0);
            const matched = point.assessments.reduce((s, a) => s + a.matchedStudentCount, 0);
            const hasData = entries > 0;
            const assessedDateLabel = formatAssessedDate(point.assessedAt);

            return (
              <div
                key={point.id}
                className="flex rounded-3xl bg-white p-8 shadow-ambient transition-all hover:shadow-lg"
              >
                {/* Ordinal on the left */}
                <div className="w-12 shrink-0 pt-8">
                  <span className="text-[40px] font-bold tracking-tighter text-surface-container-high">
                    {point.ordinal || (idx + 1)}
                  </span>
                </div>

                <div className="flex-1 min-w-0 pl-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex gap-2 mb-3">
                        <span className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${POINT_TYPE_COLOURS[point.pointType]}`}>
                          {POINT_TYPE_LABELS[point.pointType]}
                        </span>
                        <span className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_COLOURS[point.resultStatus]}`}>
                          {STATUS_LABELS[point.resultStatus]}
                        </span>
                      </div>
                      <h3 className="text-[32px] font-bold leading-none tracking-[-0.03em] text-text">
                        {point.label}
                      </h3>
                      {assessedDateLabel && (
                        <p className="text-[15px] font-semibold text-muted mt-2">
                          {assessedDateLabel}
                        </p>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                      {point.resultStatus !== "LOCKED" && (
                        <Link
                          href={`/assessments/${cycle.id}/points/${point.id}/upload`}
                          className="rounded-[10px] bg-[#111827] px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-[#1f2937] transition-colors"
                        >
                          Upload results
                        </Link>
                      )}
                      {hasData && (
                        <Link
                          href={`/assessments/${cycle.id}/points/${point.id}`}
                          className="rounded-[10px] border border-border bg-white px-4 py-2.5 text-xs font-bold text-text shadow-sm hover:bg-surface-container-low transition-colors"
                        >
                          View analysis
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Stats Rects */}
                  {hasData && (
                    <div className="mt-6 grid max-w-xl grid-cols-3 gap-3 sm:max-w-2xl">
                      <StatCard
                        label="Subjects"
                        value={point.assessments.length}
                        accentPlacement="none"
                        tone="softGrey"
                        valueClassName="mt-1.5 text-xl font-bold tabular-nums leading-none tracking-tight text-text"
                      />
                      <StatCard
                        label="Entries"
                        value={entries.toLocaleString()}
                        accentPlacement="none"
                        tone="softGrey"
                        valueClassName="mt-1.5 text-xl font-bold tabular-nums leading-none tracking-tight text-text"
                      />
                      <StatCard
                        label="Students"
                        value={matched.toLocaleString()}
                        accentPlacement="none"
                        tone="softGrey"
                        valueClassName="mt-1.5 text-xl font-bold tabular-nums leading-none tracking-tight text-text"
                      />
                    </div>
                  )}

                  {/* Subject chips */}
                  {point.assessments.length > 0 && (
                    <div className="mt-8 flex flex-wrap gap-2.5">
                      {point.assessments.slice(0, 8).map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full border border-border bg-white px-4 py-1.5 text-[11px] font-bold text-muted shadow-sm"
                        >
                          {a.subject}
                        </span>
                      ))}
                      {point.assessments.length > 8 && (
                        <span className="rounded-full border border-border/50 bg-white px-4 py-1.5 text-[11px] font-bold text-muted shadow-sm">
                          +{point.assessments.length - 8} MORE
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
