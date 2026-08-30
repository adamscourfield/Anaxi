"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import { AttainmentWizardSteps } from "@/components/assessments/AttainmentWizardSteps";
import { CsvFileDropzone } from "@/components/assessments/CsvFileDropzone";
import { LockedPointBanner } from "@/components/assessments/LockedPointBanner";
import { toast } from "@/components/toast-provider";
import { stageForQualificationType } from "@/lib/subjectStages";
import type { GradeFormat } from "@prisma/client";

const UPLOAD_STEPS = [
  { id: "setup", label: "File & format" },
  { id: "detect", label: "Select subjects" },
] as const;

function yearGroupStorageKey(cycleId: string) {
  return `anaxi-attainment-yg-${cycleId}`;
}

function templateSubjectsStorageKey(cycleId: string) {
  return `anaxi-attainment-template-subjects-${cycleId}`;
}

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
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [pointLabel, setPointLabel] = useState("");
  const [cycleLabel, setCycleLabel] = useState("");
  const [qualificationType, setQualificationType] = useState<string>("GCSE");
  const [isLocked, setIsLocked] = useState(false);
  const [hasExistingUpload, setHasExistingUpload] = useState(false);

  const [yearGroup, setYearGroup] = useState("");
  const [templateSubjectChips, setTemplateSubjectChips] = useState<string[]>([]);
  const [subjectInputValue, setSubjectInputValue] = useState("");
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
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
    parseErrors?: number;
    results: Array<{ subject: string; rowsProcessed: number; rowsFailed: number }>;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(yearGroupStorageKey(cycleId));
      if (saved) setYearGroup(saved);
      const savedSubjects = localStorage.getItem(templateSubjectsStorageKey(cycleId));
      if (savedSubjects) {
        try {
          const parsed = JSON.parse(savedSubjects);
          if (Array.isArray(parsed)) setTemplateSubjectChips(parsed);
        } catch {
          // ignore malformed storage from an older version of this field
        }
      }
    }
  }, [cycleId]);

  useEffect(() => {
    if (yearGroup.trim()) {
      localStorage.setItem(yearGroupStorageKey(cycleId), yearGroup.trim());
    }
  }, [yearGroup, cycleId]);

  useEffect(() => {
    localStorage.setItem(templateSubjectsStorageKey(cycleId), JSON.stringify(templateSubjectChips));
  }, [templateSubjectChips, cycleId]);

  useEffect(() => {
    const stage = stageForQualificationType(qualificationType);
    fetch(`/api/assessments/subjects${stage ? `?stage=${stage}` : ""}`)
      .then((r) => r.json())
      .then((data) => setSubjectSuggestions(data.subjects ?? []))
      .catch(() => {});
  }, [qualificationType]);

  function addTemplateSubject(raw: string) {
    const name = raw.trim();
    if (!name) return;
    const alreadySuggested = subjectSuggestions.some((s) => s.toLowerCase() === name.toLowerCase());
    setTemplateSubjectChips((prev) =>
      prev.some((s) => s.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name]
    );
    setSubjectInputValue("");

    // A name typed that doesn't match an existing suggestion is a genuinely
    // new subject -- register it as canonical so future uploads/cycles
    // suggest this exact spelling instead of it staying a one-off.
    if (!alreadySuggested) {
      const stage = stageForQualificationType(qualificationType);
      fetch("/api/assessments/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stage }),
      })
        .then(() => setSubjectSuggestions((prev) => (prev.includes(name) ? prev : [...prev, name].sort())))
        .catch(() => {});
    }
  }

  function removeTemplateSubject(name: string) {
    setTemplateSubjectChips((prev) => prev.filter((s) => s !== name));
  }

  useEffect(() => {
    fetch(`/api/assessments/points/${pointId}`)
      .then((r) => r.json())
      .then(({ point }) => {
        setPointLabel(point?.label ?? "");
        setCycleLabel(point?.cycle?.label ?? "");
        setQualificationType(point?.cycle?.qualificationType ?? "GCSE");
        setIsLocked(point?.resultStatus === "LOCKED");
        setHasExistingUpload((point?.assessments?.length ?? 0) > 0);
        if (point?.cycle?.qualificationType === "A_LEVEL") setGradeFormat("A_LEVEL");
        else if (point?.cycle?.qualificationType === "GCSE") setGradeFormat("GCSE");
        else if (point?.cycle?.qualificationType === "PERCENTAGE") setGradeFormat("PERCENTAGE");
      })
      .catch(() => {});
  }, [pointId]);

  async function handleDetect() {
    const file = csvFile;
    if (!file) { setError("Select a CSV file."); toast("Select a CSV file.", "error"); return; }
    if (!yearGroup.trim()) { setError("Enter the year group."); toast("Enter the year group.", "error"); return; }

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
      if (!res.ok) { setError(data.error || "Failed to parse file"); toast(data.error || "Failed to parse file", "error"); return; }

      setDetectedSubjects(data.detectedSubjects ?? []);
      setSelectedSubjects(new Set(data.detectedSubjects ?? []));
      setPreview(data.preview ?? []);
      setPreviewErrors(data.errors ?? []);
      setSubjectCounts(data.subjectCounts ?? {});
      setTotalRecords(data.totalRecords ?? 0);
      setStep("detect");
      toast("Subjects detected from file", "success");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    const file = csvFile;
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
      if (!res.ok) { setError(data.error || "Import failed"); toast(data.error || "Import failed", "error"); return; }
      setImportResult(data);
      const failed = data.totalFailed ?? 0;
      toast(
        failed > 0
          ? `Imported with ${failed} unmatched row${failed !== 1 ? "s" : ""} — see summary below.`
          : `Imported ${data.subjectsImported ?? 0} subject${(data.subjectsImported ?? 0) !== 1 ? "s" : ""} (${data.totalProcessed ?? 0} entries).`,
        failed > 0 ? "error" : "success",
      );
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done" && importResult) {
    return (
      <AttainmentPageShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <AssessmentsBreadcrumb
          items={[
            { label: "Attainment", href: "/assessments" },
            { label: cycleLabel || "Cycle", href: `/assessments/${cycleId}` },
            { label: "Upload complete" },
          ]}
        />
        <PageHeader variant="ledger" eyebrow="Attainment" title="Upload complete" subtitle="Your file was processed and results are being matched to students." />
        <Card className="space-y-5">
          <SectionHeader
            title={`${importResult.subjectsImported} subject${importResult.subjectsImported !== 1 ? "s" : ""} uploaded`}
            subtitle={`${importResult.totalProcessed} entries matched to students${importResult.totalFailed > 0 ? ` · ${importResult.totalFailed} rows could not be matched` : ""}`}
          />
          {(importResult.totalFailed > 0 || (importResult.parseErrors ?? 0) > 0) && (
            <div className="rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/10 p-3 text-sm text-text">
              <p className="font-semibold text-[var(--error)]">Import issues</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
                {importResult.totalFailed > 0 && (
                  <li>
                    {importResult.totalFailed} row{importResult.totalFailed !== 1 ? "s" : ""} could not be matched to a student (check UPN/name in your student register).
                  </li>
                )}
                {(importResult.parseErrors ?? 0) > 0 && (
                  <li>{importResult.parseErrors} CSV parsing warning{(importResult.parseErrors ?? 0) !== 1 ? "s" : ""} were ignored during import.</li>
                )}
                {importResult.results.filter((r) => r.rowsFailed > 0).map((r) => (
                  <li key={r.subject}>
                    {r.subject}: {r.rowsFailed} failed, {r.rowsProcessed} matched
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="table-shell border-0 rounded-none shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head-row text-left">
                    <th className="px-5 py-3.5">Subject</th>
                    <th className="px-4 py-3.5 text-right">Matched</th>
                    <th className="px-5 py-3.5 text-right">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.results.map((r) => (
                    <tr key={r.subject} className="table-row calm-transition">
                      <td className="px-5 py-3 font-medium">{r.subject}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--success)]">{r.rowsProcessed}</td>
                      <td className={`px-5 py-3 text-right tabular-nums ${r.rowsFailed > 0 ? "text-[var(--error)]" : "text-[var(--on-surface-muted)]"}`}>
                        {r.rowsFailed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
      </AttainmentPageShell>
    );
  }

  if (isLocked) {
    return (
      <AttainmentPageShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <AssessmentsBreadcrumb
          items={[
            { label: "Attainment", href: "/assessments" },
            { label: cycleLabel || "Cycle", href: `/assessments/${cycleId}` },
            { label: "Locked" },
          ]}
        />
        <PageHeader variant="ledger"
          eyebrow="Attainment"
          title="Result point locked"
          subtitle="This result point has been locked and cannot accept new uploads."
        />
        <LockedPointBanner status="LOCKED" cycleId={cycleId} />
        <Button variant="ghost" onClick={() => router.push(`/assessments/${cycleId}`)}>← Back to cycle</Button>
      </div>
      </AttainmentPageShell>
    );
  }

  return (
    <AttainmentPageShell>
    <div className="mx-auto max-w-3xl space-y-8">
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: cycleLabel || "Cycle", href: `/assessments/${cycleId}` },
          { label: pointLabel ? `Upload — ${pointLabel}` : "Upload results" },
        ]}
      />

      <PageHeader variant="ledger"
        eyebrow="Attainment"
        title="Upload subject results"
        subtitle="Upload a CSV with grades for one or more subjects. The system will auto-detect subject columns."
      />

      <AttainmentWizardSteps
        steps={[...UPLOAD_STEPS]}
        currentId={step === "detect" ? "detect" : "setup"}
      />

      {hasExistingUpload && (
        <p className="rounded-xl border border-border bg-surface-container-low px-4 py-3 text-sm text-muted">
          Re-importing replaces existing subject results for this year group on this result point. Other snapshots are unchanged.
        </p>
      )}

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

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--on-surface)]">Subjects for template (optional)</label>
            {templateSubjectChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {templateSubjectChips.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-container-low)] px-2.5 py-1 text-xs font-medium text-[var(--on-surface)]"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeTemplateSubject(s)}
                      className="text-[var(--on-surface-muted)] hover:text-[var(--error)]"
                      aria-label={`Remove ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              className="field w-full"
              list="subject-suggestions"
              placeholder="Type a subject and press Enter (pick from the list to keep names consistent)"
              value={subjectInputValue}
              onChange={(e) => setSubjectInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTemplateSubject(subjectInputValue);
                }
              }}
              onBlur={() => addTemplateSubject(subjectInputValue)}
            />
            <datalist id="subject-suggestions">
              {subjectSuggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
            <p className="text-xs text-[var(--on-surface-muted)]">
              Pick from previously-used subjects where possible so names stay consistent across cycles. The downloaded template will have one column per subject added above, prefilled with every student in the year group — fill in grades directly under each subject, one row per student.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--on-surface)]">CSV file</label>
            <div className="rounded-xl bg-[var(--surface-container-low)] p-3 text-xs text-[var(--on-surface-muted)] space-y-1">
              <p><span className="font-medium">GCSE:</span> Name, PP, SEND, Gender, Maths, English Language, Biology…</p>
              <p><span className="font-medium">A-Level:</span> &quot;Lastname, Firstname&quot;, Maths, Biology, History…</p>
              <p>Non-grade columns (PP, SEND, Gender, Attendance) are automatically excluded. Blank cells = subject not taken.</p>
            </div>
            <CsvFileDropzone
              file={csvFile}
              onFileChange={setCsvFile}
              inputRef={fileRef}
            />
            <a
              href={`/api/assessments/template?${new URLSearchParams({
                ...(yearGroup.trim() ? { yearGroup: yearGroup.trim() } : {}),
                ...(templateSubjectChips.length > 0 ? { subjects: templateSubjectChips.join(",") } : {}),
              }).toString()}`}
              className="link-accent inline-block text-xs font-medium"
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
            <button type="button" className="link-accent text-xs" onClick={() => setSelectedSubjects(new Set(detectedSubjects))}>Select all</button>
            <button type="button" className="link-accent text-xs" onClick={() => setSelectedSubjects(new Set())}>Deselect all</button>
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
              <p className="mb-2 text-xs text-[var(--on-surface-muted)]">
                Preview ({Math.min(preview.length, 20)} of {totalRecords} records)
              </p>
              <div className="table-shell table-shell--nested">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="table-head-row text-left">
                      <th className="px-4 py-2">Student</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-4 py-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 20).map((r, i) => (
                      <tr key={i} className="table-row calm-transition">
                        <td className="px-4 py-2 text-[var(--on-surface)]">{r.studentName}</td>
                        <td className="px-3 py-2 text-[var(--on-surface-muted)]">{r.subject}</td>
                        <td className="px-4 py-2 font-semibold text-[var(--accent)]">{r.rawValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
    </AttainmentPageShell>
  );
}
