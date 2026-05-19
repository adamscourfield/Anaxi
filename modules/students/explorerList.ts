import type { RiskBand, StudentRiskRow } from "@/modules/analysis/studentRisk";

export const BAND_ORDER: RiskBand[] = ["URGENT", "PRIORITY", "WATCH", "STABLE"];

export const BAND_LABELS: Record<RiskBand, string> = {
  URGENT: "Urgent",
  PRIORITY: "Priority",
  WATCH: "Watch",
  STABLE: "Stable",
};

export type StudentsViewMode = "attention" | "all" | "watch" | "stable";

export const DEFAULT_VIEW_MODE: StudentsViewMode = "attention";

export const PER_PAGE_ALL = 25;
export const PER_PAGE_ATTENTION_MAX = 50;

export type StudentsListFilters = {
  view: StudentsViewMode;
  band: string;
  yearGroup: string;
  studentSearch: string;
  send: string;
  pp: string;
  watchlistOnly: boolean;
  attendanceBelow80: boolean;
};

export function parseViewMode(
  viewParam: string | undefined,
  bandParam: string,
): StudentsViewMode {
  if (bandParam && BAND_ORDER.includes(bandParam as RiskBand)) {
    if (bandParam === "WATCH") return "watch";
    if (bandParam === "STABLE") return "stable";
    return "attention";
  }
  if (viewParam === "all" || viewParam === "watch" || viewParam === "stable") {
    return viewParam;
  }
  return DEFAULT_VIEW_MODE;
}

export function effectiveBandFilter(
  view: StudentsViewMode,
  bandParam: string,
): RiskBand | "NEEDS_ATTENTION" | "" {
  if (bandParam && BAND_ORDER.includes(bandParam as RiskBand)) {
    return bandParam as RiskBand;
  }
  switch (view) {
    case "attention":
      return "NEEDS_ATTENTION";
    case "watch":
      return "WATCH";
    case "stable":
      return "STABLE";
    default:
      return "";
  }
}

export function filterStudentRows(
  rows: StudentRiskRow[],
  filters: StudentsListFilters,
): StudentRiskRow[] {
  let result = rows;

  const bandFilter = effectiveBandFilter(filters.view, filters.band);
  if (bandFilter === "NEEDS_ATTENTION") {
    result = result.filter((r) => r.band === "URGENT" || r.band === "PRIORITY");
  } else if (bandFilter) {
    result = result.filter((r) => r.band === bandFilter);
  }

  if (filters.yearGroup) {
    result = result.filter((r) => r.yearGroup === filters.yearGroup);
  }
  if (filters.studentSearch) {
    const q = filters.studentSearch.toLowerCase();
    result = result.filter((r) => (r.studentName ?? "").toLowerCase().includes(q));
  }
  if (filters.send === "true") result = result.filter((r) => r.sendFlag);
  if (filters.send === "false") result = result.filter((r) => !r.sendFlag);
  if (filters.pp === "true") result = result.filter((r) => r.ppFlag);
  if (filters.pp === "false") result = result.filter((r) => !r.ppFlag);
  if (filters.watchlistOnly) result = result.filter((r) => r.onWatchlist);
  if (filters.attendanceBelow80) {
    result = result.filter(
      (r) => r.attendancePct !== null && r.attendancePct < 80,
    );
  }

  result.sort((a, b) => {
    const bandDiff = BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band);
    if (bandDiff !== 0) return bandDiff;
    return b.riskScore - a.riskScore;
  });

  return result;
}

export function countBands(rows: StudentRiskRow[]): Record<RiskBand, number> {
  const counts: Record<RiskBand, number> = {
    URGENT: 0,
    PRIORITY: 0,
    WATCH: 0,
    STABLE: 0,
  };
  for (const r of rows) counts[r.band]++;
  return counts;
}

export function getPageSize(
  view: StudentsViewMode,
  bandParam: string,
  totalFiltered: number,
): number {
  const bandFilter = effectiveBandFilter(view, bandParam);
  if (bandFilter === "NEEDS_ATTENTION" || bandFilter === "URGENT" || bandFilter === "PRIORITY") {
    return Math.min(PER_PAGE_ATTENTION_MAX, Math.max(totalFiltered, 1));
  }
  return PER_PAGE_ALL;
}

export type StudentsUrlParams = {
  windowDays: number;
  view?: StudentsViewMode;
  band?: string;
  yearGroup?: string;
  studentSearch?: string;
  send?: string;
  pp?: string;
  watchlist?: string;
  attendanceBelow?: string;
  page?: number;
  scope?: string;
};

export function buildStudentsListUrl(
  basePath: string,
  params: StudentsUrlParams,
): string {
  const merged = new URLSearchParams();
  merged.set("windowDays", String(params.windowDays));

  if (params.view && params.view !== DEFAULT_VIEW_MODE) {
    merged.set("view", params.view);
  }
  if (params.band) merged.set("band", params.band);
  if (params.yearGroup) merged.set("yearGroup", params.yearGroup);
  if (params.studentSearch) merged.set("studentSearch", params.studentSearch);
  if (params.send) merged.set("send", params.send);
  if (params.pp) merged.set("pp", params.pp);
  if (params.watchlist === "1") merged.set("watchlist", "1");
  if (params.attendanceBelow === "1") merged.set("attendanceBelow", "1");
  if (params.scope === "my") merged.set("scope", "my");
  if (params.page && params.page > 1) merged.set("page", String(params.page));

  const qs = merged.toString();
  return `${basePath}${qs ? `?${qs}` : ""}`;
}

export function studentDetailHref(
  studentId: string,
  windowDays: number,
  listPath: string,
): string {
  const from = encodeURIComponent(listPath);
  return `/analysis/students/${studentId}?window=${windowDays}&from=${from}`;
}

export function formatDelta(value: number | null): string {
  if (value === null) return "—";
  if (value > 0) return `+${value}`;
  return String(value);
}
