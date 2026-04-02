"use client";

import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetaText } from "@/components/ui/typography";
import {
  ANAXI_FIELDS,
  AnaxiField,
  suggestMapping,
  computeHeaderSignature,
} from "@/modules/students/snapshot-fields";
import type { SnapshotMapping, CountScope } from "@/modules/students/snapshot-import";

const COUNT_SCOPE_OPTIONS: { value: CountScope; label: string }[] = [
  { value: "ROLLING_21_DAYS", label: "Rolling 21 days" },
  { value: "ROLLING_28_DAYS", label: "Rolling 28 days" },
  { value: "TERM_TO_DATE", label: "Term to date" },
  { value: "YEAR_TO_DATE", label: "Year to date" },
];

interface ImportResult {
  importJobId: string;
  rowsProcessed: number;
  rowsFailed: number;
}

export function SnapshotUploader() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [rawCsv, setRawCsv] = useState("");
  const [dragging, setDragging] = useState(false);

  // field → CSV header
  const [fieldMap, setFieldMap] = useState<Partial<Record<AnaxiField, string>>>({});

  // CountScope mode
  const [countScopeMode, setCountScopeMode] = useState<"column" | "fixed">("fixed");
  const [countScopeColumn, setCountScopeColumn] = useState<string>("");
  const [fixedCountScope, setFixedCountScope] = useState<CountScope>("TERM_TO_DATE");

  // SnapshotDate mode
  const [snapshotDateMode, setSnapshotDateMode] = useState<"today" | "column">("today");
  const [snapshotDateColumn, setSnapshotDateColumn] = useState<string>("");

  // Mapping
  const [saveMapping, setSaveMapping] = useState(false);
  const [mappingName, setMappingName] = useState("Snapshot import mapping");

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const MAX_FILE_SIZE = 24 * 1024 * 1024; // 24MB

  const parseFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setImportError("File exceeds 24MB limit. Please select a smaller file.");
      return;
    }
    setImportError(null);
    const text = await file.text();
    setRawCsv(text);
    setFileName(file.name);

    const lines = text.split(/\r?\n/);
    const headerLine = lines[0] ?? "";
    const parsedHeaders = headerLine.split(",").map((h) => h.trim()).filter(Boolean);
    setHeaders(parsedHeaders);

    // Auto-suggest mapping
    const suggested = suggestMapping(parsedHeaders);
    const newFieldMap: Partial<Record<AnaxiField, string>> = {};
    for (const f of ANAXI_FIELDS) {
      if (suggested[f]) newFieldMap[f] = suggested[f];
    }
    setFieldMap(newFieldMap);

    if (suggested["CountScope"]) {
      setCountScopeMode("column");
      setCountScopeColumn(suggested["CountScope"]);
    }
    if (suggested["SnapshotDate"]) {
      setSnapshotDateMode("column");
      setSnapshotDateColumn(suggested["SnapshotDate"]);
    }

    // Try to find a saved mapping by headerSignature
    const sig = computeHeaderSignature(parsedHeaders);
    try {
      const res = await fetch(`/api/import/mappings?type=STUDENT_SNAPSHOT&headerSignature=${encodeURIComponent(sig)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.mappings?.length > 0) {
          const saved = data.mappings[0];
          const savedMapping = saved.mappingJson as SnapshotMapping;
          if (savedMapping.fieldMap) setFieldMap(savedMapping.fieldMap as Partial<Record<AnaxiField, string>>);
          if (savedMapping.countScopeColumn) {
            setCountScopeMode("column");
            setCountScopeColumn(savedMapping.countScopeColumn);
          } else if (savedMapping.fixedCountScope) {
            setCountScopeMode("fixed");
            setFixedCountScope(savedMapping.fixedCountScope);
          }
          if (savedMapping.snapshotDateColumn) {
            setSnapshotDateMode("column");
            setSnapshotDateColumn(savedMapping.snapshotDateColumn);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.name.endsWith(".csv")) {
        parseFile(file);
        // Set the file on the input for form submission
        const dt = new DataTransfer();
        dt.items.add(file);
        if (fileRef.current) fileRef.current.files = dt.files;
      }
    },
    [parseFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleImport = async () => {
    if (!rawCsv || !fileRef.current?.files?.[0]) return;
    setImporting(true);
    setImportError(null);
    setResult(null);

    const mapping: SnapshotMapping = {
      fieldMap,
      countScopeColumn: countScopeMode === "column" ? countScopeColumn || null : null,
      fixedCountScope: countScopeMode === "fixed" ? fixedCountScope : null,
      snapshotDateColumn: snapshotDateMode === "column" ? snapshotDateColumn || null : null,
    };

    const form = new FormData();
    form.append("file", fileRef.current.files[0]);
    form.append("mapping", JSON.stringify(mapping));
    form.append("saveMapping", String(saveMapping));
    form.append("mappingName", mappingName);

    try {
      const res = await fetch("/api/import/snapshot", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed");
      } else {
        setResult(data as ImportResult);
      }
    } catch (err: any) {
      setImportError(String(err?.message ?? err));
    } finally {
      setImporting(false);
    }
  };

  const unmappedRequired = ANAXI_FIELDS.filter((f) => !fieldMap[f]);

  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Upload area */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 18v-6" />
                <path d="m9 15 3-3 3 3" />
              </svg>
            </div>
            <span className="text-base font-semibold text-text">Upload CSV File</span>
          </div>

          {/* Drag-and-drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging
                ? "border-[var(--primary)] bg-[var(--surface-container-low)]"
                : fileName
                ? "border-[var(--success)] bg-[var(--pill-success-bg)]"
                : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
            }`}
          >
            {fileName ? (
              <>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--pill-success-bg)] text-[var(--success)]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-text">{fileName}</p>
                <p className="mt-1 text-xs text-muted">{headers.length} columns detected</p>
                <button
                  type="button"
                  onClick={() => {
                    setFileName("");
                    setHeaders([]);
                    setRawCsv("");
                    setFieldMap({});
                    setResult(null);
                    setImportError(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="mt-2 text-xs font-medium text-error hover:underline"
                >
                  Remove file
                </button>
              </>
            ) : (
              <>
                <div className="mb-3 text-[var(--on-surface-variant)]">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-text">Drag and drop CSV here</p>
                <p className="mt-1 text-xs text-muted">Max file size: 24MB</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-4 rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-5 py-2 text-sm font-medium text-text transition-colors hover:bg-[var(--surface-container-low)]"
                >
                  Browse Files
                </button>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={onFileChange}
            className="hidden"
          />

          {/* Column mapping (compact) - shown once file is loaded */}
          {headers.length > 0 && (
            <details className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
              <summary className="cursor-pointer text-sm font-medium text-text">
                Column Mapping
                {unmappedRequired.length > 0 && (
                  <span className="ml-2 text-xs text-error">({unmappedRequired.length} unmapped)</span>
                )}
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ANAXI_FIELDS.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <label className="w-36 shrink-0 text-xs font-medium text-text">
                      {field}
                      <span className="ml-0.5 text-error">*</span>
                    </label>
                    <select
                      value={fieldMap[field] ?? ""}
                      onChange={(e) =>
                        setFieldMap((prev) => ({ ...prev, [field]: e.target.value || undefined }))
                      }
                      className="flex-1 rounded border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] px-2 py-1 text-xs text-text"
                    >
                      <option value="">— select —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {/* CountScope */}
                <div className="flex items-center gap-2 sm:col-span-2">
                  <label className="w-36 shrink-0 text-xs font-medium text-text">CountScope</label>
                  <select
                    value={countScopeMode}
                    onChange={(e) => setCountScopeMode(e.target.value as "column" | "fixed")}
                    className="rounded border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] px-2 py-1 text-xs text-text"
                  >
                    <option value="fixed">Fixed value</option>
                    <option value="column">Column</option>
                  </select>
                  {countScopeMode === "column" ? (
                    <select
                      value={countScopeColumn}
                      onChange={(e) => setCountScopeColumn(e.target.value)}
                      className="flex-1 rounded border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] px-2 py-1 text-xs text-text"
                    >
                      <option value="">— select —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={fixedCountScope}
                      onChange={(e) => setFixedCountScope(e.target.value as CountScope)}
                      className="flex-1 rounded border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] px-2 py-1 text-xs text-text"
                    >
                      {COUNT_SCOPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* SnapshotDate */}
                <div className="flex items-center gap-2 sm:col-span-2">
                  <label className="w-36 shrink-0 text-xs font-medium text-text">SnapshotDate</label>
                  <select
                    value={snapshotDateMode}
                    onChange={(e) => setSnapshotDateMode(e.target.value as "today" | "column")}
                    className="rounded border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] px-2 py-1 text-xs text-text"
                  >
                    <option value="today">Use today</option>
                    <option value="column">Column</option>
                  </select>
                  {snapshotDateMode === "column" && (
                    <select
                      value={snapshotDateColumn}
                      onChange={(e) => setSnapshotDateColumn(e.target.value)}
                      className="flex-1 rounded border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] px-2 py-1 text-xs text-text"
                    >
                      <option value="">— select —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Save mapping */}
                <div className="flex items-center gap-2 sm:col-span-2 pt-2 border-t border-[var(--surface-container-low)]">
                  <input
                    id="saveMapping"
                    type="checkbox"
                    checked={saveMapping}
                    onChange={(e) => setSaveMapping(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[var(--outline-variant)]"
                  />
                  <label htmlFor="saveMapping" className="text-xs text-text">
                    Save mapping for next time
                  </label>
                  {saveMapping && (
                    <input
                      type="text"
                      value={mappingName}
                      onChange={(e) => setMappingName(e.target.value)}
                      placeholder="Mapping name"
                      className="ml-auto w-48 rounded border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] px-2 py-1 text-xs text-text"
                    />
                  )}
                </div>
              </div>
            </details>
          )}
        </div>

        {/* Right: Pro Tip + Process Import */}
        <div className="flex flex-col gap-4">
          {/* Pro Tip */}
          <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--pill-info-bg)] text-[var(--pill-info-text)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-text">Pro Tip</span>
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Using the{" "}
              <a
                href="/api/import/csv/template"
                download
                className="font-medium text-text underline decoration-[var(--outline-variant)] underline-offset-2 hover:decoration-text"
              >
                official template
              </a>{" "}
              reduces mapping errors. You can also{" "}
              <a
                href="/api/import/csv/template?prefill=1"
                download
                className="font-medium text-text underline decoration-[var(--outline-variant)] underline-offset-2 hover:decoration-text"
              >
                download a pre-populated template
              </a>{" "}
              with active student names and UPNs.
            </p>
          </div>

          {/* Error / Success feedback */}
          {importError && (
            <div className="rounded-xl border border-[var(--pill-error-ring)] bg-[var(--pill-error-bg)] p-3">
              <p className="text-sm text-[var(--pill-error-text)]">Error: {importError}</p>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-[var(--pill-success-ring)] bg-[var(--pill-success-bg)] p-3">
              <p className="text-sm font-medium text-[var(--pill-success-text)]">
                ✓ Imported {result.rowsProcessed} rows
              </p>
              {result.rowsFailed > 0 && (
                <p className="mt-1 text-xs text-error">
                  {result.rowsFailed} rows had issues —{" "}
                  <a
                    href={`/api/import/jobs/${result.importJobId}/errors.csv`}
                    download
                    className="underline"
                  >
                    Download error report
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Process Import Button */}
          <div className="mt-auto">
            <Button
              onClick={handleImport}
              disabled={importing || unmappedRequired.length > 0 || !rawCsv}
              className="w-full gap-2 py-3.5 text-base"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              {importing ? "Processing…" : "Process Import"}
            </Button>
            {unmappedRequired.length > 0 && headers.length > 0 && (
              <MetaText className="mt-2 text-center text-error">
                {unmappedRequired.length} unmapped required field{unmappedRequired.length > 1 ? "s" : ""}
              </MetaText>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
