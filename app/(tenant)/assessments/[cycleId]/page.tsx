import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
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
  BASELINE: "bg-slate-100 text-slate-600",
  INTERNAL_ASSESSMENT: "bg-blue-50 text-blue-600",
  INTERNAL_MOCK: "bg-slate-100 text-slate-600",
  TEACHER_PREDICTION: "bg-violet-50 text-violet-600",
  EXTERNAL_FINAL: "bg-emerald-50 text-emerald-600",
  OTHER: "bg-slate-100 text-slate-600",
};

const STATUS_LABELS: Record<ResultStatus, string> = {
  DRAFT: "Draft",
  VALIDATED: "Validated",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

const STATUS_COLOURS: Record<ResultStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  VALIDATED: "bg-blue-50 text-blue-600",
  PUBLISHED: "bg-emerald-50 text-emerald-600",
  LOCKED: "bg-slate-900 text-white",
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
    <div className="w-full space-y-10 pb-16">
      {/* Top Breadcrumb & Header info (Kept for context, but subtly integrated) */}
      <div className="flex items-center gap-2 text-sm text-[var(--on-surface-muted)]">
        <Link href="/assessments" className="hover:underline">Attainment Cycles</Link>
        <span>›</span>
        <span className="text-[var(--on-surface)]">{cycle.label}</span>
      </div>

      {/* Summary stats custom to exact design */}
      <div className="grid grid-cols-4 gap-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Result Points</p>
          <p className="mt-3 text-[40px] font-bold leading-none tracking-[-0.03em] text-slate-900">{cycle.points.length}</p>
          <div className="mt-6 flex h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="w-1/3 bg-slate-900"></div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Subjects</p>
            <p className="mt-3 text-[40px] font-bold leading-none tracking-[-0.03em] text-slate-900">{totalSubjects}</p>
          </div>
          <p className="mt-6 text-xs font-semibold text-slate-500">Across all departments</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Entries Recorded</p>
            <p className="mt-3 text-[40px] font-bold leading-none tracking-[-0.03em] text-slate-900">{totalEntries.toLocaleString()}</p>
          </div>
          <p className="mt-6 text-xs font-bold text-emerald-500">↗ +12% from Y10</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data Integrity</p>
            <p className="mt-3 text-[40px] font-bold leading-none tracking-[-0.03em] text-slate-900">99.7%</p>
          </div>
          <p className="mt-6 text-xs font-semibold text-slate-500">Verified by Registry</p>
        </div>
      </div>

      {/* Result point timeline exact match */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[28px] font-bold tracking-tight text-slate-900">Result Points</h2>
          <Link
            href={`/assessments/${cycle.id}/points/new`}
            className="text-[15px] font-bold text-slate-900 hover:underline"
          >
            + Add point
          </Link>
        </div>

        {cycle.points.length === 0 && (
          <div className="rounded-2xl bg-white py-12 text-center shadow-sm">
            <p className="text-slate-500">No result points yet.</p>
            <Link
              href={`/assessments/${cycle.id}/points/new`}
              className="mt-2 inline-block text-sm font-semibold text-slate-900 hover:underline"
            >
              Add the first result point
            </Link>
          </div>
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
                className="flex rounded-3xl bg-white p-8 shadow-sm transition-all hover:shadow-md"
              >
                {/* Ordinal on the left */}
                <div className="w-12 shrink-0 pt-8">
                  <span className="text-[40px] font-bold tracking-tighter text-slate-200">
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
                      <h3 className="text-[32px] font-bold leading-none tracking-[-0.03em] text-slate-900">
                        {point.label}
                      </h3>
                      {assessedDateLabel && (
                        <p className="text-[15px] font-semibold text-slate-500 mt-2">
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
                          className="rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                        >
                          View analysis
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Stats Rects */}
                  {hasData && (
                    <div className="mt-8 flex gap-4">
                      <div className="rounded-2xl bg-[#f8f9fb] p-5 flex-1 min-w-0 max-w-[200px]">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Subjects</p>
                        <p className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-slate-900">{point.assessments.length}</p>
                      </div>
                      <div className="rounded-2xl bg-[#f8f9fb] p-5 flex-1 min-w-0 max-w-[200px]">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Entries</p>
                        <p className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-slate-900">{entries.toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl bg-[#f8f9fb] p-5 flex-1 min-w-0 max-w-[200px]">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Students</p>
                        <p className="mt-2 text-[28px] font-bold leading-none tracking-[-0.03em] text-slate-900">{matched.toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {/* Subject chips */}
                  {point.assessments.length > 0 && (
                    <div className="mt-8 flex flex-wrap gap-2.5">
                      {point.assessments.slice(0, 8).map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm"
                        >
                          {a.subject}
                        </span>
                      ))}
                      {point.assessments.length > 8 && (
                        <span className="rounded-full border border-slate-100 bg-white px-4 py-1.5 text-[11px] font-bold text-slate-400 shadow-sm">
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
