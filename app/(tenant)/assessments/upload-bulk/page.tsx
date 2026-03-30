"use client";

/**
 * Bulk CSV Upload
 *
 * Uploads a single CSV file containing grades for multiple subjects
 * for an entire year group in one go. The file auto-detects subject columns
 * and creates one Assessment record per subject.
 *
 * Supports:
 *   - GCSE wide format: Name, PP, SEND, Gender, Maths, English Language, ...
 *   - A-Level wide format: "Lastname, Firstname", Maths, Biology, History, ...
 *   - Both with or without UPN
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import type { GradeFormat } from "@prisma/client";

type Cycle = {
  id: string;
  label: string;
  isActive: boolean;
  points: Array<{ id: string; label: string; ordinal: number }>;
};

type Step = "setup" | "detect" | "confirm" | "done";

type PreviewRecord = {
  upn: string;
  studentName: string;
  subject: string;
  rawValue: string;
};

type SubjectCount = Record<string, number>;

const GRADE_FORMAT_LABELS: Record<GradeFormat, string> = {
  GCSE: "GCSE (1–9 numeric)",
  A_LEVEL: "A Level (A*–U letter grades)",
  PERCENTAGE: "Percentage (0–100%)",
  RAW: "Raw score (requires max score)",
};

const YEAR_GROUP_SUGGESTIONS = [
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11",
  "Year 12", "Year 13",
];

export default function BulkUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [selectedPointId, setSelectedPointId] = useState("");
  const [yearGroup, setYearGroup] = useState("");
  const [gradeFormat, setGradeFormat] = useState<GradeFormat>("GCSE");
  const [step, setStep] = useState<Step>("setup");

  const [detectedSubjects, setDetectedSubjects] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewRecord[]>([]);
  const [previewErrors, setPreviewErrors] = useState<Array<{ rowNumber: number; field: string; message: string }>>([]);
  const [subjectCounts, setSubjectCounts] = useState<SubjectCount>({});
  const [totalRecords, setTotalRecords] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<{
    subjectsImported: number;
    totalProcessed: number;
    totalFailed: number;
    results: Array<{ subject: string; assessmentId: string; rowsProcessed: number; rowsFailed: number }>;
  } | null>(null);

  useEffect(() => {
    fetch("/api/assessments/cycles")
      .then((r) => r.json())
      .then(({ cycles: c }) => {
        setCycles(c ?? []);
        const active = c?.find((x: Cycle) => x.isActive) ?? c?.[0];
        if (active) {
          setSelectedCycleId(active.id);
          const latest = active.points?.[active.points.length - 1];
          if (latest) setSelectedPointId(latest.id);
        }
      })
      .catch(() => {});
  }, []);

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  async function handleDetect() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Please select a CSV file."); return; }
    if (!selectedPointId) { setError("Please select an assessment point."); return; }
    if (!yearGroup.trim()) { setError("Please enter a year group."); return; }

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("pointId", selectedPointId);
    form.append("yearGroup", yearGroup.trim());
    form.append("gradeFormat", gradeFormat);
    form.append("previewOnly", "true");

    try {
      const res = await fetch("/api/assessments/bulk-import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to parse file"); return; }

      setDetectedSubjects(data.detectedSubjects ?? []);
      setSelectedSubjects(new Set(data.detectedSubjects ?? []));
      setPreview(data.preview ?? []);
      setPreviewErrors(data.errors ?? []);
      setSubjectCounts(data.subjectCounts ?? {});
      setTotalRecords(data.totalRecords ?? 0);
      setStep("detect");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file || selectedSubjects.size === 0) return;

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("pointId", selectedPointId);
    form.append("yearGroup", yearGroup.trim());
    form.append("gradeFormat", gradeFormat);
    form.append("subjects", JSON.stringify([...selectedSubjects]));

    try {
      const res = await fetch("/api/assessments/bulk-import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Import failed"); return; }
      setImportResult(data);
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  function toggleSubject(s: string) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  if (step === "done" && importResult) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Import complete" />
        <Card className="space-y-5">
          <SectionHeader
            title={`${importResult.subjectsImported} subject${importResult.subjectsImported !== 1 ? "s" : ""} imported`}
            subtitle={`${importResult.totalProcessed} results recorded`}
          />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]/30 text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                  <th className="pb-2 pr-4 text-left">Subject</th>
                  <th className="pb-2 pr-4 text-right">Imported</th>
                  <th className="pb-2 text-right">Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/20">
                {importResult.results.map((r) => (
                  <tr key={r.subject}>
                    <td className="py-2 pr-4 font-medium text-[var(--on-surface)]">
                      {r.subject}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-[var(--success)]">
                      {r.rowsProcessed}
                    </td>
                    <td className={`py-2 text-right tabular-nums ${r.rowsFailed > 0 ? "text-[var(--error)]" : "text-[var(--on-surface-muted)]"}`}>
                      {r.rowsFailed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => router.push("/assessments/key-measures")}>
              View Key Measures
            </Button>
            <Button variant="ghost" onClick={() => router.push("/assessments")}>
              Back to Assessments
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
          title="Bulk CSV Upload"
          subtitle="Upload one CSV with all subjects for an entire year group."
        />
        <a href="/assessments" className="text-sm text-[var(--on-surface-muted)] hover:underline">
          ← Assessments
        </a>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["setup", "detect", "confirm"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--on-surface-muted)]">→</span>}
            <span
              className={
                step === s
                  ? "font-semibold text-[var(--accent)]"
                  : "text-[var(--on-surface-muted)]"
              }
            >
              {i + 1}. {s === "setup" ? "Setup" : s === "detect" ? "Detect subjects" : "Confirm & import"}
            </span>
          </span>
        ))}
      </div>

      {/* Step 1: Setup */}
      {(step === "setup" || step === "detect") && (
        <Card className="space-y-5">
          <SectionHeader
            title="Setup"
            subtitle="Select the assessment point and upload your CSV."
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Assessment cycle</label>
              <select
                className="field w-full"
                value={selectedCycleId}
                onChange={(e) => {
                  setSelectedCycleId(e.target.value);
                  const c = cycles.find((x) => x.id === e.target.value);
                  const latest = c?.points?.[c.points.length - 1];
                  setSelectedPointId(latest?.id ?? "");
                }}
              >
                <option value="">Select cycle…</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                    {c.isActive ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedCycle && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--on-surface)]">Assessment point</label>
                <select
                  className="field w-full"
                  value={selectedPointId}
                  onChange={(e) => setSelectedPointId(e.target.value)}
                >
                  <option value="">Select point…</option>
                  {selectedCycle.points.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Year group</label>
              <input
                className="field w-full"
                list="year-group-list"
                placeholder="e.g. Year 11"
                value={yearGroup}
                onChange={(e) => setYearGroup(e.target.value)}
              />
              <datalist id="year-group-list">
                {YEAR_GROUP_SUGGESTIONS.map((y) => (
                  <option key={y} value={y} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Grade format</label>
              <select
                className="field w-full"
                value={gradeFormat}
                onChange={(e) => setGradeFormat(e.target.value as GradeFormat)}
              >
                {Object.entries(GRADE_FORMAT_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--on-surface)]">CSV file</label>
            <div className="rounded-xl bg-[var(--surface-container-low)] p-4 text-sm space-y-2">
              <p className="font-medium text-[var(--on-surface)]">Expected format:</p>
              <div className="space-y-1 text-xs text-[var(--on-surface-muted)]">
                <p>
                  <span className="font-medium">GCSE:</span>{" "}
                  <code className="rounded bg-[var(--surface-container)] px-1">Name, PP, SEND, Gender, Maths, English Language, Science, …</code>
                </p>
                <p>
                  <span className="font-medium">A-Level:</span>{" "}
                  <code className="rounded bg-[var(--surface-container)] px-1">&quot;Lastname, Firstname&quot;, Maths, Biology, History, …</code>
                </p>
                <p className="text-[10px] mt-1">
                  Non-grade columns (PP, SEND, Gender, Attendance, etc.) are automatically excluded.
                  Blank cells are skipped (student didn&apos;t sit that subject).
                  Use <code>ABS</code> or <code>Absent</code> for absent students.
                </p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="block text-sm text-[var(--on-surface)] file:mr-3 file:rounded-lg file:border file:border-[var(--outline-variant)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm"
            />
          </div>

          {error && <p className="text-sm text-[var(--error)]">{error}</p>}

          <Button onClick={handleDetect} disabled={loading}>
            {loading ? "Detecting subjects…" : "Detect subjects →"}
          </Button>
        </Card>
      )}

      {/* Step 2: Detect & select subjects */}
      {step === "detect" && detectedSubjects.length > 0 && (
        <Card className="space-y-5">
          <SectionHeader
            title="Detected subjects"
            subtitle={`${detectedSubjects.length} subject column${detectedSubjects.length !== 1 ? "s" : ""} found in the CSV. Select which to import.`}
          />

          <div className="flex gap-2 flex-wrap mb-2">
            <button
              className="text-xs text-[var(--accent)] hover:underline"
              onClick={() => setSelectedSubjects(new Set(detectedSubjects))}
            >
              Select all
            </button>
            <span className="text-xs text-[var(--on-surface-muted)]">·</span>
            <button
              className="text-xs text-[var(--accent)] hover:underline"
              onClick={() => setSelectedSubjects(new Set())}
            >
              Deselect all
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {detectedSubjects.map((s) => (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--outline-variant)] p-2.5 hover:bg-[var(--surface-container-low)]"
              >
                <input
                  type="checkbox"
                  checked={selectedSubjects.has(s)}
                  onChange={() => toggleSubject(s)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="text-sm font-medium text-[var(--on-surface)]">{s}</span>
                {subjectCounts[s] !== undefined && (
                  <span className="ml-auto text-xs text-[var(--on-surface-muted)]">
                    {subjectCounts[s]}
                  </span>
                )}
              </label>
            ))}
          </div>

          {previewErrors.length > 0 && (
            <div className="rounded-xl bg-[var(--error)]/10 p-3 text-sm">
              <p className="font-medium text-[var(--error)]">
                {previewErrors.length} parsing issue{previewErrors.length !== 1 ? "s" : ""} detected
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[var(--error)]/80 text-xs">
                {previewErrors.slice(0, 5).map((e, i) => (
                  <li key={i}>Row {e.rowNumber} — {e.field}: {e.message}</li>
                ))}
                {previewErrors.length > 5 && <li>…and {previewErrors.length - 5} more</li>}
              </ul>
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="overflow-x-auto">
              <p className="mb-2 text-xs text-[var(--on-surface-muted)]">
                Preview (first {preview.length} records of {totalRecords}):
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]/30 text-left text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                    <th className="pb-1.5 pr-3">Student</th>
                    <th className="pb-1.5 pr-3">Subject</th>
                    <th className="pb-1.5">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-b border-[var(--outline-variant)]/20 last:border-0">
                      <td className="py-1.5 pr-3 text-[var(--on-surface)]">{r.studentName}</td>
                      <td className="py-1.5 pr-3 text-[var(--on-surface-muted)]">{r.subject}</td>
                      <td className="py-1.5 font-semibold text-[var(--accent)]">{r.rawValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="text-sm text-[var(--error)]">{error}</p>}

          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={loading || selectedSubjects.size === 0}
            >
              {loading
                ? "Importing…"
                : `Import ${selectedSubjects.size} subject${selectedSubjects.size !== 1 ? "s" : ""}`}
            </Button>
            <Button variant="ghost" onClick={() => setStep("setup")}>
              Back
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
