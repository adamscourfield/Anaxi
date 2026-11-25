"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { attendanceBand } from "@/modules/classes/metrics";
import { defaultClassLabels, formatYearGroups, type ClassLabels } from "@/modules/classes/presentation";
import type { ClassData } from "@/modules/classes/data";

type Pupil = ClassData["students"][number];
type Selection = { label: string; ids: string[] } | null;

const date = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

const ATTENDANCE_BANDS = ["95–100%", "90–94.9%", "Below 90%"] as const;
const KS2_BANDS = ["110 and above", "100–109", "Below 100", "Not recorded"] as const;

export function ClassDetail({ data, windowDays, labels = defaultClassLabels }: { data: ClassData; windowDays: number; labels?: ClassLabels }) {
  const [pointId, setPointId] = useState(data.points[0]?.id ?? "");
  const point = data.points.find((p) => p.id === pointId);
  const [scope, setScope] = useState(data.behaviourSnapshots[0]?.scope ?? "events");
  const snapshot = data.behaviourSnapshots.find((s) => s.scope === scope);
  const [selection, setSelection] = useState<Selection>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");

  const definitions = [
    { key: "positive", label: labels.positive, field: "positivePointsTotal", event: "positivePoints" },
    { key: "detention", label: labels.detention, field: "detentionsCount", event: "DETENTION" },
    { key: "onCall", label: labels.onCall, field: "onCallsCount", event: "ON_CALL" },
    { key: "lateness", label: labels.lateness, field: "latenessCount", event: "LATENESS" },
    { key: "internalExclusion", label: labels.internalExclusion, field: "internalExclusionsCount", event: "INTERNAL_EXCLUSION" },
    { key: "suspension", label: labels.suspension, field: "suspensionsCount", event: "SUSPENSION" },
  ] as const;
  type Measure = (typeof definitions)[number];

  function behaviourValue(s: Pupil, measure: Measure): number | null {
    if (snapshot) return s.behaviourSnapshot?.countScope === scope ? s.behaviourSnapshot[measure.field] : null;
    if (data.behaviourPending || !Object.keys(data.events).length) return null;
    return s.events[measure.event] ?? 0;
  }
  const measures = definitions.map((def) => {
    const values = data.students.flatMap((s) => {
      const value = behaviourValue(s, def);
      return value === null ? [] : [value];
    });
    return { ...def, value: values.length ? values.reduce((a, b) => a + b, 0) : null, pupils: values.filter((n) => n > 0).length };
  });

  function select(label: string, predicate: (student: Pupil) => boolean) {
    setSelection({ label, ids: data.students.filter(predicate).map((s) => s.id) });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("class-pupils-heading")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  }

  const grade = (s: Pupil) => s.grades.find((g) => g.pointId === pointId);
  const hasGrade = (s: Pupil) => {
    const g = grade(s);
    return Boolean(g?.valid && g.status === "PRESENT");
  };
  const scores = data.students.flatMap((s) => {
    const g = grade(s);
    return hasGrade(s) && g?.normalizedScore != null ? [g.normalizedScore] : [];
  });
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  function formatScore(n: number | null) {
    if (n === null) return "—";
    if (point?.format === "GCSE") return (n * 9).toFixed(1);
    if (point?.format === "A_LEVEL") return `${(n * 7).toFixed(1)} / 7`;
    if (point?.format === "RAW") return `${(n * (point.maxScore ?? 1)).toFixed(1)} / ${point.maxScore}`;
    return `${(n * 100).toFixed(1)}${point?.format === "INDEX" ? " / 100" : "%"}`;
  }

  const ks2 = (s: Pupil) => (s.ks2Reading !== null && s.ks2Maths !== null ? (s.ks2Reading + s.ks2Maths) / 2 : null);
  const ks2Scores = data.students.flatMap((s) => {
    const n = ks2(s);
    return n === null ? [] : [n];
  });
  function ks2Band(s: Pupil) {
    const n = ks2(s);
    return n === null ? "Not recorded" : n < 100 ? "Below 100" : n < 110 ? "100–109" : "110 and above";
  }
  const binLabels = point?.format === "INDEX" ? ["0–19", "20–39", "40–59", "60–79", "80–100"] : ["0–19%", "20–39%", "40–59%", "60–79%", "80–100%"];
  function gradeBand(s: Pupil) {
    const g = grade(s);
    if (!hasGrade(s)) return "Not recorded";
    return ["PERCENTAGE", "RAW", "INDEX"].includes(point?.format ?? "") && g?.normalizedScore != null
      ? binLabels[Math.min(4, Math.max(0, Math.floor(g.normalizedScore * 5)))]
      : g?.value?.trim() || "Not recorded";
  }
  const distribution = [...new Set(data.students.map(gradeBand))]
    .sort((a, b) => (a === "Not recorded" ? 1 : b === "Not recorded" ? -1 : b.localeCompare(a, undefined, { numeric: true })))
    .map((label) => ({ label, value: data.students.filter((s) => gradeBand(s) === label).length }));

  const visible = useMemo(
    () =>
      data.students
        .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()) && (!selection || selection.ids.includes(s.id)))
        .sort((a, b) =>
          sort === "attendance"
            ? (a.snapshot?.attendancePct ?? 101) - (b.snapshot?.attendancePct ?? 101)
            : sort === "attainment"
              ? (grade(b)?.normalizedScore ?? -1) - (grade(a)?.normalizedScore ?? -1)
              : a.name.localeCompare(b.name),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.students, search, selection, sort, pointId],
  );

  // The roster always shows the first two measures, plus whichever one you filtered by.
  const selectedMeasure = measures.find((m) => m.label === selection?.label);
  const rosterMeasures =
    selectedMeasure && !measures.slice(0, 2).some((m) => m.key === selectedMeasure.key) ? [...measures.slice(0, 2), selectedMeasure] : measures.slice(0, 2);

  const behaviourCaption = snapshot
    ? `${snapshot.label} from your MIS · ${snapshot.pupils} of ${data.count} pupils${data.behaviourThrough ? ` · up to ${date(data.behaviourThrough)}` : ""}`
    : data.behaviourPending
      ? "Behaviour will appear once the first Arbor import has finished."
      : `Last ${windowDays} days · all lessons, not just this class`;

  const cycleColumns = data.points.filter((p) => p.cycleId === point?.cycleId);

  return (
    <div className="space-y-10">
      {/* ── Headline numbers ───────────────────────────────────── */}
      <section className="class-stats" aria-label="Class at a glance">
        <Stat
          label="Attendance"
          value={data.attendance.value === null ? "—" : `${data.attendance.value.toFixed(1)}%`}
          note={data.attendance.value === null ? "No attendance recorded yet" : `${data.attendance.count} of ${data.count} pupils, year to date`}
        />
        <Stat
          label="Prior attainment (KS2)"
          value={ks2Scores.length ? (ks2Scores.reduce((a, b) => a + b, 0) / ks2Scores.length).toFixed(1) : "—"}
          note={ks2Scores.length ? `Reading and maths scaled score · ${ks2Scores.length} of ${data.count} pupils` : "No KS2 results recorded"}
        />
        <Stat
          label="Attainment"
          value={formatScore(mean)}
          note={point ? `${scores.length} of ${data.count} pupils · ${point.label}` : "No assessment results yet"}
        />
      </section>

      {/* ── Behaviour ──────────────────────────────────────────── */}
      <section aria-labelledby="class-behaviour-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="class-behaviour-heading" className="class-section-title">
              Behaviour
            </h2>
            <p className="mt-0.5 text-[13px] text-[#6e6e73]">{behaviourCaption}</p>
          </div>
          {data.behaviourSnapshots.length > 1 || (data.behaviourSnapshots.length && Object.keys(data.events).length) ? (
            <select
              aria-label="Behaviour period"
              className="class-select"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setSelection(null);
              }}
            >
              {data.behaviourSnapshots.map((s) => (
                <option key={s.scope} value={s.scope}>
                  {s.label}
                </option>
              ))}
              {Object.keys(data.events).length ? <option value="events">Last {windowDays} days</option> : null}
            </select>
          ) : null}
        </div>
        <div className="class-measures">
          {measures.map((m) => (
            <button
              type="button"
              key={m.key}
              className="class-measure"
              disabled={m.value === null}
              aria-pressed={selection?.label === m.label}
              onClick={() => select(m.label, (s) => (behaviourValue(s, m) ?? 0) > 0)}
            >
              <span className="text-[13px] text-[#3a3a3c]">{m.label}</span>
              <strong>{m.value ?? "—"}</strong>
              <span className="text-[12px] text-[#6e6e73]">
                {m.value === null ? "No data yet" : `${m.pupils} ${m.pupils === 1 ? "pupil" : "pupils"}`}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[12px] text-[#6e6e73]">Select a measure to see which pupils it covers.</p>
      </section>

      {/* ── Pupils + insights ──────────────────────────────────── */}
      <div className="class-layout">
        <section aria-labelledby="class-pupils-heading" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="class-pupils-heading" className="class-section-title">
                Pupils
              </h2>
              <p className="mt-0.5 text-[13px] text-[#6e6e73]" role="status">
                {selection ? `${visible.length} of ${data.count} · ${selection.label}` : `${data.count} on the class list`}
              </p>
            </div>
            {selection ? (
              <button type="button" className="class-chip" onClick={() => setSelection(null)}>
                {selection.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Show all pupils</span>
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="class-search min-w-[200px] flex-1">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="sr-only">Find a pupil</span>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a pupil" />
            </label>
            {data.points.length ? (
              <select
                aria-label="Assessment shown in the Result column"
                className="class-select max-w-[320px]"
                value={pointId}
                onChange={(e) => {
                  setPointId(e.target.value);
                  setSelection(null);
                }}
              >
                {data.points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.cycle} · {p.label}
                  </option>
                ))}
              </select>
            ) : null}
            <select aria-label="Sort pupils" className="class-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Name A–Z</option>
              <option value="attendance">Lowest attendance first</option>
              {data.points.length ? <option value="attainment">Highest result first</option> : null}
            </select>
          </div>

          <div className="class-card overflow-x-auto">
            <table className="class-table w-full min-w-[640px]">
              <caption className="sr-only">Pupils in {data.name} with attendance, prior attainment, results and behaviour</caption>
              <thead>
                <tr>
                  <th scope="col">Pupil</th>
                  <th scope="col">Attendance</th>
                  <th scope="col">KS2</th>
                  <th scope="col">Result</th>
                  {rosterMeasures.map((m) => (
                    <th scope="col" key={m.key} className="text-right">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => {
                  const att = s.snapshot?.attendancePct;
                  return (
                    <tr key={s.id}>
                      <th scope="row">
                        <Link href={`/students/${s.id}`} className="font-semibold hover:underline">
                          {s.name}
                        </Link>
                        <span className="block text-[12px] font-normal text-[#6e6e73]">{formatYearGroups(s.yearGroup)}</span>
                      </th>
                      <td>
                        {att === undefined ? (
                          <span className="text-[#a1a1aa]">—</span>
                        ) : (
                          <span className="flex items-center gap-2.5">
                            <span className={`w-[46px] tabular-nums ${att < 90 ? "class-low" : ""}`}>{att.toFixed(1)}%</span>
                            <span className="class-track" aria-hidden="true">
                              <span style={{ width: `${Math.max(0, Math.min(100, att))}%` }} data-low={att < 90 || undefined} />
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="tabular-nums">
                        {ks2(s)?.toFixed(1) ?? <span className="text-[#a1a1aa]">—</span>}
                        {ks2(s) !== null ? <span className="block text-[11px] text-[#6e6e73]">R {s.ks2Reading} · M {s.ks2Maths}</span> : null}
                      </td>
                      <td className="tabular-nums">{hasGrade(s) ? grade(s)?.value : <span className="text-[#a1a1aa]">—</span>}</td>
                      {rosterMeasures.map((m) => (
                        <td key={m.key} className="text-right tabular-nums">
                          {behaviourValue(s, m) ?? <span className="text-[#a1a1aa]">—</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visible.length ? <p className="p-10 text-center text-[14px] text-[#6e6e73]">No pupils match.</p> : null}
          </div>
          <p className="text-[12px] text-[#6e6e73]">Averages leave out pupils with no data.</p>

          {cycleColumns.length > 1 ? (
            <details className="class-card class-history">
              <summary>
                Every assessment in {point?.cycle}
                <span className="text-[12px] font-normal text-[#6e6e73]">{cycleColumns.length} assessments</span>
              </summary>
              <div className="overflow-x-auto border-t border-[#efeff0]">
                <table className="class-table w-full">
                  <thead>
                    <tr>
                      <th scope="col">Pupil</th>
                      {cycleColumns.map((p) => (
                        <th scope="col" key={p.id}>
                          {p.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.id}>
                        <th scope="row" className="font-medium">
                          {s.name}
                        </th>
                        {cycleColumns.map((p) => {
                          const g = s.grades.find((x) => x.pointId === p.id);
                          return (
                            <td key={p.id} className="tabular-nums">
                              {g?.valid && g.status === "PRESENT" ? g.value : <span className="text-[#a1a1aa]">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </section>

        <aside className="space-y-4" aria-label="Class breakdowns">
          <Breakdown
            title="Attendance"
            subtitle="Pupils by year-to-date attendance"
            rows={[
              ...ATTENDANCE_BANDS.map((label) => ({
                label,
                value: data.students.filter((s) => s.snapshot && attendanceBand(s.snapshot.attendancePct) === label).length,
                tone: label === "Below 90%" ? ("low" as const) : undefined,
              })),
              { label: "No data", value: data.students.filter((s) => !s.snapshot).length, tone: "muted" as const },
            ]}
            total={data.count}
            active={selection?.label}
            onSelect={(label) =>
              select(`Attendance ${label}`, (s) => (label === "No data" ? !s.snapshot : !!s.snapshot && attendanceBand(s.snapshot.attendancePct) === label))
            }
            labelPrefix="Attendance "
          />
          <Breakdown
            title="Attainment"
            subtitle={point ? point.label : "No assessment results yet"}
            rows={distribution.map((d) => ({ ...d, tone: d.label === "Not recorded" ? ("muted" as const) : undefined }))}
            total={data.count}
            active={selection?.label}
            onSelect={(label) => select(`Result ${label}`, (s) => gradeBand(s) === label)}
            labelPrefix="Result "
          />
          <Breakdown
            title="Prior attainment"
            subtitle="KS2 reading and maths scaled score"
            rows={KS2_BANDS.map((label) => ({
              label,
              value: data.students.filter((s) => ks2Band(s) === label).length,
              tone: label === "Not recorded" ? ("muted" as const) : undefined,
            }))}
            total={data.count}
            active={selection?.label}
            onSelect={(label) => select(`KS2 ${label}`, (s) => ks2Band(s) === label)}
            labelPrefix="KS2 "
          />
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="class-stat">
      <p className="text-[12px] font-medium text-[#6e6e73]">{label}</p>
      <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</p>
      <p className="mt-2 text-[12px] text-[#6e6e73]">{note}</p>
    </div>
  );
}

function Breakdown({
  title,
  subtitle,
  rows,
  total,
  active,
  onSelect,
  labelPrefix,
}: {
  title: string;
  subtitle: string;
  rows: { label: string; value: number; tone?: "low" | "muted" }[];
  total: number;
  active?: string;
  onSelect: (label: string) => void;
  labelPrefix: string;
}) {
  return (
    <section className="class-card p-5" aria-label={title}>
      <h3 className="text-[14px] font-semibold">{title}</h3>
      <p className="mt-0.5 text-[12px] text-[#6e6e73]">{subtitle}</p>
      {rows.some((r) => r.value > 0) ? (
        <ul className="mt-4 space-y-1">
          {rows.map((row) => (
            <li key={row.label}>
              <button
                type="button"
                className="class-bar-row"
                disabled={row.value === 0}
                aria-pressed={active === `${labelPrefix}${row.label}`}
                onClick={() => onSelect(row.label)}
              >
                <span className="flex justify-between gap-3 text-[13px]">
                  <span className={row.tone === "muted" ? "text-[#6e6e73]" : "text-[#1c1c1e]"}>{row.label}</span>
                  <span className="font-semibold tabular-nums">{row.value}</span>
                </span>
                <span className="class-track mt-1.5 block w-full" aria-hidden="true">
                  <span style={{ width: `${total ? (row.value / total) * 100 : 0}%` }} data-tone={row.tone} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-[13px] text-[#6e6e73]">No data yet.</p>
      )}
    </section>
  );
}
