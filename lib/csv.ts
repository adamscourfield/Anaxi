/** Escape a cell value for CSV (RFC 4180-style quoting). */
export function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsv).join(",");
}

export function buildCsvContent(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [buildCsvRow(headers), ...rows.map((r) => buildCsvRow(r))].join("\n");
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
