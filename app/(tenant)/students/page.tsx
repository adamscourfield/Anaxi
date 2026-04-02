import Link from "next/link";
import { getSessionUserOrThrow } from "@/lib/auth";
import { requireFeature } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { scoreToBand, RiskBand } from "@/modules/analysis/studentRisk";
import { StudentsFilterBar } from "./StudentsFilterBar";

const PER_PAGE = 15;

const BAND_LABELS: Record<RiskBand, string> = {
  STABLE: "STABLE",
  WATCH: "WATCH",
  PRIORITY: "PRIORITY",
  URGENT: "URGENT",
};

interface SnapshotRow {
  snapshotDate: Date | string;
  attendancePct: number | string;
  detentionsCount: number;
  onCallsCount: number;
  latenessCount: number;
  internalExclusionsCount: number;
  suspensionsCount: number;
}

interface StudentRow {
  id: string;
  fullName: string;
  yearGroup: string | null;
  sendFlag: boolean;
  ppFlag: boolean;
  snapshots: SnapshotRow[];
}

function simpleRiskScore(s: SnapshotRow): number {
  let score = 0;
  const att = Number(s.attendancePct);
  if (att < 90) score += 2;
  else if (att < 95) score += 1;
  if (s.detentionsCount >= 3) score += 2;
  else if (s.detentionsCount >= 1) score += 1;
  if (s.onCallsCount >= 2) score += 2;
  else if (s.onCallsCount >= 1) score += 1;
  if (s.suspensionsCount >= 1) score += 2;
  if (s.internalExclusionsCount >= 1) score += 1;
  if (s.latenessCount >= 5) score += 1;
  return score;
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function attendanceBarColor(pct: number | null): string {
  if (pct === null) return "bg-surface-container-high";
  if (pct >= 90) return "bg-scale-strong-bar";
  if (pct >= 80) return "bg-scale-some-bar";
  return "bg-scale-limited-bar";
}

function bandPillClass(band: RiskBand): string {
  switch (band) {
    case "URGENT":
    case "PRIORITY":
      return "bg-[var(--scale-limited-light)] text-[var(--scale-limited-text)]";
    case "WATCH":
      return "bg-[var(--scale-some-light)] text-[var(--scale-some-text)]";
    case "STABLE":
      return "bg-[var(--scale-strong-light)] text-[var(--scale-strong-text)]";
    default:
      return "bg-surface-container-high text-muted";
  }
}

function fmtLastUpdate(date: Date | string | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function StudentsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getSessionUserOrThrow();
  await requireFeature(user.tenantId, "STUDENTS");

  const q = searchParams.q || "";
  const yearGroup = searchParams.yearGroup || "";
  const send = searchParams.send || "";
  const pp = searchParams.pp || "";
  const band = searchParams.band || "";
  const pageRaw = Number(searchParams.page || "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const where: Record<string, unknown> = {
    tenantId: user.tenantId,
    status: "ACTIVE",
    ...(q ? { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { upn: { contains: q, mode: "insensitive" } }] } : {}),
    ...(yearGroup ? { yearGroup } : {}),
    ...(send ? { sendFlag: send === "true" } : {}),
    ...(pp ? { ppFlag: pp === "true" } : {}),
  };

  const [rawStudents, distinctYearGroups] = await Promise.all([
    (prisma as any).student.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        snapshots: { orderBy: { snapshotDate: "desc" }, take: 1 },
      },
    }),
    (prisma as any).student.findMany({
      where: { tenantId: user.tenantId, status: "ACTIVE" },
      distinct: ["yearGroup"],
      select: { yearGroup: true },
      orderBy: { yearGroup: "asc" },
    }),
  ]);

  const allFetched = rawStudents as StudentRow[];

  const yearGroups: string[] = (distinctYearGroups as { yearGroup: string | null }[])
    .map((r) => r.yearGroup)
    .filter((v): v is string => Boolean(v));

  const studentsWithBand = allFetched.map((s) => {
    const latest = s.snapshots[0];
    const computedBand = latest ? scoreToBand(simpleRiskScore(latest)) : null;
    return { ...s, computedBand };
  });

  const bandFiltered = band ? studentsWithBand.filter((s) => s.computedBand === band) : studentsWithBand;

  const totalFiltered = bandFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageStartIdx = (safePage - 1) * PER_PAGE;
  const pageSlice = bandFiltered.slice(pageStartIdx, pageStartIdx + PER_PAGE);
  const pageStart = totalFiltered === 0 ? 0 : pageStartIdx + 1;
  const pageEnd = pageStartIdx + pageSlice.length;

  const hasFilters = !!(q || yearGroup || send || pp || band);
  const hasBehaviourData = bandFiltered.some((s) => s.snapshots.length > 0);

  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (yearGroup) params.set("yearGroup", yearGroup);
    if (send) params.set("send", send);
    if (pp) params.set("pp", pp);
    if (band) params.set("band", band);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/students${qs ? `?${qs}` : ""}`;
  }

  function paginationRange(): (number | "ellipsis")[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>([1, totalPages, safePage, safePage - 1, safePage + 1]);
    const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const out: (number | "ellipsis")[] = [];
    let prev = 0;
    for (const n of sorted) {
      if (prev && n - prev > 1) out.push("ellipsis");
      out.push(n);
      prev = n;
    }
    return out;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em] text-text">
            Student Management
          </h1>
          <p className="mt-1 text-[0.875rem] text-muted">
            {totalFiltered.toLocaleString()} student{totalFiltered === 1 ? "" : "s"}
            {hasFilters ? " (filtered)" : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link href="/students/import">
            <Button variant="secondary">Import snapshots</Button>
          </Link>
          <Link href="/students/import-subject-teachers">
            <Button variant="secondary">Import subject teachers</Button>
          </Link>
        </div>
      </div>

      <StudentsFilterBar
        yearGroups={yearGroups}
        currentQ={q}
        currentYearGroup={yearGroup}
        currentSend={send}
        currentPp={pp}
        currentBand={band}
        pageStart={pageStart}
        pageEnd={pageEnd}
        totalFiltered={totalFiltered}
      />

      {bandFiltered.length === 0 ? (
        <EmptyState
          title="No students found"
          description={
            hasFilters
              ? "Try broadening your filters or clearing them."
              : "No active students in the system yet. Import a snapshot to get started."
          }
          action={
            hasFilters ? (
              <Link href="/students">
                <Button variant="secondary">Clear filters</Button>
              </Link>
            ) : (
              <Link href="/students/import">
                <Button variant="secondary">Import snapshots</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="table-shell overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="table-head-row">
                <th className="px-5 py-4 text-left font-semibold tracking-[0.08em]">Name</th>
                <th className="px-4 py-4 text-left font-semibold tracking-[0.08em]">Year</th>
                <th className="px-4 py-4 text-left font-semibold tracking-[0.08em]">Flags</th>
                {hasBehaviourData && (
                  <th className="px-4 py-4 text-left font-semibold tracking-[0.08em]">Band</th>
                )}
                <th className="px-4 py-4 text-left font-semibold tracking-[0.08em]">Attendance</th>
                <th className="px-4 py-4 text-left font-semibold tracking-[0.08em]">Last update</th>
                <th className="px-5 py-4 text-left font-semibold tracking-[0.08em]">Action</th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.map((s) => {
                const latest = s.snapshots[0];
                const attPct = latest ? Number(latest.attendancePct) : null;
                const attDisplay = latest ? Math.round(attPct!) : null;
                return (
                  <tr key={s.id} className="table-row calm-transition">
                    <td className="px-5 py-5 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-container-high text-[11px] font-semibold text-text">
                          {getInitials(s.fullName)}
                        </div>
                        <span className="font-semibold text-text">{s.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5 align-middle text-text">{s.yearGroup || "—"}</td>
                    <td className="px-4 py-5 align-middle">
                      <div className="flex flex-wrap gap-1.5">
                        {s.sendFlag && (
                          <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                            SEN
                          </span>
                        )}
                        {s.ppFlag && (
                          <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                            PP
                          </span>
                        )}
                        {!s.sendFlag && !s.ppFlag && <span className="text-muted">—</span>}
                      </div>
                    </td>
                    {hasBehaviourData && (
                      <td className="px-4 py-5 align-middle">
                        {s.computedBand ? (
                          <span
                            className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${bandPillClass(s.computedBand)}`}
                          >
                            {BAND_LABELS[s.computedBand]}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-5 align-middle">
                      {latest && attPct !== null && !Number.isNaN(attPct) ? (
                        <div className="flex min-w-[120px] flex-col gap-1">
                          <span className="text-[0.8125rem] tabular-nums text-muted">{attDisplay}%</span>
                          <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-surface-container-high">
                            <div
                              className={`h-full rounded-full ${attendanceBarColor(attPct)}`}
                              style={{ width: `${Math.min(100, Math.max(0, attPct))}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-5 align-middle text-muted">{fmtLastUpdate(latest?.snapshotDate)}</td>
                    <td className="px-5 py-5 align-middle">
                      <Link
                        href={`/students/${s.id}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-text calm-transition hover:text-accent"
                      >
                        View <span aria-hidden>→</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 border-t border-border/20 px-5 py-4">
              {safePage > 1 ? (
                <Link
                  href={pageUrl(safePage - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-bg hover:text-text"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-muted/30">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}

              {paginationRange().map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e-${idx}`} className="flex h-8 w-8 items-center justify-center text-sm text-muted">
                    …
                  </span>
                ) : (
                  <Link
                    key={item}
                    href={pageUrl(item)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium calm-transition ${
                      item === safePage
                        ? "bg-primary text-on-primary"
                        : "text-muted hover:bg-bg hover:text-text"
                    }`}
                  >
                    {item}
                  </Link>
                ),
              )}

              {safePage < totalPages ? (
                <Link
                  href={pageUrl(safePage + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted calm-transition hover:bg-bg hover:text-text"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-muted/30">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
