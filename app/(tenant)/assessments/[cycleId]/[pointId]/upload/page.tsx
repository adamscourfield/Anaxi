"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import type { GradeFormat } from "@prisma/client";

type Step = "define" | "upload" | "preview" | "done";

type PreviewRecord = {
  upn: string;
  studentName: string;
  subject: string;
  rawValue: string;
};

const GRADE_FORMAT_LABELS: Record<GradeFormat, string> = {
  GCSE: "GCSE (1–9)",
  A_LEVEL: "A Level (A*–U)",
  PERCENTAGE: "Percentage (0–100%)",
  RAW: "Raw score (requires max score)",
};

export default function AssessmentUploadPage() {
  const { pointId } = useParams<{ cycleId: string; pointId: string }>();
  const router = useRouter();

  const [step, setStep] = useState<Step>("define");

  // Step 1: define assessment
  const [subject, setSubject] = useState("");
  const [yearGroup, setYearGroup] = useState("");
  const [title, setTitle] = useState("");
  const [gradeFormat, setGradeFormat] = useState<GradeFormat>("GCSE");
  const [maxScore, setMaxScore] = useState("");
  const [defineError, setDefineError] = useState<string | null>(null);
  const [defineLoading, setDefineLoading] = useState(false);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  // Step 2: upload CSV
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRecord[]>([]);
  const [previewErrors, setPreviewErrors] = useState<Array<{ rowNumber: number; field: string; message: string }>>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  // Step 3: import summary
  const [importResult, setImportResult] = useState<{
    rowsProcessed: number;
    rowsFailed: number;
    importJobId: string;
  } | null>(null);

  async function handleDefine(e: React.FormEvent) {
    e.preventDefault();
    setDefineError(null);
    setDefineLoading(true);

    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointId,
          subject,
          yearGroup,
          title: title || `${subject} — ${yearGroup}`,
          gradeFormat,
          maxScore: gradeFormat === "RAW" ? Number(maxScore) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setDefineError(data.error || "Failed to create assessment");
        return;
      }
      const data = await res.json();
      setAssessmentId(data.assessment.id);
      setStep("upload");
    } finally {
      setDefineLoading(false);
    }
  }

  async function handlePreview() {
    const file = fileRef.current?.files?.[0];
    if (!file || !assessmentId) return;
    setUploadError(null);
    setUploadLoading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("previewOnly", "true");

      const res = await fetch(`/api/assessments/${assessmentId}/import`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error || "Failed to parse file");
        return;
      }
      const data = await res.json();
      setPreview(data.preview);
      setPreviewErrors(data.errors);
      setTotalRecords(data.totalRecords);
      setStep("preview");
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file || !assessmentId) return;
    setUploadLoading(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`/api/assessments/${assessmentId}/import`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error || "Import failed");
        setStep("upload");
        return;
      }
      const data = await res.json();
      setImportResult(data.summary);
      setStep("done");
    } finally {
      setUploadLoading(false);
    }
  }

  if (step === "done" && importResult) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="Import complete" />
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Results imported</p>
              <p className="text-2xl font-semibold text-success">{importResult.rowsProcessed}</p>
            </div>
            {importResult.rowsFailed > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Rows with errors</p>
                <p className="text-2xl font-semibold text-error">{importResult.rowsFailed}</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => router.push(`/assessments/results/${assessmentId}`)}>
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
      <PageHeader
        title="Upload Assessment Results"
        subtitle="Define the assessment, upload a CSV, and review before importing."
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["define", "upload", "preview"] as Step[]).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted">→</span>}
            <span className={step === s ? "font-semibold text-accent" : "text-muted"}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </span>
        ))}
      </div>

      {/* Step 1: Define */}
      {step === "define" && (
        <Card className="space-y-4">
          <SectionHeader
            title="Define the assessment"
            subtitle="This tells Anaxi how to interpret the grades in your CSV."
          />
          <form onSubmit={handleDefine} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text">Subject</label>
                <input
                  className="field w-full"
                  placeholder="e.g. Maths"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text">Year group</label>
                <input
                  className="field w-full"
                  placeholder="e.g. Year 11"
                  value={yearGroup}
                  onChange={(e) => setYearGroup(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Assessment title (optional)</label>
              <input
                className="field w-full"
                placeholder={`e.g. ${subject || "Maths"} Mock 1 — ${yearGroup || "Year 11"}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-text">Grade format</label>
              <select
                className="field w-full"
                value={gradeFormat}
                onChange={(e) => setGradeFormat(e.target.value as GradeFormat)}
              >
                {Object.entries(GRADE_FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {gradeFormat === "RAW" && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-text">Maximum score</label>
                <input
                  type="number"
                  className="field w-32"
                  placeholder="e.g. 80"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                  required
                  min={1}
                />
              </div>
            )}
            {defineError && <p className="text-sm text-error">{defineError}</p>}
            <Button type="submit" disabled={defineLoading}>
              {defineLoading ? "Creating…" : "Continue to upload"}
            </Button>
          </form>
        </Card>
      )}

      {/* Step 2: Upload */}
      {step === "upload" && (
        <Card className="space-y-4">
          <SectionHeader
            title="Upload CSV"
            subtitle="Your file should have a UPN column and either a grade column per subject (wide) or Subject + Grade columns (long)."
          />

          <div className="rounded-lg bg-bg p-4 text-sm">
            <p className="font-medium text-text">Wide format example:</p>
            <pre className="mt-1 text-xs text-muted">UPN, Name, Maths, English, Science</pre>
            <pre className="text-xs text-muted">A123456789, Jane Smith, 7, 6, 8</pre>
            <p className="mt-3 font-medium text-text">Long format example:</p>
            <pre className="mt-1 text-xs text-muted">UPN, Name, Subject, Grade</pre>
            <pre className="text-xs text-muted">A123456789, Jane Smith, Maths, 7</pre>
            <p className="mt-2 text-xs text-muted">
              Use <span className="font-mono">ABS</span> or <span className="font-mono">N/A</span> for
              absent students. Use <span className="font-mono">W</span> for withdrawn.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-text">CSV file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="block text-sm text-text file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm"
            />
          </div>

          {uploadError && <p className="text-sm text-error">{uploadError}</p>}

          <div className="flex gap-3">
            <Button onClick={handlePreview} disabled={uploadLoading}>
              {uploadLoading ? "Parsing…" : "Preview import"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("define")}>
              Back
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <Card className="space-y-4">
          <SectionHeader
            title="Review before importing"
            subtitle={`${totalRecords} result${totalRecords !== 1 ? "s" : ""} found${previewErrors.length > 0 ? ` — ${previewErrors.length} row${previewErrors.length !== 1 ? "s" : ""} with errors` : ""}`}
          />

          {previewErrors.length > 0 && (
            <div className="rounded-lg bg-error/10 p-3 text-sm">
              <p className="font-medium text-error">
                {previewErrors.length} error{previewErrors.length !== 1 ? "s" : ""} detected
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-error/80">
                {previewErrors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    Row {e.rowNumber} — {e.field}: {e.message}
                  </li>
                ))}
                {previewErrors.length > 5 && (
                  <li>…and {previewErrors.length - 5} more</li>
                )}
              </ul>
              <p className="mt-2 text-xs text-muted">
                Rows with errors will be skipped. Valid rows will still be imported.
              </p>
            </div>
          )}

          {preview.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg/60 text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">UPN</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-muted">{r.upn}</td>
                      <td className="px-3 py-2 text-text">{r.studentName}</td>
                      <td className="px-3 py-2 text-text">{r.subject}</td>
                      <td className="px-3 py-2 font-semibold text-accent">{r.rawValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalRecords > 20 && (
                <p className="mt-2 px-3 text-xs text-muted">
                  Showing first 20 of {totalRecords} results.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={uploadLoading}>
              {uploadLoading ? "Importing…" : `Import ${totalRecords - previewErrors.length} results`}
            </Button>
            <Button variant="ghost" onClick={() => setStep("upload")}>
              Change file
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
