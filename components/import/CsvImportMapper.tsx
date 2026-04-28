"use client";

import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { H2, BodyText, MetaText } from "@/components/ui/typography";
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

export function CsvImportMapper() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [rawCsv, setRawCsv] = useState("");

  // field → CSV header
  const [fieldMap, setFieldMap] = useState<Partial<Record<AnaxiField, string>>>({});

  // CountScope mode: "column" | "fixed"
  const [countScopeMode, setCountScopeMode] = useState<"column" | "fixed">("fixed");
  const [countScopeColumn, setCountScopeColumn] = useState<string>("");
  const [fixedCountScope, setFixedCountScope] = useState<CountScope>("TERM_TO_DATE");

  // SnapshotDate mode: "column" | "today"
  const [snapshotDateMode, setSnapshotDateMode] = useState<"today" | "column">("today");
  const [snapshotDateColumn, setSnapshotDateColumn] = useState<string>("");

  // Save mapping
  const [saveMapping, setSaveMapping] = useState(false);
  const [mappingName, setMappingName] = useState("Snapshot import mapping");
  const [appliedMappingName, setAppliedMappingName] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const parseFile = useCallback(async (file: File) => {
    const text = await file.text();
    setRawCsv(text);
    setFileName(file.name);

    const lines = text.split(/\r?\n/);
    const headerLine = lines[0] ?? "";
    const parsedHeaders = headerLine.split(",").map((h) => h.trim()).filter(Boolean);
    setHeaders(parsedHeaders);

    // Parse preview rows (up to 10)
    const dataLines = lines.slice(1, 11).filter(Boolean);
    const previewRows = dataLines.map((line) => {
      const cells = line.split(",");
      return Object.fromEntries(parsedHeaders.map((h, i) => [h, cells[i]?.trim() ?? ""]));
    });
    setPreview(previewRows);

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
          setAppliedMappingName(saved.name);
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
    <div className="space-y-4">
      {/* Card 1: Upload */}
      <Card>
        <H2 className="mb-2">Upload CSV</H2>
        <BodyText className="mb-3 text-muted">
          Select a CSV file containing student snapshot data. Headers will be detected automatically.
        </BodyText>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          className="block text-sm text-text file:mr-3 file:rounded file:border file:border-border file:bg-surface file:px-3 file:py-1 file:text-sm"
        />
        {fileName && <MetaText className="mt-1">File: {fileName} — {headers.length} columns detected</MetaText>}
        {appliedMappingName && (
          <p className="mt-2 text-sm text-success font-medium">✓ Applied saved mapping: {appliedMappingName}</p>
        )}
      </Card>

      {/* Card 2: Mapping */}
      {headers.length > 0 && (
        <Card>
          <H2 className="mb-3">Column Mapping</H2>
          <BodyText className="mb-4 text-muted">
            Map each required Anaxi field to a column in your CSV.
          </BodyText>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ANAXI_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-2">
                <label className="w-44 shrink-0 text-sm font-medium text-text">
                  {field}
                  <span className="ml-1 text-error">*</span>
                </label>
                <select
                  value={fieldMap[field] ?? ""}
                  onChange={(e) =>
                    setFieldMap((prev) => ({ ...prev, [field]: e.target.value || undefined }))
                  }
                  className="flex-1 rounded border border-border bg-bg px-2 py-1 text-sm text-text"
                >
                  <option value="">— select column —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {!fieldMap[field] && (
                  <span className="text-xs text-error">Required</span>
                )}
              </div>
            ))}

            {/* CountScope */}
            <div className="flex items-center gap-2 sm:col-span-2">
              <label className="w-44 shrink-0 text-sm font-medium text-text">
                CountScope <span className="text-error">*</span>
              </label>
              <select
                value={countScopeMode}
                onChange={(e) => setCountScopeMode(e.target.value as "column" | "fixed")}
                className="rounded border border-border bg-bg px-2 py-1 text-sm text-text"
              >
                <option value="fixed">Fixed value for whole file</option>
                <option value="column">Map to column</option>
              </select>
              {countScopeMode === "column" ? (
                <select
                  value={countScopeColumn}
                  onChange={(e) => setCountScopeColumn(e.target.value)}
                  className="flex-1 rounded border border-border bg-bg px-2 py-1 text-sm text-text"
                >
                  <option value="">— select column —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={fixedCountScope}
                  onChange={(e) => setFixedCountScope(e.target.value as CountScope)}
                  className="flex-1 rounded border border-border bg-bg px-2 py-1 text-sm text-text"
                >
                  {COUNT_SCOPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* SnapshotDate */}
            <div className="flex items-center gap-2 sm:col-span-2">
              <label className="w-44 shrink-0 text-sm font-medium text-text">SnapshotDate</label>
              <select
                value={snapshotDateMode}
                onChange={(e) => setSnapshotDateMode(e.target.value as "today" | "column")}
                className="rounded border border-border bg-bg px-2 py-1 text-sm text-text"
              >
                <option value="today">Use import date (today)</option>
                <option value="column">Map to column</option>
              </select>
              {snapshotDateMode === "column" && (
                <select
                  value={snapshotDateColumn}
                  onChange={(e) => setSnapshotDateColumn(e.target.value)}
                  className="flex-1 rounded border border-border bg-bg px-2 py-1 text-sm text-text"
                >
                  <option value="">— select column —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Preview table */}
      {headers.length > 0 && preview.length > 0 && (
        <Card>
          <H2 className="mb-2">Preview (first {preview.length} rows)</H2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {ANAXI_FIELDS.map((f) => (
                    <th key={f} className="border border-border bg-bg px-2 py-1 text-left font-medium text-text">
                      {f}
                      {fieldMap[f] && <span className="text-muted ml-1">({fieldMap[f]})</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {ANAXI_FIELDS.map((f) => (
                      <td key={f} className="border border-border px-2 py-1 text-text">
                        {fieldMap[f] ? row[fieldMap[f]!] ?? "" : <span className="text-muted italic">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Card 3: Save mapping + import */}
      {headers.length > 0 && (
        <Card>
          <H2 className="mb-3">Save Mapping & Import</H2>

          <div className="mb-4 flex items-center gap-3">
            <input
              id="saveMapping"
              type="checkbox"
              checked={saveMapping}
              onChange={(e) => setSaveMapping(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="saveMapping" className="text-sm text-text">
              Save this mapping for next time
            </label>
          </div>

          {saveMapping && (
            <div className="mb-4">
              <label className="mb-1 block text-sm text-text">Mapping name</label>
              <input
                type="text"
                value={mappingName}
                onChange={(e) => setMappingName(e.target.value)}
                className="w-full rounded border border-border bg-bg px-3 py-1.5 text-sm text-text"
              />
            </div>
          )}

          {unmappedRequired.length > 0 && (
            <p className="mb-3 text-sm text-error">
              Missing required mappings: {unmappedRequired.join(", ")}
            </p>
          )}

          {importError && (
            <p className="mb-3 text-sm text-error">Error: {importError}</p>
          )}

          {result && (
            <div className="mb-3 rounded border border-border bg-bg p-3">
              <p className="text-sm text-text font-medium">
                ✓ Imported {result.rowsProcessed} rows
                {result.rowsFailed > 0 && (
                  <span className="ml-2 text-error">
                    — {result.rowsFailed} rows had issues
                    {" "}
                    <a
                      href={`/api/import/jobs/${result.importJobId}/errors.csv`}
                      className="link-underline text-error"
                      download
                    >
                      Download error report
                    </a>
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={importing || unmappedRequired.length > 0 || !rawCsv}
            >
              {importing ? "Importing…" : "Validate & Import"}
            </Button>
            <a
              href="/api/import/csv/template"
              download
              className="calm-transition rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text hover:bg-bg transition duration-200"
            >
              Download Template CSV
            </a>
          </div>
        </Card>
      )}
    </div>
  );
}
