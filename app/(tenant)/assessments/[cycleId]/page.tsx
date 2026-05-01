import type { ReactNode } from "react";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { DataTableEmpty } from "@/components/ui/data-table-empty";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import { Card } from "@/components/ui/card";
import type { PointType, ResultStatus, QualificationType } from "@prisma/client";
import { pointTypePillClasses, resultStatusPillClasses } from "@/modules/assessments/attainmentColours";

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

const STATUS_LABELS: Record<ResultStatus, string> = {
  DRAFT: "Draft",
  VALIDATED: "Validated",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

const STATUS_COLOURS = resultStatusPillClasses;

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

/** Pastel icon wells — reference dashboard (soft purple / soft blue circles) */
const kpiWellViolet =
  "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 [&_svg]:h-[22px] [&_svg]:w-[22px] [&_svg]:stroke-[1.75]";
const kpiWellBlue =
  "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600 [&_svg]:h-[22px] [&_svg]:w-[22px] [&_svg]:stroke-[1.75]";
const kpiWellAmber =
  "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 [&_svg]:h-[22px] [&_svg]:w-[22px] [&_svg]:stroke-[1.75]";

function CycleOverviewTile({
  icon,
  wellClass,
  label,
  value,
  footer,
  decorative,
}: {
  icon: ReactNode;
  wellClass: string;
  label: string;
  value: string | number;
  footer?: ReactNode;
  /** Soft wavy line in tile background (reference dashboard) */
  decorative?: "wave-violet" | "wave-blue" | "bars" | "ring";
}) {
  return (
    <div
      className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-[color-mix(in_srgb,#e5e7eb_90%,transparent)] bg-white px-5 pb-6 pt-7 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.06)]"
    >
      {decorative === "bars" ? (
        <span className="pointer-events-none absolute bottom-3 right-3 flex h-8 items-end gap-0.5 opacity-30" aria-hidden>
          {[40, 65, 35, 80, 50].map((h, i) => (
            <span key={i} className="w-1 rounded-sm bg-violet-500" style={{ height: `${h}%` }} />
          ))}
        </span>
      ) : null}
      {decorative === "ring" ? (
        <span
          className="pointer-events-none absolute right-4 top-1/2 h-14 w-14 -translate-y-1/2 rounded-full border-2 border-dashed border-emerald-200 bg-emerald-50/80 text-emerald-600"
          aria-hidden
        >
          <span className="flex h-full w-full items-center justify-center">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
            </svg>
          </span>
        </span>
      ) : null}
      <span className={`relative z-[1] ${wellClass}`} aria-hidden>
        {icon}
      </span>
      <p className="relative z-[1] mt-5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[#6B7280]">{label}</p>
      <p className="relative z-[1] mt-2 text-[2rem] font-bold leading-none tracking-[-0.03em] text-[#111827] tabular-nums">{value}</p>
      {footer != null ? (
        <div className="relative z-[1] mt-2.5 text-[0.8125rem] leading-snug text-[#6B7280]">{footer}</div>
      ) : null}
    </div>
  );
}

const btnSolidDark =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm calm-transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/25 focus-visible:ring-offset-2";

const btnMutedOutline =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-800 shadow-none calm-transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/30 focus-visible:ring-offset-2";

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
        eyebrowClassName="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-violet-600"
        eyebrow="Attainment cycle"
        titleClassName="text-[1.75rem] font-bold tracking-tight text-[#111827] md:text-[2rem]"
        subtitleClassName="max-w-3xl text-[0.9375rem] font-medium leading-relaxed text-[#374151]"
        title={cycle.label}
        subtitle={
          cycle.cohortLabel
            ? `${cycle.cohortLabel} · ${cycle.academicYear}`
            : cycle.academicYear
        }
        meta={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-[#6B7280]">
            <span className="inline-flex items-center gap-1.5">
              <IconCalendar className="h-4 w-4 shrink-0 text-[#9ca3af]" />
              {cycle.cohortLabel ?? "Cohort"} · {cycle.academicYear}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconBarChart className="h-4 w-4 shrink-0 text-[#9ca3af]" />
              {QUAL_LABELS[cycle.qualificationType]} · {cycle.points.length} result point
              {cycle.points.length !== 1 ? "s" : ""}
            </span>
          </div>
        }
        actions={
          <Link
            href={`/assessments/${cycle.id}/points/new`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[0.625rem] bg-[#111827] px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] calm-transition hover:opacity-95"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Add point
          </Link>
        }
      />

      {/* Overview KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CycleOverviewTile
          wellClass={kpiWellViolet}
          icon={<IconTarget />}
          label="Result points"
          value={cycle.points.length}
          decorative="wave-violet"
        />
        <CycleOverviewTile
          wellClass={kpiWellBlue}
          icon={<IconBook />}
          label="Total subjects"
          value={totalSubjects}
          footer="Across all departments"
          decorative="wave-blue"
        />
        <CycleOverviewTile
          wellClass={kpiWellViolet}
          icon={<IconTrend />}
          label="Entries recorded"
          value={totalEntries.toLocaleString()}
          footer={
            <span className={entriesTrendPct >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
              {entriesTrendLabel}
            </span>
          }
          decorative="bars"
        />
        <CycleOverviewTile
          wellClass={kpiWellAmber}
          icon={<IconShieldCheck />}
          label="Data integrity"
          value={integrityDisplay}
          footer="Share of rows marked present in uploads"
          decorative="ring"
        />
      </div>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight text-[#111827]">Result Points</h2>
          <Link
            href={`/assessments/${cycle.id}/points/new`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[0.625rem] border border-[#e5e7eb] bg-white px-4 text-sm font-semibold text-[#111827] shadow-sm calm-transition hover:bg-[#f9fafb]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Add point
          </Link>
        </div>

        {cycle.points.length === 0 && (
          <Card className="overflow-hidden rounded-2xl border border-black/[0.06] bg-surface-container-lowest p-0 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.06)]">
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

        <div className="space-y-5">
          {cycle.points.map((point, idx) => {
            const entries = point.assessments.reduce((s, a) => s + a.entryCount, 0);
            const matched = point.assessments.reduce((s, a) => s + a.matchedStudentCount, 0);
            const hasData = entries > 0;
            const assessedDateLabel = formatAssessedDate(point.assessedAt);
            const ordinal = point.ordinal || idx + 1;

            return (
              <article
                key={point.id}
                className="flex gap-6 rounded-2xl border border-[color-mix(in_srgb,#e5e7eb_90%,transparent)] bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-12px_rgba(15,23,42,0.08)] sm:gap-8 sm:p-9"
              >
                <div className="hidden shrink-0 sm:flex sm:items-start sm:pt-1">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-lg font-bold tabular-nums text-violet-500"
                    aria-label={`Result point ${ordinal}`}
                  >
                    {ordinal}
                  </span>
                </div>

                <div className="min-w-0 flex-1 space-y-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                        <span
                          className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${POINT_TYPE_COLOURS[point.pointType]}`}
                        >
                          {POINT_TYPE_LABELS[point.pointType]}
                        </span>
                        <span
                          className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_COLOURS[point.resultStatus]}`}
                        >
                          {STATUS_LABELS[point.resultStatus]}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-start gap-3 sm:hidden">
                          <span
                            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold tabular-nums text-violet-500"
                            aria-hidden
                          >
                            {ordinal}
                          </span>
                          <h3 className="min-w-0 text-2xl font-bold leading-tight tracking-tight text-[#111827]">
                            {point.label}
                          </h3>
                        </div>
                        <h3 className="hidden text-[1.65rem] font-bold leading-tight tracking-[-0.03em] text-[#111827] sm:block sm:text-[1.75rem]">
                          {point.label}
                        </h3>
                        {assessedDateLabel ? (
                          <p className="mt-2.5 flex items-center gap-2 pl-0 text-[0.9375rem] text-zinc-500 sm:pl-0">
                            <IconCalendar className="h-4 w-4 shrink-0 text-zinc-400" />
                            <span>{assessedDateLabel}</span>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5 lg:justify-end">
                      {point.resultStatus !== "LOCKED" ? (
                        <Link href={`/assessments/${cycle.id}/points/${point.id}/upload`} className={btnSolidDark}>
                          <IconUploadCloud />
                          Upload results
                        </Link>
                      ) : null}
                      {hasData ? (
                        <Link href={`/assessments/${cycle.id}/points/${point.id}`} className={btnMutedOutline}>
                          <IconBarChart />
                          View analysis
                        </Link>
                      ) : null}
                      {hasData ? (
                        <Link
                          href={`/assessments/${cycle.id}/points/${point.id}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e7eb] bg-white text-[#6b7280] calm-transition hover:bg-[#fafafa] hover:text-[#111827]"
                          aria-label={`Open ${point.label}`}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <circle cx="5" cy="12" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="19" cy="12" r="1.5" />
                          </svg>
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {hasData ? (
                    <div className="rounded-xl bg-[#f3f4f6] px-4 py-3 sm:px-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:divide-x sm:divide-[#e5e7eb]">
                      <div className="flex items-center gap-3 sm:pr-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                          <IconBook className="h-4 w-4 shrink-0" />
                        </span>
                        <div>
                          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">Subjects</p>
                          <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-[#111827]">
                            {point.assessments.length}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:px-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                          <IconDocument className="h-4 w-4 shrink-0" />
                        </span>
                        <div>
                          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">Entries</p>
                          <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-[#111827]">
                            {entries.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:pl-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                          <IconUsers className="h-4 w-4 shrink-0" />
                        </span>
                        <div>
                          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">Students</p>
                          <p className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-[#111827]">
                            {matched.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    </div>
                  ) : null}

                  {point.assessments.length > 0 ? (
                    <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-5">
                      {point.assessments.slice(0, 8).map((a) => (
                        <span
                          key={a.id}
                          className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-zinc-900"
                        >
                          {a.subject}
                        </span>
                      ))}
                      {point.assessments.length > 8 ? (
                        <span className="rounded-full border border-[#e5e7eb] bg-[#fafafa] px-3.5 py-1.5 text-[11px] font-semibold text-[#374151]">
                          +{point.assessments.length - 8} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </AttainmentPageShell>
  );
}
