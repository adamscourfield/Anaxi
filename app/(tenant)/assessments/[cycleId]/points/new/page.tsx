"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { toast } from "@/components/toast-provider";

type PointType = "BASELINE" | "INTERNAL_ASSESSMENT" | "INTERNAL_MOCK" | "TEACHER_PREDICTION" | "EXTERNAL_FINAL" | "OTHER";

const POINT_TYPE_OPTIONS: Array<{ value: PointType; label: string; description: string; colour: string }> = [
  { value: "BASELINE", label: "Baseline", description: "Starting point for the cohort", colour: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]" },
  { value: "INTERNAL_ASSESSMENT", label: "Internal Assessment", description: "School-set assessment", colour: "bg-blue-100 text-blue-700" },
  { value: "INTERNAL_MOCK", label: "Internal Mock", description: "Mock examination", colour: "bg-amber-100 text-amber-700" },
  { value: "TEACHER_PREDICTION", label: "Teacher Prediction", description: "Predicted grades", colour: "bg-violet-100 text-violet-700" },
  { value: "EXTERNAL_FINAL", label: "External Final Results", description: "Official exam board outcomes", colour: "bg-emerald-100 text-emerald-700" },
  { value: "OTHER", label: "Other", description: "Custom result point", colour: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]" },
];

export default function NewResultPointPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const router = useRouter();

  const [cycleLabel, setCycleLabel] = useState("");
  const [label, setLabel] = useState("");
  const [shortLabel, setShortLabel] = useState("");
  const [pointType, setPointType] = useState<PointType>("INTERNAL_MOCK");
  const [assessedAt, setAssessedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextOrdinal, setNextOrdinal] = useState(1);

  useEffect(() => {
    fetch(`/api/assessments/cycles/${cycleId}`)
      .then((r) => r.json())
      .then(({ cycle }) => {
        setCycleLabel(cycle?.label ?? "");
        setNextOrdinal((cycle?.points?.length ?? 0) + 1);
      })
      .catch(() => {});
  }, [cycleId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) { setError("Name is required."); toast("Name is required.", "error"); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/assessments/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId,
          label: label.trim(),
          shortLabel: shortLabel.trim() || null,
          pointType,
          ordinal: nextOrdinal,
          assessedAt: assessedAt || new Date().toISOString().split("T")[0],
          isFinalPoint: pointType === "EXTERNAL_FINAL",
          resultStatus: "DRAFT",
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to create result point");
        toast(d.error || "Failed to create result point", "error");
        return;
      }
      const { point } = await res.json();
      toast("Result point created", "success");
      router.push(`/assessments/${cycleId}/points/${point.id}/upload`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: cycleLabel || "Cycle", href: `/assessments/${cycleId}` },
          { label: "New result point" },
        ]}
      />

      <PageHeader
        eyebrow="Attainment"
        title="New result point"
        subtitle="A result point is a cohort-wide attainment snapshot — a mock, baseline, prediction, or final results."
      />

      <Card className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Point type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--on-surface)]">Type</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {POINT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setPointType(opt.value);
                    if (!label) setLabel(opt.label === "Other" ? "" : opt.label);
                  }}
                  className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                    pointType === opt.value
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--outline-variant)] hover:border-[var(--outline-variant)]/60"
                  }`}
                >
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${opt.colour}`}>
                    {opt.label}
                  </span>
                  <p className="mt-1 text-[11px] text-[var(--on-surface-muted)]">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Name</label>
              <input
                className="field w-full"
                placeholder="e.g. Mock 2"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Short label <span className="text-[var(--on-surface-muted)]">(optional)</span></label>
              <input
                className="field w-full"
                placeholder="e.g. M2"
                value={shortLabel}
                onChange={(e) => setShortLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--on-surface)]">Date <span className="text-[var(--on-surface-muted)]">(optional)</span></label>
            <input
              type="date"
              className="field w-48"
              value={assessedAt}
              onChange={(e) => setAssessedAt(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-[var(--error)]">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create & upload results →"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push(`/assessments/${cycleId}`)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
