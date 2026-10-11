"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { parseClipboard } from "@/lib/assessment-clipboard";
import { formatYearGroup } from "@/modules/observations/yearGroup";
import { toast } from "@/components/toast-provider";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import styles from "./page.module.css";

type Student = { id: string; fullName: string; upn: string | null; yearGroup: string };
type Sheet = {
  point: { label: string; cycleLabel: string; status: string };
  students: Student[]; subjects: string[];
  values: Record<string, Record<string, string>>;
  assessments: { subject: string; yearGroup: string; gradeFormat: string; studentIds: string[] }[];
};


export default function EnterGradesPage() {
  const { cycleId, pointId } = useParams<{ cycleId: string; pointId: string }>();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [values, setValues] = useState<Sheet["values"]>({});
  const [nameFilter, setNameFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [nameOrder, setNameOrder] = useState("asc");
  const [subjectOrder, setSubjectOrder] = useState("asc");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState("Select a grade cell");
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/assessments/points/${pointId}/grid`).then(async r => {
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "Unable to load grades");
      if (!cancelled) { setSheet(data); setValues(data.values); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [pointId]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const students = useMemo(() => (sheet?.students ?? [])
    .filter(s => s.fullName.toLowerCase().includes(nameFilter.toLowerCase()))
    .sort((a,b) => a.fullName.localeCompare(b.fullName) * (nameOrder === "asc" ? 1 : -1)),
  [sheet, nameFilter, nameOrder]);
  const subjects = useMemo(() => (sheet?.subjects ?? [])
    .filter(s => s.toLowerCase().includes(subjectFilter.toLowerCase()))
    .sort((a,b) => a.localeCompare(b) * (subjectOrder === "asc" ? 1 : -1)),
  [sheet, subjectFilter, subjectOrder]);
  const locked = sheet?.point.status === "LOCKED";
  function update(id: string, subject: string, value: string) {
    setValues(v => ({ ...v, [id]: { ...v[id], [subject]: value } })); setDirty(true);
  }
  function paste(e: React.ClipboardEvent<HTMLInputElement>, row: number, column: number) {
    const cells = parseClipboard(e.clipboardData.getData("text/plain"));
    if (!cells.length) return;
    e.preventDefault();
    const fits = cells.length <= students.length - row && cells.every(r => r.length <= subjects.length - column);
    if (!fits) { toast("The pasted range exceeds the visible sheet. Clear filters or select an earlier cell.", "error"); return; }
    setValues(prev => {
      const next = { ...prev };
      cells.forEach((r, ri) => {
        const id = students[row + ri].id;
        next[id] = { ...next[id] };
        r.forEach((value, ci) => { next[id][subjects[column + ci]] = value.trim(); });
      });
      return next;
    });
    setDirty(true);
    toast(`Pasted ${cells.length} row${cells.length === 1 ? "" : "s"}.`, "success");
  }
  async function save() {
    if (!sheet) return;
    setSaving(true); setError("");
    try {
      // Keep each assessment's cohort and grade format intact.
      for (const assessment of sheet.assessments) {
        const response = await fetch(`/api/assessments/points/${pointId}/grid`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            yearGroup: assessment.yearGroup, gradeFormat: assessment.gradeFormat, subjects: [assessment.subject],
            entries: sheet.students.filter(s => s.yearGroup === assessment.yearGroup || assessment.studentIds.includes(s.id)).map(s => ({
              upn: s.upn ?? "", studentName: s.fullName, values: { [assessment.subject]: values[s.id]?.[assessment.subject] ?? "" },
            })),
          }),
        });
        const result = await response.json();
        if (!response.ok || result.parseErrors || result.totalFailed) throw new Error(result.error || "Some grades could not be saved. Check grades against the subject's format and try again.");
      }
      setDirty(false); toast("Grades saved", "success");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save grades"); }
    finally { setSaving(false); }
  }
  return (
    <div className={styles.sheetPage}>
      <AssessmentsBreadcrumb items={[{ label: "Attainment", href: "/assessments" }, { label: sheet?.point.cycleLabel ?? "Cycle", href: `/assessments/${cycleId}` }, { label: "Grade entry" }]} />
      <header className={styles.sheetHeader}>
        <div><h1>{sheet?.point.label ?? "Grade entry"}</h1><p>Type grades or paste a range from Excel or CSV into the first grade cell.</p></div>
        <button onClick={save} disabled={!dirty || saving || locked}>{saving ? "Saving…" : "Save grades"}</button>
      </header>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {locked && <p>This result point is locked. Grades are read only.</p>}
      {!sheet ? <p>Loading cohort and grades…</p> : !sheet.subjects.length ? (
        <p>No subjects have been added to this assessment. <Link href={`/assessments/${cycleId}/points/${pointId}/upload`}>Upload the first subject results</Link>.</p>
      ) : (
        <section className={styles.workbook} aria-label="Assessment grade spreadsheet">
          <div className={styles.sheetToolbar}>
            <label>Find student<input placeholder="Filter by name…" value={nameFilter} onChange={e => setNameFilter(e.target.value)} /></label>
            <label>Subjects<input placeholder="Filter subject columns…" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} /></label>
            <label>Name order<select value={nameOrder} onChange={e => setNameOrder(e.target.value)}><option value="asc">A → Z</option><option value="desc">Z → A</option></select></label>
            <label>Subject order<select value={subjectOrder} onChange={e => setSubjectOrder(e.target.value)}><option value="asc">A → Z</option><option value="desc">Z → A</option></select></label>
          </div>
          <div className={styles.formulaBar}><span>{active}</span><span>{dirty ? "Unsaved changes" : "All grades loaded"} · {students.length} of {sheet.students.length} students · {subjects.length} subjects</span></div>
          <div className={styles.sheetScroll}>
            <table className={styles.sheetTable}>
              <thead><tr><th className={styles.corner}>1</th><th className={styles.studentColumn}>Student</th>{subjects.map(s => <th key={s}>{s}</th>)}</tr></thead>
              <tbody>{students.map((s,ri) => <tr key={s.id}>
                <th className={styles.rowNumber}>{ri + 2}</th><th className={styles.studentColumn}>{s.fullName}<small>{formatYearGroup(s.yearGroup)}</small></th>
                {subjects.map((subject,ci) => <td key={subject}><input
                  ref={el => { refs.current[`${ri}:${ci}`] = el; }}
                  aria-label={`${s.fullName}, ${subject}`} value={values[s.id]?.[subject] ?? ""}
                  disabled={locked || saving} autoComplete="off" spellCheck={false}
                  onChange={e => update(s.id,subject,e.target.value)}
                  onFocus={() => setActive(`${subject} · ${s.fullName}`)}
                  onPaste={e => paste(e,ri,ci)}
                  onKeyDown={e => {
                    const r = e.key === "Enter" || e.key === "ArrowDown" ? ri + 1 : e.key === "ArrowUp" ? ri - 1 : ri;
                    if (r !== ri && refs.current[`${r}:${ci}`]) { e.preventDefault(); refs.current[`${r}:${ci}`]?.focus(); }
                  }}
                /></td>)}
              </tr>)}</tbody>
            </table>
            {(!students.length || !subjects.length) && <p className={styles.empty}>No matches. Adjust the student or subject filter.</p>}
          </div>
          <footer className={styles.sheetFooter}>Paste grades only, without headers. Paste follows the visible row and column order. Enter moves down; Tab moves across.</footer>
        </section>
      )}
    </div>
  );
}
