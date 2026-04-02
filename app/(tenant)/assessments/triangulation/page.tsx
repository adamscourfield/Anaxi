import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { computeTriangulatedRisks } from "@/modules/assessments/analysis";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { DriverChips } from "@/components/ui/driver-chips";
import Link from "next/link";
import type { RiskBand } from "@/modules/analysis/studentRisk";

const BAND_LABEL: Record<RiskBand, string> = {
  URGENT: "Urgent",
  PRIORITY: "Priority",
  WATCH: "Watch",
  STABLE: "Stable",
};

const BAND_PILL: Record<RiskBand, "error" | "warning" | "success" | "neutral"> = {
  URGENT: "error",
  PRIORITY: "warning",
  WATCH: "neutral",
  STABLE: "success",
};

function formatGrade(rawValue: string, normalizedScore: number | null): string {
  if (normalizedScore === null) return rawValue;
  return rawValue;
}

function scoreBar(normalizedScore: number | null) {
  if (normalizedScore === null) return null;
  const pct = Math.round(normalizedScore * 100);
  const colour =
    pct < 40 ? "bg-error" : pct < 60 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-container)]">
        <div className={`h-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-[var(--on-surface-muted)]">{pct}%</span>
    </div>
  );
}

export default async function TriangulationPage() {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "ASSESSMENTS");

  const result = await computeTriangulatedRisks(user.tenantId, user.id);
  const { students, meta } = result;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/assessments" className="text-sm text-[var(--on-surface-muted)] hover:underline">
          ← Assessments
        </Link>
      </div>

      <PageHeader
        title="Dual-Flagged Students"
        subtitle="Students with both a high pastoral risk band and low attainment scores — highest priority for intervention."
      />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface-muted)]">Total flagged</p>
          <p className="text-2xl font-bold text-[var(--on-surface)]">{meta.total}</p>
        </Card>
        <Card className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface-muted)]">Urgent</p>
          <p className="text-2xl font-bold text-[var(--error)]">{meta.urgent}</p>
        </Card>
        <Card className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface-muted)]">Priority</p>
          <p className="text-2xl font-bold text-[var(--warning)]">{meta.priority}</p>
        </Card>
      </div>

      {students.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--on-surface-muted)]">
            No students are currently dual-flagged. This means no students with a Priority or Urgent pastoral risk band also have assessment scores below 50%.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <Card key={student.studentId} className="space-y-3">
              {/* Student header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[var(--on-surface)]">{student.studentName}</p>
                    {student.yearGroup && (
                      <span className="text-xs text-[var(--on-surface-muted)]">{student.yearGroup}</span>
                    )}
                    {student.ppFlag && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">PP</span>
                    )}
                    {student.sendFlag && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">SEND</span>
                    )}
                  </div>
                  <div className="mt-1">
                    <DriverChips drivers={student.behaviouralDrivers} max={3} />
                  </div>
                </div>
                <StatusPill variant={BAND_PILL[student.behaviouralBand]} size="sm">
                  {BAND_LABEL[student.behaviouralBand]}
                </StatusPill>
              </div>

              {/* Assessment results */}
              <div className="border-t border-[var(--outline-variant)]/30 pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--on-surface-muted)]">
                  Assessment results · {student.attainmentResults[0]?.pointLabel ?? ""}
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {student.attainmentResults.map((r) => (
                    <div
                      key={r.subject}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                        r.normalizedScore !== null && r.normalizedScore < 0.5
                          ? "bg-[var(--error)]/5 border border-[var(--error)]/20"
                          : "bg-[var(--surface-container)]"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--on-surface)] truncate">{r.subject}</p>
                        {scoreBar(r.normalizedScore)}
                      </div>
                      <span className="ml-2 text-sm font-bold text-[var(--on-surface)]">
                        {formatGrade(r.rawValue, r.normalizedScore)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
