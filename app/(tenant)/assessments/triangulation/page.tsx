import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { computeTriangulatedRisks } from "@/modules/assessments/analysis";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { DriverChips } from "@/components/ui/driver-chips";
import { DataTableEmpty } from "@/components/ui/data-table-empty";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { RiskBand } from "@/modules/analysis/studentRisk";
import { triangulationPpClass, triangulationSendClass } from "@/modules/assessments/attainmentColours";

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
      <div className="h-1.5 w-16 overflow-hidden rounded-sm bg-[var(--surface-container)]">
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
    <AttainmentPageShell>
    <div className="space-y-8">
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: "Dual-flagged students" },
        ]}
      />

      <PageHeader variant="ledger"
        eyebrow="Attainment"
        title="Dual-flagged students"
        subtitle="Students with both a high pastoral risk band and low attainment scores — highest priority for intervention."
      />

      <details className="rounded-xl border border-border/40 bg-surface-container-low px-4 py-3 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-text">What is triangulation?</summary>
        <p className="mt-2 leading-relaxed">
          This view combines pastoral risk bands from Explorer with attainment scores from assessment cycles. Students
          listed here need coordinated pastoral and academic follow-up.
        </p>
      </details>

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
        <Card className="overflow-hidden p-0">
          <DataTableEmpty
            title="No dual-flagged students right now"
            description="When a student has Priority or Urgent pastoral risk and assessment scores below 50%, they appear here."
          />
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
                      <span className={triangulationPpClass}>PP</span>
                    )}
                    {student.sendFlag && (
                      <span className={triangulationSendClass}>SEND</span>
                    )}
                  </div>
                  <div className="mt-1">
                    <DriverChips drivers={student.behaviouralDrivers} max={3} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusPill variant={BAND_PILL[student.behaviouralBand]} size="sm">
                    {BAND_LABEL[student.behaviouralBand]}
                  </StatusPill>
                  <Button asChild variant="secondary" className="h-7 py-0 text-[11px]">
                    <Link href={`/students/${student.studentId}`}>View student</Link>
                  </Button>
                </div>
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
    </AttainmentPageShell>
  );
}
