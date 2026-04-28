"use client";

import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { H2, BodyText, MetaText } from "@/components/ui/typography";
import { toast } from "@/components/toast-provider";
import {
  ALL_TIMETABLE_FIELDS,
  TIMETABLE_REQUIRED_FIELDS,
  TimetableField,
  suggestTimetableMapping,
  computeHeaderSignature,
} from "@/modules/timetable/timetable-fields";
import type { TimetableMapping } from "@/modules/timetable/timetable-import";

interface ImportResult {
  importJobId: string;
  rowsProcessed: number;
  rowsFailed: number;
  conflictCount: number;
}

export function TimetableImportMapper() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [rawCsv, setRawCsv] = useState("");

  const [fieldMap, setFieldMap] = useState<Partial<Record<TimetableField, string>>>({});
  const [appliedMappingName, setAppliedMappingName] = useState<string | null>(null);

  const [saveMapping, setSaveMapping] = useState(false);
  const [mappingName, setMappingName] = useState("Timetable import mapping");

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const parseFile = useCallback(async (file: File) => {
    const text = await file.text();
    setRawCsv(text);
    setFileName(file.name);

    const lines = text.split(/\r?\n/);
    const headerLine = lines[0] ?? "";
    const parsedHeaders = headerLine
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    setHeaders(parsedHeaders);

    // Preview first 10 rows
    const dataLines = lines.slice(1, 11).filter(Boolean);
    const previewRows = dataLines.map((line) => {
      const cells = line.split(",");
      return Object.fromEntries(
        parsedHeaders.map((h, i) => [h, cells[i]?.trim() ?? ""]),
      );
    });
    setPreview(previewRows);

    // Auto-suggest mapping
    const suggested = suggestTimetableMapping(parsedHeaders);
    const newFieldMap: Partial<Record<TimetableField, string>> = {};
    for (const f of ALL_TIMETABLE_FIELDS) {
      if (suggested[f]) newFieldMap[f] = suggested[f];
    }
    setFieldMap(newFieldMap);

    // Try to load a saved mapping by headerSignature
    const sig = computeHeaderSignature(parsedHeaders);
    try {
      const res = await fetch(
        `/api/admin/timetable/import/mappings?headerSignature=${encodeURIComponent(sig)}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.mappings?.length > 0) {
          const saved = data.mappings[0];
          const savedMap = saved.mappingJson as Partial<Record<TimetableField, string>>;
          setFieldMap(savedMap);
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

    const mapping: TimetableMapping = fieldMap;

    const form = new FormData();
    form.append("file", fileRef.current.files[0]);
    form.append("mapping", JSON.stringify(mapping));
    form.append("saveMapping", String(saveMapping));
    form.append("mappingName", mappingName);

    try {
      const res = await fetch("/api/admin/timetable/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed");
        toast(data.error ?? "Import failed", "error");
      } else {
        setResult(data as ImportResult);
        toast("Timetable imported", "success");
      }
    } catch (err: unknown) {
      setImportError(String((err as Error)?.message ?? err));
      toast("Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  const requiredFields = TIMETABLE_REQUIRED_FIELDS as readonly TimetableField[];
  const unmappedRequired = requiredFields.filter((f) => !fieldMap[f]);

  return (
    <div className="space-y-4">
      {/* Card 1: Upload */}
      <Card>
        <H2 className="mb-2">Upload CSV</H2>
        <BodyText className="mb-3 text-muted">
          Select a timetable CSV file. Headers will be detected and mapped automatically.
        </BodyText>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          className="block text-sm text-text file:mr-3 file:rounded file:border file:border-border file:bg-surface file:px-3 file:py-1 file:text-sm"
        />
        {fileName && (
          <MetaText className="mt-1">
            File: {fileName} — {headers.length} columns detected
          </MetaText>
        )}
        {appliedMappingName && (
          <p className="mt-2 text-sm font-medium text-success">
            ✓ Applied saved mapping: {appliedMappingName}
          </p>
        )}
      </Card>

      {/* Card 2: Column Mapping */}
      {headers.length > 0 && (
        <Card>
          <H2 className="mb-3">Column Mapping</H2>
          <BodyText className="mb-4 text-muted">
            Map each Anaxi field to a column in your CSV. Required fields are marked{" "}
            <span className="text-error">*</span>.
          </BodyText>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ALL_TIMETABLE_FIELDS.map((field) => {
              const isRequired = (requiredFields as readonly string[]).includes(field);
              return (
                <div key={field} className="flex items-center gap-2">
                  <label className="w-36 shrink-0 text-sm font-medium text-text">
                    {field}
                    {isRequired && <span className="ml-1 text-error">*</span>}
                  </label>
                  <select
                    value={fieldMap[field] ?? ""}
                    onChange={(e) =>
                      setFieldMap((prev) => ({
                        ...prev,
                        [field]: e.target.value || undefined,
                      }))
                    }
                    className="flex-1 rounded border border-border bg-bg px-2 py-1 text-sm text-text"
                  >
                    <option value="">— select column —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  {isRequired && !fieldMap[field] && (
                    <span className="text-xs text-error">Required</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Card 3: Preview */}
      {headers.length > 0 && preview.length > 0 && (
        <Card>
          <H2 className="mb-2">Preview (first {preview.length} rows)</H2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {ALL_TIMETABLE_FIELDS.filter((f) => fieldMap[f]).map((f) => (
                    <th
                      key={f}
                      className="border border-border bg-bg px-2 py-1 text-left font-medium text-text"
                    >
                      {f}
                      <span className="ml-1 text-muted">({fieldMap[f]})</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {ALL_TIMETABLE_FIELDS.filter((f) => fieldMap[f]).map((f) => (
                      <td key={f} className="border border-border px-2 py-1 text-text">
                        {row[fieldMap[f]!] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Card 4: Save Mapping & Import */}
      {headers.length > 0 && (
        <Card>
          <H2 className="mb-3">Save Mapping &amp; Import</H2>

          <div className="mb-4 flex items-center gap-3">
            <input
              id="saveTimetableMapping"
              type="checkbox"
              checked={saveMapping}
              onChange={(e) => setSaveMapping(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="saveTimetableMapping" className="text-sm text-text">
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
              <p className="text-sm font-medium text-text">
                ✓ Imported {result.rowsProcessed} rows
                {result.rowsFailed > 0 && (
                  <span className="ml-2 text-error">
                    — {result.rowsFailed} rows had errors{" "}
                    <a
                      href={`/api/admin/timetable/import/jobs/${result.importJobId}/errors.csv`}
                      className="link-underline text-error"
                      download
                    >
                      Download error report
                    </a>
                  </span>
                )}
              </p>
              {result.conflictCount > 0 && (
                <p className="mt-1 text-sm text-warning">
                  {result.conflictCount} conflict(s) (e.g. unknown teacher emails){" "}
                  <a
                    href={`/api/admin/timetable/import/jobs/${result.importJobId}/conflicts.csv`}
                    className="link-underline text-warning"
                    download
                  >
                    Download conflict report
                  </a>
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleImport}
              disabled={importing || unmappedRequired.length > 0 || !rawCsv}
            >
              {importing ? "Importing…" : "Validate & Import"}
            </Button>
            <a
              href="/api/admin/timetable/import/template.csv"
              download
              className="calm-transition rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition duration-200 hover:bg-bg"
            >
              Download Template CSV
            </a>
          </div>
        </Card>
      )}

      {/* No file yet — show template download */}
      {headers.length === 0 && (
        <Card>
          <H2 className="mb-2">Get started</H2>
          <BodyText className="mb-3 text-muted">
            Download the template CSV to see the expected format, then upload your timetable file above.
          </BodyText>
          <a
            href="/api/admin/timetable/import/template.csv"
            download
            className="calm-transition inline-block rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition duration-200 hover:bg-bg"
          >
            Download Template CSV
          </a>
        </Card>
      )}
    </div>
  );
}
