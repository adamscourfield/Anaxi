"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  gcseGradeBadgeClass,
  ppTableBadgeClass,
  sendTableBadgeClass,
} from "@/modules/assessments/attainmentColours";

export type EMStudentRow = {
  id: string;
  name: string;
  year: number | null;
  sendFlag: boolean;
  ppFlag: boolean;
  eRaw: string | null;
  mRaw: string | null;
  met: boolean;
  eMeets: boolean;
  mMeets: boolean;
  cAvg: number | null;
  avgDiff: number | null;
};

type SectionKey = "english" | "maths" | "both" | "neither";

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={`h-4 w-4 calm-transition text-muted ${open ? "rotate-180" : ""}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function partitionStudents(rows: EMStudentRow[]): Record<SectionKey, EMStudentRow[]> {
  const englishOnly: EMStudentRow[] = [];
  const mathsOnly: EMStudentRow[] = [];
  const gapBoth: EMStudentRow[] = [];
  const metBoth: EMStudentRow[] = [];

  for (const row of rows) {
    const { eMeets, mMeets } = row;
    if (!eMeets && !mMeets) gapBoth.push(row);
    else if (!eMeets && mMeets) englishOnly.push(row);
    else if (eMeets && !mMeets) mathsOnly.push(row);
    else metBoth.push(row);
  }

  return { english: englishOnly, maths: mathsOnly, both: gapBoth, neither: metBoth };
}

function TrendCell({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-muted">—</span>;
  if (diff > 0.1)
    return (
      <span className="font-bold text-scale-strong-text">
        ↗ +{diff}
      </span>
    );
  if (diff < -0.1)
    return (
      <span className="font-bold text-scale-limited-text">
        ↘ {diff}
      </span>
    );
  return (
    <span className="font-bold text-muted">
      → {diff}
    </span>
  );
}

function MetBothIcon({ met }: { met: boolean }) {
  return (
    <div className="inline-flex items-center justify-center">
      {met ? (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-status-approved-light text-status-approved-text">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-low text-muted">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
    </div>
  );
}

function StudentRows({ rows }: { rows: EMStudentRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <tr key={row.id} className="group table-row calm-transition">
          <td className="px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                {getInitials(row.name)}
              </div>
              <div className="flex min-w-0 flex-col">
                <Link href={`/students/${row.id}`} className="link-to-accent font-medium">
                  {row.name}
                </Link>
                <span className="text-[11px] text-muted">
                  Year {row.year ?? "—"}
                </span>
              </div>
            </div>
          </td>
          <td className="px-4 py-4">
            <div className="flex flex-wrap gap-1.5">
              {row.sendFlag && <span className={sendTableBadgeClass}>SEN</span>}
              {row.ppFlag && <span className={ppTableBadgeClass}>PP</span>}
              {!row.sendFlag && !row.ppFlag && (
                <span className="text-xs text-muted">—</span>
              )}
            </div>
          </td>
          <td className="px-4 py-4 text-center">
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${gcseGradeBadgeClass(row.eRaw)}`}
            >
              {row.eRaw}
            </span>
          </td>
          <td className="px-4 py-4 text-center">
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${gcseGradeBadgeClass(row.mRaw)}`}
            >
              {row.mRaw}
            </span>
          </td>
          <td className="px-4 py-4 text-center align-middle">
            <MetBothIcon met={row.met} />
          </td>
          <td className="px-4 py-4 text-center">
            <span className="font-semibold tabular-nums text-text">{row.cAvg ?? "—"}</span>
          </td>
          <td className="px-4 py-4 text-center">
            <TrendCell diff={row.avgDiff} />
          </td>
        </tr>
      ))}
    </>
  );
}

const SECTION_ORDER: {
  key: SectionKey;
  title: (n: number) => string;
  summaryBadges: boolean;
}[] = [
  {
    key: "english",
    title: (n) => `English (${n} students)`,
    summaryBadges: true,
  },
  {
    key: "maths",
    title: (n) => `Maths (${n} students)`,
    summaryBadges: true,
  },
  {
    key: "both",
    title: (n) => `Neither English nor Maths (${n} students)`,
    summaryBadges: true,
  },
  {
    key: "neither",
    title: (n) => `Met both E&M (${n} students)`,
    summaryBadges: false,
  },
];

function initialOpenState(groups: Record<SectionKey, EMStudentRow[]>): Record<SectionKey, boolean> {
  const o: Record<SectionKey, boolean> = {
    english: false,
    maths: false,
    both: false,
    neither: false,
  };
  const first =
    SECTION_ORDER.find(({ key }) => groups[key].length > 0)?.key ?? "english";
  o[first] = true;
  return o;
}

export function EMTargetGroupAccordions({ students }: { students: EMStudentRow[] }) {
  const groups = useMemo(() => partitionStudents(students), [students]);

  const [open, setOpen] = useState<Record<SectionKey, boolean>>(() =>
    initialOpenState(groups),
  );

  useEffect(() => {
    setOpen(initialOpenState(groups));
  }, [groups]);

  const toggle = (key: SectionKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] bg-[var(--surface-container-lowest)] px-5 py-10 text-center text-muted shadow-ambient">
        No students match your criteria.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {SECTION_ORDER.map(({ key, title, summaryBadges }) => {
        const sectionRows = groups[key];
        if (sectionRows.length === 0) return null;

        const isOpen = open[key];
        const metBothInSection = sectionRows.filter((r) => r.met).length;

        return (
          <div
            key={key}
            className="overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--outline-variant)_18%,transparent)] bg-[var(--surface-container-lowest)] shadow-ambient"
          >
            <button
              type="button"
              onClick={() => toggle(key)}
              className="flex w-full items-center gap-3 bg-[var(--surface-container-low)] px-4 py-3.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--surface-container-low)_92%,var(--surface-container)_8%)] md:px-5"
            >
              <ChevronDown open={isOpen} />
              <span className="min-w-0 flex-1 text-sm font-semibold tracking-[-0.01em] text-text">
                {title(sectionRows.length)}
              </span>
              {!isOpen && (
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <span
                    className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-cat-violet-text px-2 text-xs font-bold text-white tabular-nums"
                    title="Students in section"
                  >
                    {sectionRows.length}
                  </span>
                  {summaryBadges && metBothInSection > 0 ? (
                    <span
                      className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-scale-strong px-2 text-xs font-bold text-white tabular-nums"
                      title="Met both E&M"
                    >
                      {metBothInSection}
                    </span>
                  ) : null}
                </div>
              )}
            </button>

            {isOpen ? (
              <div className="border-t border-[color-mix(in_srgb,var(--outline-variant)_14%,transparent)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-head-row text-left">
                        <th className="px-5 py-3">Subject / student</th>
                        <th className="px-4 py-3">Flags</th>
                        <th className="px-4 py-3 text-center">English</th>
                        <th className="px-4 py-3 text-center">Maths</th>
                        <th className="px-4 py-3 text-center">Met both</th>
                        <th className="px-4 py-3 text-center">Overall avg</th>
                        <th className="px-4 py-3 text-center">Vs prev point</th>
                      </tr>
                    </thead>
                    <tbody>
                      <StudentRows rows={sectionRows} />
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
