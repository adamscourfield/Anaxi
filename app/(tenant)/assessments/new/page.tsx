"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";

type QualificationType = "GCSE" | "A_LEVEL" | "PERCENTAGE" | "OTHER";

const QUAL_OPTIONS: Array<{ value: QualificationType; label: string; description: string }> = [
  { value: "GCSE", label: "GCSE", description: "Grades 1–9, numeric scale" },
  { value: "A_LEVEL", label: "A Level", description: "Grades A*–U, letter scale" },
  { value: "PERCENTAGE", label: "Percentage Scores", description: "0–100% scores" },
  { value: "OTHER", label: "Other", description: "Custom grading scheme" },
];

const COHORT_SUGGESTIONS = [
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11",
  "Year 12", "Year 13", "Sixth Form",
];

const ACADEMIC_YEAR_SUGGESTIONS = ["2024/25", "2025/26", "2026/27"];

const POINT_PRESETS: Record<QualificationType, Array<{ label: string; pointType: string }>> = {
  GCSE: [
    { label: "Baseline", pointType: "BASELINE" },
    { label: "Autumn Assessment", pointType: "INTERNAL_ASSESSMENT" },
    { label: "Mock 1", pointType: "INTERNAL_MOCK" },
    { label: "Mock 2", pointType: "INTERNAL_MOCK" },
    { label: "Teacher Predictions", pointType: "TEACHER_PREDICTION" },
    { label: "Final GCSE Results", pointType: "EXTERNAL_FINAL" },
  ],
  A_LEVEL: [
    { label: "Baseline", pointType: "BASELINE" },
    { label: "Autumn Assessment", pointType: "INTERNAL_ASSESSMENT" },
    { label: "Mock 1", pointType: "INTERNAL_MOCK" },
    { label: "Mock 2", pointType: "INTERNAL_MOCK" },
    { label: "Teacher Predictions", pointType: "TEACHER_PREDICTION" },
    { label: "Final A-Level Results", pointType: "EXTERNAL_FINAL" },
  ],
  PERCENTAGE: [
    { label: "Baseline", pointType: "BASELINE" },
    { label: "Assessment 1", pointType: "INTERNAL_ASSESSMENT" },
    { label: "Assessment 2", pointType: "INTERNAL_ASSESSMENT" },
    { label: "Final Results", pointType: "EXTERNAL_FINAL" },
  ],
  OTHER: [
    { label: "Assessment 1", pointType: "INTERNAL_ASSESSMENT" },
    { label: "Assessment 2", pointType: "INTERNAL_ASSESSMENT" },
  ],
};

