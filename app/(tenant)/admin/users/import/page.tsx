"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { H1, H2, MetaText } from "@/components/ui/typography";
import { StatusPill } from "@/components/ui/status-pill";

interface PreviewRow {
  email: string;
  fullName: string;
  role: string;
  departments: string[];
  isHOD: boolean;
  hodDepartments: string[];
  coachEmail: string;
  membershipStatus: string;
}

interface ParseError {
  rowNumber: number;
  field: string;
  errorCode: string;
  message: string;
}

interface ImportJob {
  id: string;
  status: string;
  fileName: string;
  rowCount: number;
  rowsProcessed: number;
  rowsFailed: number;
  createdAt: string;
}

export default function StaffImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [validated, setValidated] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ jobId: string; rowsProcessed: number; rowsFailed: number } | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview([]);
    setParseErrors([]);
    setValidated(false);
    setImportResult(null);
    setError(null);

    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/admin/users/import/upload", { method: "POST", body: form });
    if (!res.ok) {
      setError("Failed to parse file");
      return;
    }
    const data = await res.json();
    setPreview(data.preview ?? []);
    setParseErrors(data.errors ?? []);
    setRowCount(data.rowCount ?? 0);
    setValidated(true);
  }

  async function handleImport() {
    if (!selectedFile) return;
    setImporting(true);
    setError(null);

    const form = new FormData();
    form.append("file", selectedFile);

    const res = await fetch("/api/admin/users/import/run", { method: "POST", body: form });
    setImporting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Import failed");
      return;
    }

    const data = await res.json();
    setImportResult({ jobId: data.jobId, rowsProcessed: data.rowsProcessed, rowsFailed: data.rowsFailed });
    await loadJobs();
  }

  async function loadJobs() {
    const res = await fetch("/api/admin/users/import/jobs");
    if (!res.ok) return;
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setJobsLoaded(true);
  }

  const blockingErrors = parseErrors.filter((e) => e.errorCode !== "MISSING_FULL_NAME");
  const canImport = validated && selectedFile !== null && blockingErrors.length === 0;

  return (
    <div className="space-y-6">
      <H1>Import Staff</H1>

      {/* Upload card */}
      <Card className="space-y-4">
        <H2 className="text-base">Upload CSV</H2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Choose CSV file
          </Button>
          {selectedFile && (
            <span className="text-sm text-text/70">{selectedFile.name}</span>
          )}
          <a
            href="/api/admin/users/import/template"
            download="staff-import-template.csv"
            className="calm-transition rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text hover:bg-bg"
          >
            Download template CSV
          </a>
        </div>
        {error && (
          <p className="text-sm text-error">{error}</p>
        )}
      </Card>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <Card className="space-y-3">
          <H2 className="text-base">
            Validation issues ({parseErrors.length})
          </H2>
          <ul className="space-y-1 text-sm">
            {parseErrors.slice(0, 20).map((e, i) => (
              <li key={i} className={e.errorCode === "MISSING_FULL_NAME" ? "text-warning" : "text-error"}>
                Row {e.rowNumber} — {e.field}: {e.message}
              </li>
            ))}
          </ul>
          {blockingErrors.length > 0 && (
            <p className="text-sm font-medium text-error">
              {blockingErrors.length} blocking error(s) must be resolved before importing.
            </p>
          )}
        </Card>
      )}

      {/* Preview card */}
      {preview.length > 0 && (
        <Card className="space-y-3">
          <H2 className="text-base">
            Preview (first {preview.length} of {rowCount} rows)
          </H2>
          <div className="overflow-x-auto">
            <div className="table-shell">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head-row text-left">
                    <th className="px-5 py-3.5">Email</th>
                    <th className="px-4 py-3.5">Full Name</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Departments</th>
                    <th className="px-4 py-3.5">HOD</th>
                    <th className="px-4 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="table-row calm-transition">
                      <td className="px-5 py-3 text-text">{row.email}</td>
                      <td className="px-4 py-3 text-text">{row.fullName}</td>
                      <td className="px-4 py-3 text-text">{row.role}</td>
                      <td className="px-4 py-3 text-text">{row.departments.join("; ")}</td>
                      <td className="px-4 py-3 text-text">{row.isHOD ? "Yes" : "No"}</td>
                      <td className="px-4 py-3 text-text">{row.membershipStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Import button */}
      {validated && (
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            disabled={!canImport || importing}
            onClick={handleImport}
          >
            {importing ? "Importing…" : "Validate & Import"}
          </Button>
          {!canImport && blockingErrors.length > 0 && (
            <span className="text-sm text-error">Fix validation errors before importing</span>
          )}
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <Card className="space-y-2">
          <H2 className="text-base">Import complete</H2>
          <p className="text-sm text-text">
            Rows processed: <strong>{importResult.rowsProcessed}</strong> &nbsp;|&nbsp; Rows failed:{" "}
            <strong>{importResult.rowsFailed}</strong>
          </p>
          {importResult.rowsFailed > 0 && (
            <a
              href={`/api/admin/users/import/jobs/${importResult.jobId}/errors.csv`}
              download
              className="link-accent text-sm"
            >
              Download error report CSV
            </a>
          )}
        </Card>
      )}

      {/* Import history */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <H2 className="text-base">Import history</H2>
          <Button variant="ghost" onClick={loadJobs}>
            {jobsLoaded ? "Refresh" : "Load history"}
          </Button>
        </div>
        {jobsLoaded && jobs.length === 0 && (
          <p className="text-sm text-text/60">No import jobs yet.</p>
        )}
        {jobs.length > 0 && (
          <div className="overflow-x-auto">
            <div className="table-shell">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="table-head-row text-left">
                    <th className="px-5 py-3.5">File</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Rows</th>
                    <th className="px-4 py-3.5 text-right">Failed</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="table-row calm-transition">
                      <td className="px-5 py-3 text-text">{job.fileName}</td>
                      <td className="px-4 py-3 text-text">{job.status}</td>
                      <td className="px-4 py-3 text-right text-text">{job.rowCount}</td>
                      <td className="px-4 py-3 text-right text-text">{job.rowsFailed}</td>
                      <td className="px-4 py-3 text-text">{new Date(job.createdAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        {job.rowsFailed > 0 ? (
                          <a
                            href={`/api/admin/users/import/jobs/${job.id}/errors.csv`}
                            download
                            className="link-accent text-sm"
                          >
                            Download CSV
                          </a>
                        ) : (
                          <span className="text-text/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
