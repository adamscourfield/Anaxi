"use client";

/**
 * Ad-hoc Dataset Entry
 *
 * Lets users manually enter assessment scores without a CSV file.
 * Useful for small datasets, external results, or one-off tests.
 *
 * Flow:
 *   1. Choose or create an assessment (cycle → point → subject/yearGroup/format)
 *   2. Enter rows: student name + grade
 *   3. Review and submit
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import type { GradeFormat } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "setup" | "enter" | "done";

type Cycle = {
  id: string;
  label: string;
  points: Array<{ id: string; label: string; ordinal: number }>;
};

type RowEntry = {
  studentName: string;
  yearGroup: string;
  rawValue: string;
};

const GRADE_FORMAT_LABELS: Record<GradeFormat, string> = {
  GCSE: "GCSE (1–9)",
  A_LEVEL: "A Level (A*, A, B, C, D, E, U)",
  PERCENTAGE: "Percentage (0–100)",
  RAW: "Raw integer score (requires max score)",
};

const GRADE_FORMAT_PLACEHOLDERS: Record<GradeFormat, string> = {
  GCSE: "e.g. 7",
  A_LEVEL: "e.g. B",
  PERCENTAGE: "e.g. 78",
  RAW: "e.g. 54",
};

const GRADE_FORMAT_HINTS: Record<GradeFormat, string> = {
  GCSE: "Enter a number 1–9 (or 0 for U). Use ABS for absent, W for withdrawn.",
  A_LEVEL: "Enter A*, A, B, C, D, E, or U. Use ABS for absent, W for withdrawn.",
  PERCENTAGE: "Enter a number 0–100. Use ABS for absent, W for withdrawn.",
  RAW: "Enter an integer 0 to max score. Use ABS for absent, W for withdrawn.",
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdhocPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("setup");
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);

  // Setup fields
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedPointId, setSelectedPointId] = useState("");
  const [subject, setSubject] = useState("");
  const [yearGroup, setYearGroup] = useState("");
  const [title, setTitle] = useState("");
  const [gradeFormat, setGradeFormat] = useState<GradeFormat>("PERCENTAGE");
  const [maxScore, setMaxScore] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Assessment created
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  // Row entry
  const [rows, setRows] = useState<RowEntry[]>([
    { studentName: "", yearGroup: "", rawValue: "" },
  ]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Result
  const [saved, setSaved] = useState(0);
  const [rowErrors, setRowErrors] = useState<Array<{ rowIndex: number; studentName: string; message: string }>>([]);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  useEffect(() => {
    fetch("/api/assessments/cycles")
      .then((r) => r.json())
      .then((d) => {
        const c: Cycle[] = d.cycles ?? [];
        setCycles(c);
        if (c[0]) {
          setSelectedCycleId(c[0].id);
          if (c[0].points[0]) setSelectedPointId(c[0].points[0].id);
        }
      })
      .finally(() => setCyclesLoading(false));
  }, []);

  // ─── Step 1: create the assessment record ────────────────────────────────

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupError(null);

    if (!selectedPointId) {
      setSetupError("Please select an assessment point.");
      return;
    }
    if (gradeFormat === "RAW" && (!maxScore || Number(maxScore) <= 0)) {
      setSetupError("A valid max score is required for Raw integer format.");
      return;
    }

    setSetupLoading(true);
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointId: selectedPointId,
          subject: subject.trim(),
          yearGroup: yearGroup.trim(),
          title: title.trim() || `${subject.trim()} — ${yearGroup.trim()} (ad hoc)`,
          gradeFormat,
          maxScore: gradeFormat === "RAW" ? Number(maxScore) : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSetupError(d.error || "Failed to create assessment");
        return;
      }
      const d = await res.json();
      setAssessmentId(d.assessment.id);
      setStep("enter");
    } finally {
      setSetupLoading(false);
    }
  }

  // ─── Row management ──────────────────────────────────────────────────────

  function updateRow(index: number, field: keyof RowEntry, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, { studentName: "", yearGroup: "", rawValue: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addBulkRows(text: string) {
    // Parse pasted text: one row per line, tab or comma separated: Name, Grade
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const parsed: RowEntry[] = lines.map((line) => {
      const parts = line.split(/[\t,]/).map((p) => p.trim());
      return {
        studentName: parts[0] ?? "",
        yearGroup: "",
        rawValue: parts[1] ?? "",
      };
    });
    if (parsed.length > 0) {
      setRows((prev) => {
        // Remove any blank trailing row
        const filtered = prev.filter((r) => r.studentName || r.rawValue);
        return [...filtered, ...parsed];
      });
    }
  }

  // ─── Step 2: submit rows ─────────────────────────────────────────────────

  async function handleSubmit() {
    if (!assessmentId) return;

    const validRows = rows.filter((r) => r.studentName.trim() && r.rawValue.trim());
    if (validRows.length === 0) {
      setSubmitError("Add at least one row with a student name and grade.");
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/assessments/adhoc-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          rows: validRows.map((r) => ({
            studentName: r.studentName.trim(),
            yearGroup: r.yearGroup.trim() || yearGroup.trim() || undefined,
            rawValue: r.rawValue.trim(),
          })),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setSubmitError(d.error || "Submission failed");
        return;
      }
      const d = await res.json();
      setSaved(d.saved);
      setRowErrors(d.errors ?? []);
      setStep("done");
    } finally {
      setSubmitLoading(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Data entered" />
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--on-surface-muted)]">Results saved</p>
              <p className="text-3xl font-bold text-[var(--success)]">{saved}</p>
            </div>
            {rowErrors.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--on-surface-muted)]">Rows with errors</p>
                <p className="text-3xl font-bold text-[var(--error)]">{rowErrors.length}</p>
              </div>
            )}
          </div>
          {rowErrors.length > 0 && (
            <div className="rounded-xl bg-[var(--error)]/10 p-3 text-sm">
              <p className="font-medium text-[var(--error)]">Errors</p>
              <ul className="mt-1 space-y-0.5 text-[var(--error)]/80">
                {rowErrors.map((e, i) => (
                  <li key={i}>Row {e.rowIndex + 1} ({e.studentName}): {e.message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={() => assessmentId && router.push(`/assessments/results/${assessmentId}`)}>
              View results
            </Button>
            <Button variant="ghost" onClick={() => router.push("/assessments")}>
              Back to assessments
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Add Ad-hoc Dataset"
          subtitle="Manually enter assessment scores without a CSV file."
        />
        <a href="/assessments" className="text-sm text-[var(--on-surface-muted)] hover:underline">
          ← Assessments
        </a>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["setup", "enter"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--on-surface-muted)]">→</span>}
            <span className={step === s ? "font-semibold text-[var(--accent)]" : "text-[var(--on-surface-muted)]"}>
              {i + 1}. {s === "setup" ? "Define assessment" : "Enter scores"}
            </span>
          </span>
        ))}
      </div>

      {/* ── Step 1: Setup ── */}
      {step === "setup" && (
        <Card className="space-y-5">
          <SectionHeader
            title="Define the assessment"
            subtitle="Choose where this data sits in your assessment structure."
          />

          {cyclesLoading ? (
            <p className="text-sm text-[var(--on-surface-muted)]">Loading cycles…</p>
          ) : cycles.length === 0 ? (
            <div className="rounded-xl bg-[var(--surface-container)] p-4 text-sm text-[var(--on-surface-muted)]">
              No assessment cycles found.{" "}
              <a href="/assessments/setup" className="text-[var(--accent)] underline">
                Create a cycle first.
              </a>
            </div>
          ) : (
            <form onSubmit={handleSetup} className="space-y-4">
              {/* Cycle + Point */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Cycle</label>
                  <select
                    className="field w-full"
                    value={selectedCycleId}
                    onChange={(e) => {
                      setSelectedCycleId(e.target.value);
                      const c = cycles.find((x) => x.id === e.target.value);
                      if (c?.points[0]) setSelectedPointId(c.points[0].id);
                    }}
                    required
                  >
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Assessment point</label>
                  <select
                    className="field w-full"
                    value={selectedPointId}
                    onChange={(e) => setSelectedPointId(e.target.value)}
                    required
                  >
                    {selectedCycle?.points.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject + Year group */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Subject</label>
                  <input
                    className="field w-full"
                    placeholder="e.g. Maths"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Year group</label>
                  <input
                    className="field w-full"
                    placeholder="e.g. Year 11"
                    value={yearGroup}
                    onChange={(e) => setYearGroup(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--on-surface)]">
                  Assessment title <span className="font-normal text-[var(--on-surface-muted)]">(optional)</span>
                </label>
                <input
                  className="field w-full"
                  placeholder={`e.g. ${subject || "Maths"} Mock 1 — ${yearGroup || "Year 11"}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Grade format */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--on-surface)]">Score type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(GRADE_FORMAT_LABELS) as [GradeFormat, string][]).map(
                    ([value, label]) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                          gradeFormat === value
                            ? "border-[var(--accent)] bg-[var(--accent)]/8"
                            : "border-[var(--outline-variant)] hover:border-[var(--accent)]/40"
                        }`}
                      >
                        <input
                          type="radio"
                          name="gradeFormat"
                          value={value}
                          checked={gradeFormat === value}
                          onChange={() => setGradeFormat(value)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-[var(--on-surface)]">{label.split(" (")[0]}</p>
                          <p className="text-xs text-[var(--on-surface-muted)]">
                            {label.includes("(") ? label.split("(")[1].replace(")", "") : ""}
                          </p>
                        </div>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Max score (RAW only) */}
              {gradeFormat === "RAW" && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--on-surface)]">Maximum score</label>
                  <input
                    type="number"
                    className="field w-32"
                    placeholder="e.g. 80"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    required
                    min={1}
                  />
                  <p className="text-xs text-[var(--on-surface-muted)]">
                    The highest possible mark for this assessment.
                  </p>
                </div>
              )}

              {setupError && (
                <p className="text-sm text-[var(--error)]">{setupError}</p>
              )}

              <Button type="submit" disabled={setupLoading || !subject || !yearGroup}>
                {setupLoading ? "Creating…" : "Continue to enter scores"}
              </Button>
            </form>
          )}
        </Card>
      )}

      {/* ── Step 2: Enter scores ── */}
      {step === "enter" && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <SectionHeader
              title="Enter scores"
              subtitle={GRADE_FORMAT_HINTS[gradeFormat]}
            />

            {/* Paste helper */}
            <details className="rounded-xl border border-[var(--outline-variant)] text-sm">
              <summary className="cursor-pointer px-4 py-3 font-medium text-[var(--on-surface)]">
                Paste from a spreadsheet
              </summary>
              <div className="border-t border-[var(--outline-variant)] px-4 py-3 space-y-2">
                <p className="text-xs text-[var(--on-surface-muted)]">
                  Paste two columns (Name, Grade) separated by a tab or comma — one student per line.
                </p>
                <textarea
                  className="field w-full font-mono text-xs"
                  rows={4}
                  placeholder={"Jane Smith\t7\nJohn Doe\t5\nAli Hassan\tABS"}
                  onPaste={(e) => {
                    e.preventDefault();
                    addBulkRows(e.clipboardData.getData("text"));
                  }}
                  onChange={(e) => {
                    if (e.target.value) addBulkRows(e.target.value);
                  }}
                />
              </div>
            </details>

            {/* Row table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                    <th className="pb-2 pr-3">Student name</th>
                    <th className="pb-2 pr-3">Year group <span className="font-normal normal-case">(optional)</span></th>
                    <th className="pb-2 pr-3">
                      {gradeFormat === "GCSE" && "GCSE grade (1–9)"}
                      {gradeFormat === "A_LEVEL" && "A Level grade"}
                      {gradeFormat === "PERCENTAGE" && "Percentage (0–100)"}
                      {gradeFormat === "RAW" && `Raw score (0–${maxScore || "max"})`}
                    </th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--outline-variant)]/20">
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-3">
                        <input
                          className="field w-full"
                          placeholder="Student name"
                          value={row.studentName}
                          onChange={(e) => updateRow(i, "studentName", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          className="field w-full"
                          placeholder={yearGroup || "Year group"}
                          value={row.yearGroup}
                          onChange={(e) => updateRow(i, "yearGroup", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input
                          className="field w-32"
                          placeholder={GRADE_FORMAT_PLACEHOLDERS[gradeFormat]}
                          value={row.rawValue}
                          onChange={(e) => updateRow(i, "rawValue", e.target.value)}
                        />
                      </td>
                      <td className="py-1.5">
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(i)}
                            className="text-[var(--on-surface-muted)] hover:text-[var(--error)]"
                            aria-label="Remove row"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addRow}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              + Add row
            </button>
          </Card>

          <Card tone="subtle" className="space-y-3">
            <p className="text-sm text-[var(--on-surface-muted)]">
              <span className="font-medium text-[var(--on-surface)]">
                {rows.filter((r) => r.studentName.trim() && r.rawValue.trim()).length} valid rows
              </span>{" "}
              ready to submit. If a student name matches an existing record in the system, the result
              will be linked to them. Otherwise a new student record will be created automatically.
            </p>
            {submitError && <p className="text-sm text-[var(--error)]">{submitError}</p>}
            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={
                  submitLoading ||
                  rows.filter((r) => r.studentName.trim() && r.rawValue.trim()).length === 0
                }
              >
                {submitLoading
                  ? "Saving…"
                  : `Save ${rows.filter((r) => r.studentName.trim() && r.rawValue.trim()).length} result${rows.filter((r) => r.studentName.trim() && r.rawValue.trim()).length !== 1 ? "s" : ""}`}
              </Button>
              <Button variant="ghost" onClick={() => setStep("setup")}>
                Back
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
