"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { TableScrollRegion } from "@/components/ui/table-scroll-region";
import type { ClassSummary } from "@/modules/classes/data";
import { BarChart } from "./charts";

export function ClassesDirectory({ classes, pupilCount, windowDays }: { classes: ClassSummary[]; pupilCount: number; windowDays: number }) {
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const [sort, setSort] = useState("class");
  const [page, setPage] = useState(1);
  const years = [...new Set(classes.map(c => c.yearGroup))];
  const subjects = [...new Set(classes.map(c => c.subject))].sort();
  const teachers = [...new Map(classes.flatMap(c => c.teachers.map(t => [t.id, t.name] as const)))].sort((a, b) => a[1].localeCompare(b[1]));
  const filtered = useMemo(() => classes.filter(c => (!year || c.yearGroup === year) && (!subject || c.subject === subject) && (!teacher || c.teachers.some(t => t.id === teacher)) && `${c.name} ${c.subject} ${c.teachers.map(t => t.name).join(" ")}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "attendance" ? (a.attendance.value ?? 101) - (b.attendance.value ?? 101) : sort === "behaviour" ? (b.events.DETENTION ?? 0) - (a.events.DETENTION ?? 0) : a.yearGroup.localeCompare(b.yearGroup, undefined, { numeric: true }) || a.name.localeCompare(b.name, undefined, { numeric: true })), [classes, year, subject, teacher, search, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const visible = filtered.slice((Math.min(page, pageCount) - 1) * 20, Math.min(page, pageCount) * 20);
  const withAttendance = classes.filter(c => c.attendance.value !== null).length;
  const withMarks = classes.filter(c => c.recorded > 0).length;
  const yearRows = years.map(label => ({ label, value: classes.filter(c => c.yearGroup === label).length }));
  const coverage = [{ label: "Attendance available", value: withAttendance }, { label: "Attainment available", value: withMarks }, { label: "Named teachers", value: classes.filter(c => c.teachers.length).length }];
  function reset() { setSearch(""); setYear(""); setSubject(""); setTeacher(""); setPage(1); }
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Current classes" value={classes.length} context="Active pupil memberships" tone="glass" />
      <StatCard label="Pupils on class lists" value={pupilCount} context="Unique pupils across classes" tone="glass" />
      <StatCard label="Attendance coverage" value={`${withAttendance} / ${classes.length}`} context="Classes with recorded attendance" tone="glass" />
      <StatCard label="Attainment coverage" value={`${withMarks} / ${classes.length}`} context="Classes with a recorded subject result" tone="softGrey" />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <BarChart title="Classes by year group" subtitle="Current teaching groups in your school" rows={yearRows} />
      <BarChart title="Data coverage" subtitle="Number of classes with available records" rows={coverage} max={classes.length || 1} color="var(--success)" />
    </div>
    <section className="class-panel overflow-hidden" aria-labelledby="class-directory-heading">
      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="class-directory-heading" className="text-lg font-semibold">Class directory</h2><p className="mt-1 text-sm text-muted">Find a teaching group and explore its pupils.</p></div><span className="class-badge" role="status">{filtered.length} {filtered.length === 1 ? "class" : "classes"}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="class-field"><label htmlFor="class-search">Search classes or teachers</label><input className="field" id="class-search" type="search" placeholder="e.g. 10Y1 or Mathematics" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
          <div className="class-field"><label htmlFor="class-year">Year group</label><select className="field" id="class-year" value={year} onChange={e => { setYear(e.target.value); setPage(1); }}><option value="">All year groups</option>{years.map(y => <option key={y}>{y}</option>)}</select></div>
          <div className="class-field"><label htmlFor="class-subject">Subject</label><select className="field" id="class-subject" value={subject} onChange={e => { setSubject(e.target.value); setPage(1); }}><option value="">All subjects</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="class-field"><label htmlFor="class-teacher">Teacher</label><select className="field" id="class-teacher" value={teacher} onChange={e => { setTeacher(e.target.value); setPage(1); }}><option value="">All teachers</option>{teachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
          <div className="class-field"><label htmlFor="class-sort">Sort by</label><select className="field" id="class-sort" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="class">Class name</option><option value="attendance">Lowest attendance</option><option value="behaviour">Most detentions</option></select></div>
        </div>
        {(search || year || subject || teacher) && <button onClick={reset} className="mt-3 text-xs font-semibold text-accent hover:underline focus-visible:outline-accent">Clear filters</button>}
      </div>
      {!filtered.length ? <div className="px-6 py-16 text-center"><h3 className="font-semibold">{classes.length ? "No matching classes" : "No current classes yet"}</h3><p className="mt-2 text-sm text-muted">{classes.length ? "Try another search or clear the filters." : "Classes appear when current pupil memberships include a class name and teacher."}</p></div> : <div className="px-5 sm:px-6"><TableScrollRegion><table className="class-table w-full text-left text-sm"><caption className="sr-only">Current classes, teachers, attendance, attainment coverage and pupil detentions</caption><thead><tr><th scope="col">Class / subject</th><th scope="col">Teachers</th><th scope="col">Pupils</th><th scope="col">Attendance</th><th scope="col">Attainment</th><th scope="col">Detentions</th></tr></thead><tbody>{visible.map(c => <tr key={c.id}>
        <td><Link className="class-link font-semibold" href={`/classes/${c.id}?window=${windowDays}`}>{c.name}<span aria-hidden="true" className="ml-2 text-muted">↗</span></Link><p className="mt-1 text-xs text-muted">{c.yearGroup} · {c.subject}</p></td>
        <td><div className="max-w-[230px] text-xs leading-relaxed">{c.teachers.map(t => t.name).join(" · ") || "Not assigned"}</div></td>
        <td className="tabular-nums">{c.count}</td>
        <td><span className={`tabular-nums font-semibold ${c.attendance.value !== null && c.attendance.value < 90 ? "text-error" : ""}`}>{c.attendance.value === null ? "—" : `${c.attendance.value.toFixed(1)}%`}</span><p className="mt-1 text-[11px] text-muted">{c.attendance.count}/{c.count} pupils · {c.attendance.weighted ? "weighted" : "pupil mean"}</p></td>
        <td><span className="tabular-nums">{c.recorded} / {c.count}</span><p className="mt-1 max-w-[230px] text-[11px] text-muted">{c.latest ?? "No subject results"}</p></td>
        <td><span className="tabular-nums">{c.events.DETENTION ?? 0}</span><p className="mt-1 text-[11px] text-muted">Last {windowDays} days</p></td>
      </tr>)}</tbody></table></TableScrollRegion></div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 text-xs text-muted"><span>Page {Math.min(page, pageCount)} of {pageCount} · {filtered.length} classes</span><div className="flex gap-2"><button className="class-page-button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><button className="class-page-button" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
    </section>
  </>;
}
