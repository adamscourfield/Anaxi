import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import Link from "next/link";

export default async function AssessmentsPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const cycles = await prisma.assessmentCycle.findMany({
    where: { tenantId: user.tenantId },
    include: {
      points: {
        orderBy: { ordinal: "asc" },
        include: {
          _count: { select: { assessments: true } },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
  });

  const activeCycle = cycles.find((c) => c.isActive) ?? cycles[0] ?? null;

  // Get summary stats for active cycle
  let totalAssessments = 0;
  let totalResults = 0;

  if (activeCycle) {
    const assessmentsInCycle = await prisma.assessment.findMany({
      where: {
        tenantId: user.tenantId,
        point: { cycleId: activeCycle.id },
      },
      include: { _count: { select: { results: true } } },
    });
    totalAssessments = assessmentsInCycle.length;
    totalResults = assessmentsInCycle.reduce((sum, a) => sum + a._count.results, 0);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Assessments"
          subtitle="Track student attainment across subjects and assessment points."
        />
        <div className="flex gap-2">
          <Link
            href="/assessments/upload-bulk"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface"
          >
            Upload CSV
          </Link>
          <Link
            href="/assessments/adhoc"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface"
          >
            Add ad-hoc data
          </Link>
          <Link
            href="/assessments/setup"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Set up cycle
          </Link>
        </div>
      </div>

      {/* Quick-access feature links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/assessments/key-measures"
          className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/30 hover:bg-surface"
        >
          <span className="text-sm font-semibold text-text">Key Measures</span>
          <span className="text-xs text-muted">
            GCSE Basics, A-Level thresholds, PP &amp; SEND gap analysis
          </span>
        </Link>
        <Link
          href="/assessments/dashboard"
          className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/30 hover:bg-surface"
        >
          <span className="text-sm font-semibold text-text">Dashboard</span>
          <span className="text-xs text-muted">
            Heatmap, distributions and attainment overview across cycles
          </span>
        </Link>
        <Link
          href="/assessments/compare"
          className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/30 hover:bg-surface"
        >
          <span className="text-sm font-semibold text-text">Compare datasets</span>
          <span className="text-xs text-muted">
            Side-by-side stats for any two assessments with delta analysis
          </span>
        </Link>
        <Link
          href="/assessments/progress"
          className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/30 hover:bg-surface"
        >
          <span className="text-sm font-semibold text-text">Progress tracker</span>
          <span className="text-xs text-muted">
            Student score deltas across multiple assessment points
          </span>
        </Link>
      </div>

      {cycles.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-muted">No assessment cycles yet.</p>
          <p className="mt-1 text-sm text-muted">
            <Link href="/assessments/setup" className="text-accent underline underline-offset-2">
              Create your first assessment cycle
            </Link>{" "}
            to get started.
          </p>
        </Card>
      ) : (
        <>
          {/* Active cycle summary */}
          {activeCycle && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted">Active cycle</p>
                <p className="text-xl font-semibold text-text">{activeCycle.label}</p>
                <p className="text-xs text-muted">
                  {activeCycle.points.length} assessment point{activeCycle.points.length !== 1 ? "s" : ""}
                </p>
              </Card>
              <Card className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted">Assessments uploaded</p>
                <p className="text-xl font-semibold text-text">{totalAssessments}</p>
              </Card>
              <Card className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted">Results recorded</p>
                <p className="text-xl font-semibold text-text">{totalResults.toLocaleString()}</p>
              </Card>
            </div>
          )}

          {/* Cycles list */}
          <div className="space-y-4">
            {cycles.map((cycle) => (
              <Card key={cycle.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SectionHeader title={cycle.label} />
                    {cycle.isActive && (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                        Active
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/assessments/metrics?cycleId=${cycle.id}`}
                    className="text-sm text-accent"
                  >
                    View metrics →
                  </Link>
                </div>

                {cycle.points.length === 0 ? (
                  <p className="text-sm text-muted">No assessment points added yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cycle.points.map((point) => (
                      <Link
                        key={point.id}
                        href={`/assessments/upload/${cycle.id}/${point.id}`}
                        className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm transition-colors hover:border-accent/30 hover:bg-surface"
                      >
                        <span className="font-medium text-text">{point.label}</span>
                        <span className="text-xs text-muted">
                          {point._count.assessments} assessment{point._count.assessments !== 1 ? "s" : ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>

          <div className="flex gap-3 flex-wrap">
            <Link
              href="/assessments/key-measures"
              className="rounded-lg border border-border px-4 py-2 text-sm text-text hover:bg-surface"
            >
              Key Measures →
            </Link>
            <Link
              href="/assessments/dashboard"
              className="rounded-lg border border-border px-4 py-2 text-sm text-text hover:bg-surface"
            >
              Dashboard →
            </Link>
            <Link
              href="/assessments/compare"
              className="rounded-lg border border-border px-4 py-2 text-sm text-text hover:bg-surface"
            >
              Compare datasets →
            </Link>
            <Link
              href="/assessments/metrics"
              className="rounded-lg border border-border px-4 py-2 text-sm text-text hover:bg-surface"
            >
              Metric builder →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
