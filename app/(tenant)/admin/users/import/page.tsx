"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { AdminSectionLink } from "@/components/admin/admin-section-link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/toast-provider";

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

  async function loadJobs() {
    const res = await fetch("/api/admin/users/import/jobs");
    if (!res.ok) return;
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setJobsLoaded(true);
  }

  useEffect(() => {
    void loadJobs();
  }, []);

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
      toast("Failed to parse file", "error");
      return;
    }
    const data = await res.json();
    setPreview(data.preview ?? []);
    setParseErrors(data.errors ?? []);
    setRowCount(data.rowCount ?? 0);
    setValidated(true);
    const blocking = (data.errors ?? []).filter((err: ParseError) => err.errorCode !== "MISSING_FULL_NAME");
    if (blocking.length > 0) {
      toast(`${blocking.length} blocking error(s) in CSV`, "error");
    } else {
      toast("CSV validated — review preview below", "success");
    }
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
      const msg = data.error ?? "Import failed";
      setError(msg);
      toast(msg, "error");
      return;
    }

    const data = await res.json();
    setImportResult({ jobId: data.jobId, rowsProcessed: data.rowsProcessed, rowsFailed: data.rowsFailed });
    toast(
      `Imported ${data.rowsProcessed ?? 0} row${(data.rowsProcessed ?? 0) === 1 ? "" : "s"}${
        (data.rowsFailed ?? 0) > 0 ? ` (${data.rowsFailed} failed)` : ""
      }`,
      data.rowsFailed > 0 ? "default" : "success",
    );
    await loadJobs();
  }

  const blockingErrors = parseErrors.filter((e) => e.errorCode !== "MISSING_FULL_NAME");
  const canImport = validated && selectedFile !== null && blockingErrors.length === 0;
  const importLabel =
    rowCount > 0 ? `Import ${rowCount} staff` : importing ? "Importing…" : "Import staff";

  return (
    <div className="space-y-6">
      <PageHeader
        variant="ledger"
        eyebrow={
          <>
            <AdminSectionLink href="/admin?section=users" className="calm-transition hover:text-text">
              User management
            </AdminSectionLink>
            &ensp;›&ensp;Import
          </>
        }
        title="Import staff"
        subtitle="Upload a CSV to add or update staff accounts, roles, and department assignments."
      />

      <AdminSectionLink
        href="/admin?section=users"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted calm-transition hover:text-text"
      >
        ← Back to staff list
      </AdminSectionLink>

      <Card className="space-y-3 border-border/30 bg-surface-container-lowest/50">
        <h2 className="text-sm font-semibold text-text">How it works</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Download the template CSV and fill in staff details.</li>
          <li>Choose your file — we validate it automatically and show a preview.</li>
          <li>Import when the preview looks correct; download an error report if any rows fail.</li>
        </ol>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-text">Upload CSV</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Choose CSV file
          </Button>
          {selectedFile ? <span className="text-sm text-text/70">{selectedFile.name}</span> : null}
          <a
            href="/api/admin/users/import/template"
            download="staff-import-template.csv"
            className="calm-transition rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text hover:bg-bg"
          >
            Download template CSV
          </a>
        </div>
        {error ? <p className="text-sm text-error">{error}</p> : null}
      </Card>

      {parseErrors.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-text">Validation issues ({parseErrors.length})</h2>
          <ul className="space-y-1 text-sm">
            {parseErrors.slice(0, 20).map((e, i) => (
              <li key={i} className={e.errorCode === "MISSING_FULL_NAME" ? "text-warning" : "text-error"}>
                Row {e.rowNumber} — {e.field}: {e.message}
              </li>
            ))}
          </ul>
          {blockingErrors.length > 0 ? (
            <p className="text-sm font-medium text-error">
              {blockingErrors.length} blocking error(s) must be resolved before importing.
            </p>
          ) : null}
        </Card>
      ) : null}

      {preview.length > 0 ? (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-text">
            Preview (first {preview.length} of {rowCount} rows)
          </h2>
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
      ) : null}

      {validated ? (
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="primary" disabled={!canImport || importing} onClick={handleImport}>
            {importing ? "Importing…" : importLabel}
          </Button>
          {!canImport && blockingErrors.length > 0 ? (
            <span className="text-sm text-error">Fix validation errors before importing</span>
          ) : null}
        </div>
      ) : null}

      {importResult ? (
        <Card className="space-y-2">
          <h2 className="text-base font-semibold text-text">Import complete</h2>
          <p className="text-sm text-text">
            Rows processed: <strong>{importResult.rowsProcessed}</strong> &nbsp;|&nbsp; Rows failed:{" "}
            <strong>{importResult.rowsFailed}</strong>
          </p>
          {importResult.rowsFailed > 0 ? (
            <a
              href={`/api/admin/users/import/jobs/${importResult.jobId}/errors.csv`}
              download
              className="link-accent text-sm"
            >
              Download error report CSV
            </a>
          ) : null}
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">Import history</h2>
          <Button variant="ghost" onClick={loadJobs}>
            Refresh
          </Button>
        </div>
        {!jobsLoaded ? (
          <p className="text-sm text-text/60">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-text/60">No imports yet. Your recent jobs will appear here.</p>
        ) : (
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
                      <td className="px-4 py-3">
                        <StatusPill variant={job.status === "COMPLETED" ? "success" : "neutral"}>{job.status}</StatusPill>
                      </td>
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