export default function NewCyclePage() {
  const router = useRouter();

  const [step, setStep] = useState<"cycle" | "points" | "done">("cycle");
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [cycleLabel, setCycleLabel] = useState("");

  // Cycle form
  const [cohortLabel, setCohortLabel] = useState("");
  const [qualificationType, setQualificationType] = useState<QualificationType>("GCSE");
  const [academicYear, setAcademicYear] = useState("2024/25");
  const [startDate, setStartDate] = useState("2024-09-01");
  const [endDate, setEndDate] = useState("2025-08-31");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Points form
  const [points, setPoints] = useState(
    POINT_PRESETS.GCSE.map((p, i) => ({
      ...p,
      assessedAt: "",
      selected: ["Mock 1", "Mock 2", "Final GCSE Results"].includes(p.label),
    }))
  );
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);

  function handleQualChange(qual: QualificationType) {
    setQualificationType(qual);
    const label =
      cohortLabel && academicYear
        ? `${cohortLabel} ${QUAL_OPTIONS.find((q) => q.value === qual)?.label} ${academicYear}`
        : "";
    if (!cycleLabel) setCycleLabel(label);
    setPoints(
      POINT_PRESETS[qual].map((p) => ({
        ...p,
        assessedAt: "",
        selected: p.pointType === "INTERNAL_MOCK" || p.pointType === "EXTERNAL_FINAL",
      }))
    );
  }

  function autoLabel() {
    if (cohortLabel && qualificationType && academicYear) {
      const qual = QUAL_OPTIONS.find((q) => q.value === qualificationType)?.label ?? "";
      setCycleLabel(`${cohortLabel} ${qual} ${academicYear}`);
    }
  }

  async function handleCreateCycle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/assessments/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: cycleLabel,
          cohortLabel,
          qualificationType,
          academicYear,
          startDate,
          endDate,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Failed to create cycle");
        return;
      }
      const { cycle } = await res.json();
      setCycleId(cycle.id);
      setStep("points");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePoints(e: React.FormEvent) {
    e.preventDefault();
    if (!cycleId) return;
    setPointsError(null);
    setPointsLoading(true);

    const selected = points.filter((p) => p.selected);
    if (selected.length === 0) {
      setPointsError("Select at least one result point.");
      setPointsLoading(false);
      return;
    }

    const filled = selected.filter((p) => p.assessedAt);
    if (filled.length === 0 && selected.some((p) => !p.assessedAt)) {
      // Allow creation without dates — they're optional
    }

    try {
      for (let i = 0; i < selected.length; i++) {
        const p = selected[i];
        const res = await fetch("/api/assessments/points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycleId,
            label: p.label,
            pointType: p.pointType,
            ordinal: i + 1,
            assessedAt: p.assessedAt || new Date().toISOString().split("T")[0],
            isFinalPoint: p.pointType === "EXTERNAL_FINAL",
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          setPointsError(d.error || `Failed to create "${p.label}"`);
          return;
        }
      }
      setStep("done");
    } finally {
      setPointsLoading(false);
    }
  }

  function togglePoint(i: number) {
    setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, selected: !p.selected } : p)));
  }

  function updateDate(i: number, date: string) {
    setPoints((prev) => prev.map((p, idx) => (idx === i ? { ...p, assessedAt: date } : p)));
  }

  const POINT_TYPE_LABELS: Record<string, string> = {
    BASELINE: "Baseline",
    INTERNAL_ASSESSMENT: "Internal Assessment",
    INTERNAL_MOCK: "Internal Mock",
    TEACHER_PREDICTION: "Teacher Prediction",
    EXTERNAL_FINAL: "External Final",
    OTHER: "Other",
  };

  const POINT_TYPE_COLOURS: Record<string, string> = {
    BASELINE: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
    INTERNAL_ASSESSMENT: "bg-blue-100 text-blue-700",
    INTERNAL_MOCK: "bg-amber-100 text-amber-700",
    TEACHER_PREDICTION: "bg-violet-100 text-violet-700",
    EXTERNAL_FINAL: "bg-emerald-100 text-emerald-700",
    OTHER: "bg-[var(--surface-container)] text-[var(--on-surface-muted)]",
  };

  if (step === "done") {
    return (
      <div className="max-w-2xl space-y-8">
        <AssessmentsBreadcrumb
          items={[
            { label: "Attainment", href: "/assessments" },
            { label: "Cycle created" },
          ]}
        />
        <PageHeader eyebrow="Attainment" title="Cycle created" subtitle={`"${cycleLabel}" is ready.`} />
        <Card className="space-y-4">
          <p className="text-sm text-[var(--on-surface-muted)]">
            Result points have been created. Upload subject results for each point to begin analysis.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => router.push(`/assessments/${cycleId}`)}>
              Open cycle
            </Button>
            <Button variant="ghost" onClick={() => router.push("/assessments/new")}>
              Create another cycle
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: "New cycle" },
        ]}
      />
      <PageHeader
        eyebrow="Attainment"
        title="New cycle"
        subtitle="A cycle tracks one cohort's outcomes across an academic year."
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["cycle", "points"] as const).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--on-surface-muted)]">→</span>}
            <span className={step === s ? "font-semibold text-[var(--accent)]" : "text-[var(--on-surface-muted)]"}>
              {i + 1}. {s === "cycle" ? "Cycle details" : "Result points"}
            </span>
          </span>
        ))}
      </div>

      {/* Step 1: Cycle details */}
      {step === "cycle" && (
        <Card className="space-y-5">
          <SectionHeader title="Cycle details" subtitle="Define the cohort, qualification, and academic year." />
          <form onSubmit={handleCreateCycle} className="space-y-5">
            {/* Qualification type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--on-surface)]">Qualification type</label>
              <div className="grid grid-cols-2 gap-2">
                {QUAL_OPTIONS.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => handleQualChange(q.value)}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      qualificationType === q.value
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-[var(--outline-variant)] hover:border-[var(--outline-variant)]/60"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--on-surface)]">{q.label}</p>
                    <p className="text-xs text-[var(--on-surface-muted)]">{q.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--on-surface)]">Cohort</label>
                <input
                  className="field w-full"
                  list="cohort-list"
                  placeholder="e.g. Year 11"
                  value={cohortLabel}
                  onChange={(e) => { setCohortLabel(e.target.value); }}
                  onBlur={autoLabel}
                  required
                />
                <datalist id="cohort-list">
                  {COHORT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--on-surface)]">Academic year</label>
                <input
                  className="field w-full"
                  list="year-list"
                  placeholder="e.g. 2024/25"
                  value={academicYear}
                  onChange={(e) => { setAcademicYear(e.target.value); }}
                  onBlur={autoLabel}
                  required
                />
                <datalist id="year-list">
                  {ACADEMIC_YEAR_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Cycle name</label>
              <input
                className="field w-full"
                placeholder="e.g. Year 11 GCSE 2024/25"
                value={cycleLabel}
                onChange={(e) => setCycleLabel(e.target.value)}
                required
              />
              <p className="text-[11px] text-[var(--on-surface-muted)]">
                Auto-generated from cohort + qualification + year. Edit freely.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--on-surface)]">Start date</label>
                <input type="date" className="field w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--on-surface)]">End date</label>
                <input type="date" className="field w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>

            {error && <p className="text-sm text-[var(--error)]">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create cycle →"}
            </Button>
          </form>
        </Card>
      )}

      {/* Step 2: Result points */}
      {step === "points" && (
        <Card className="space-y-5">
          <SectionHeader
            title="Result points"
            subtitle="Select the attainment snapshots you plan to collect. You can add more at any time."
          />
          <form onSubmit={handleCreatePoints} className="space-y-5">
            <div className="space-y-2">
              {points.map((point, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    point.selected
                      ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
                      : "border-[var(--outline-variant)]/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={point.selected}
                    onChange={() => togglePoint(i)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--on-surface)]">{point.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${POINT_TYPE_COLOURS[point.pointType]}`}>
                        {POINT_TYPE_LABELS[point.pointType]}
                      </span>
                    </div>
                  </div>
                  {point.selected && (
                    <input
                      type="date"
                      className="field w-40 text-sm"
                      value={point.assessedAt}
                      onChange={(e) => updateDate(i, e.target.value)}
                      placeholder="Date (optional)"
                    />
                  )}
                </div>
              ))}
            </div>

            {pointsError && <p className="text-sm text-[var(--error)]">{pointsError}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={pointsLoading}>
                {pointsLoading ? "Saving…" : "Create result points →"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep("done")}>
                Skip — add later
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
