"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import type { GradeFormat } from "@prisma/client";

type Step = "setup" | "detect" | "done";

type PreviewRecord = {
  upn: string;
  studentName: string;
  subject: string;
  rawValue: string;
};

const GRADE_FORMAT_LABELS: Record<GradeFormat, string> = {
  GCSE: "GCSE (1–9 numeric)",
  A_LEVEL: "A Level (A*–U letter grades)",
  PERCENTAGE: "Percentage (0–100%)",
  RAW: "Raw score",
};

const YEAR_GROUP_SUGGESTIONS = [
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11",
  "Year 12", "Year 13",
];

export default function UploadSubjectResultsPage() {
  const { cycleId, pointId } = useParams<{ cycleId: string; pointId: string }>();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pointLabel, setPointLabel] = useState("");
  const [cycleLabel, setCycleLabel] = useState("");
  const [qualificationType, setQualificationType] = useState<string>("GCSE");
  const [isLocked, setIsLocked] = useState(false);

  const [yearGroup, setYearGroup] = useState("");
  const [gradeFormat, setGradeFormat] = useState<GradeFormat>("GCSE");
  const [step, setStep] = useState<Step>("setup");

  const [detectedSubjects, setDetectedSubjects] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewRecord[]>([]);
  const [previewErrors, setPreviewErrors] = useState<Array<{ rowNumber: number; field: string; message: string }>>([]);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});
  const [totalRecords, setTotalRecords] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<{
    subjectsImported: number;
    totalProcessed: number;
    totalFailed: number;
    results: Array<{ subject: string; rowsProcessed: number; rowsFailed: number }>;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/assessments/points/${pointId}`)
      .then((r) => r.json())
      .then(({ point }) => {
        setPointLabel(point?.label ?? "");
        setCycleLabel(point?.cycle?.label ?? "");
        setQualificationType(point?.cycle?.qualificationType ?? "GCSE");
        setIsLocked(point?.resultStatus === "LOCKED");
        // Auto-set grade format from qualification type
        if (point?.cycle?.qualificationType === "A_LEVEL") setGradeFormat("A_LEVEL");
        else if (point?.cycle?.qualificationType === "GCSE") setGradeFormat("GCSE");
        else if (point?.cycle?.qualificationType === "PERCENTAGE") setGradeFormat("PERCENTAGE");
      })
      .catch(() => {});
  }, [pointId]);

  async function handleDetect() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Select a CSV file."); return; }
    if (!yearGroup.trim()) { setError("Enter the year group."); return; }

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("yearGroup", yearGroup.trim());
    form.append("gradeFormat", gradeFormat);
    form.append("previewOnly", "true");

    try {
      const res = await fetch(`/api/assessments/points/${pointId}/upload`, { method: "POST", body: form });
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
    form.append("yearGroup", yearGroup.trim());
    form.append("gradeFormat", gradeFormat);
    form.append("subjects", JSON.stringify([...selectedSubjects]));

    try {
      const res = await fetch(`/api/assessments/points/${pointId}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Import failed"); return; }
      setImportResult(data);
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done" && importResult) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Upload complete" />
        <Card className="space-y-5">
          <SectionHeader
            title={`${importResult.subjectsImported} subject${importResult.subjectsImported !== 1 ? "s" : ""} uploaded`}
            subtitle={`${importResult.totalProcessed} entries matched to students`}
          />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]/30 text-left text-xs font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4 text-right">Matched</th>
                  <th className="pb-2 text-right">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]/20">
                {importResult.results.map((r) => (
                  <tr key={r.subject}>
                    <td className="py-2 pr-4 font-medium">{r.subject}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-[var(--success)]">{r.rowsProcessed}</td>
                    <td className={`py-2 text-right tabular-nums ${r.rowsFailed > 0 ? "text-[var(--error)]" : "text-[var(--on-surface-muted)]"}`}>
                      {r.rowsFailed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => router.push(`/assessments/${cycleId}/points/${pointId}`)}>
              View analysis
            </Button>
            <Button variant="ghost" onClick={() => { setStep("setup"); setImportResult(null); }}>
              Upload another file
            </Button>
            <Button variant="ghost" onClick={() => router.push(`/assessments/${cycleId}`)}>
              Back to cycle
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Result point locked" subtitle="This result point has been locked and cannot accept new uploads." />
        <Button variant="ghost" onClick={() => router.push(`/assessments/${cycleId}`)}>← Back to cycle</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-[var(--on-surface-muted)]">
        <a href="/assessments" className="hover:underline">Cycles</a>
        <span>›</span>
        <a href={`/assessments/${cycleId}`} className="hover:underline">{cycleLabel || "Cycle"}</a>
        <span>›</span>
        <span className="text-[var(--on-surface)]">Upload — {pointLabel || "Result point"}</span>
      </div>

      <PageHeader
        title="Upload Subject Results"
        subtitle="Upload a CSV with grades for one or more subjects. The system will auto-detect subject columns."
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["setup", "detect"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-[var(--on-surface-muted)]">→</span>}
            <span className={step === s ? "font-semibold text-[var(--accent)]" : "text-[var(--on-surface-muted)]"}>
              {i + 1}. {s === "setup" ? "File & format" : "Select subjects"}
            </span>
          </span>
        ))}
      </div>

      {/* Step 1 */}
      {(step === "setup" || step === "detect") && (
        <Card className="space-y-5">
          <SectionHeader title="Upload file" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Year group</label>
              <input
                className="field w-full"
                list="yg-list"
                placeholder="e.g. Year 11"
                value={yearGroup}
                onChange={(e) => setYearGroup(e.target.value)}
              />
              <datalist id="yg-list">
                {YEAR_GROUP_SUGGESTIONS.map((y) => <option key={y} value={y} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Grade format</label>
              <select className="field w-full" value={gradeFormat} onChange={(e) => setGradeFormat(e.target.value as GradeFormat)}>
                {Object.entries(GRADE_FORMAT_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--on-surface)]">CSV file</label>
            <div className="rounded-xl bg-[var(--surface-container-low)] p-3 text-xs text-[var(--on-surface-muted)] space-y-1">
              <p><span className="font-medium">GCSE:</span> Name, PP, SEND, Gender, Maths, English Language, Biology…</p>
              <p><span className="font-medium">A-Level:</span> &quot;Lastname, Firstname&quot;, Maths, Biology, History…</p>
              <p>Non-grade columns (PP, SEND, Gender, Attendance) are automatically excluded. Blank cells = subject not taken.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="block text-sm text-[var(--on-surface)] file:mr-3 file:rounded-lg file:border file:border-[var(--outline-variant)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm"
            />
            <a
              href={`/api/assessments/template${yearGroup.trim() ? `?yearGroup=${encodeURIComponent(yearGroup.trim())}` : ""}`}
              className="inline-block text-xs font-medium text-[var(--accent)] underline underline-offset-2"
            >
              Download pre-populated attainment template
            </a>
          </div>

          {error && <p className="text-sm text-[var(--error)]">{error}</p>}

          <Button onClick={handleDetect} disabled={loading}>
            {loading ? "Reading file…" : "Detect subjects →"}
          </Button>
        </Card>
      )}

      {/* Step 2: select subjects */}
      {step === "detect" && detectedSubjects.length > 0 && (
        <Card className="space-y-5">
          <SectionHeader
            title="Select subjects to import"
            subtitle={`${detectedSubjects.length} subject column${detectedSubjects.length !== 1 ? "s" : ""} found. Deselect any you don't want to import.`}
          />

          <div className="flex gap-3 text-xs">
            <button className="text-[var(--accent)] hover:underline" onClick={() => setSelectedSubjects(new Set(detectedSubjects))}>Select all</button>
            <button className="text-[var(--accent)] hover:underline" onClick={() => setSelectedSubjects(new Set())}>Deselect all</button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {detectedSubjects.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--outline-variant)] p-2.5 hover:bg-[var(--surface-container-low)]">
                <input
                  type="checkbox"
                  checked={selectedSubjects.has(s)}
                  onChange={() => {
                    setSelectedSubjects((prev) => {
                      const next = new Set(prev);
                      if (next.has(s)) next.delete(s); else next.add(s);
                      return next;
                    });
                  }}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="text-sm font-medium">{s}</span>
                {subjectCounts[s] !== undefined && (
                  <span className="ml-auto text-xs text-[var(--on-surface-muted)]">{subjectCounts[s]}</span>
                )}
              </label>
            ))}
          </div>

          {previewErrors.length > 0 && (
            <div className="rounded-xl bg-[var(--error)]/10 p-3 text-xs">
              <p className="font-medium text-[var(--error)]">{previewErrors.length} parsing issue{previewErrors.length !== 1 ? "s" : ""}</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-[var(--error)]/80">
                {previewErrors.slice(0, 5).map((e, i) => (
                  <li key={i}>Row {e.rowNumber} — {e.field}: {e.message}</li>
                ))}
                {previewErrors.length > 5 && <li>…and {previewErrors.length - 5} more</li>}
              </ul>
            </div>
          )}

          {preview.length > 0 && (
            <div className="overflow-x-auto">
              <p className="mb-1.5 text-xs text-[var(--on-surface-muted)]">Preview ({Math.min(preview.length, 20)} of {totalRecords} records)</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--outline-variant)]/30 text-[10px] font-medium uppercase tracking-wide text-[var(--on-surface-muted)]">
                    <th className="pb-1.5 pr-3 text-left">Student</th>
                    <th className="pb-1.5 pr-3 text-left">Subject</th>
                    <th className="pb-1.5 text-left">Grade</th>
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
            <Button onClick={handleImport} disabled={loading || selectedSubjects.size === 0}>
              {loading ? "Importing…" : `Import ${selectedSubjects.size} subject${selectedSubjects.size !== 1 ? "s" : ""}`}
            </Button>
            <Button variant="ghost" onClick={() => setStep("setup")}>Back</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
