"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { GradeFormat } from "@prisma/client";
import { parseClipboard } from "@/lib/assessment-clipboard";
import { formatYearGroup } from "@/lib/yearGroup";
import { detectNonGradeStatus, validateGrade } from "@/modules/assessments/gradeNormalizer";
import { toast } from "@/components/toast-provider";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import styles from "./page.module.css";

type Student = { id: string; fullName: string; upn: string | null; yearGroup: string };
type Assessment = { subject: string; yearGroup: string; gradeFormat: string; studentIds: string[] };
type Sheet = {
  point: { label: string; cycleLabel: string; status: string };
  students: Student[];
  subjects: string[];
  values: Record<string, Record<string, string>>;
  assessments: Assessment[];
};

const FORMAT_HINT: Record<string, string> = {
  GCSE: "Grades 1–9, U, or Absent",
  A_LEVEL: "A*, A–E, U, or Absent",
  PERCENTAGE: "0–100 (with or without %), or Absent",
  RAW: "A number, or Absent",
};

const key = (studentId: string, subject: string) => `${studentId}::${subject}`;

export default function EnterGradesPage() {
  const { cycleId, pointId } = useParams<{ cycleId: string; pointId: string }>();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [original, setOriginal] = useState<Sheet["values"]>({});
  const [values, setValues] = useState<Sheet["values"]>({});
  const [nameFilter, setNameFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState("");
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/assessments/points/${pointId}/grid`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Unable to load grades");
        if (!cancelled) {
          setSheet(data);
          setOriginal(data.values);
          setValues(data.values);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [pointId]);

  /** Which assessment (and so which grade format) a cell belongs to. */
  const assessmentFor = useMemo(() => {
    const map = new Map<string, Assessment>();
    if (!sheet) return map;
    for (const a of sheet.assessments) {
      for (const s of sheet.students) {
        if (s.yearGroup === a.yearGroup || a.studentIds.includes(s.id)) map.set(key(s.id, a.subject), a);
      }
    }
    return map;
  }, [sheet]);

  /** Every cell that differs from what was loaded. */
  const changes = useMemo(() => {
    const list: Array<{ studentId: string; subject: string; value: string }> = [];
    for (const [studentId, row] of Object.entries(values)) {
      for (const [subject, raw] of Object.entries(row)) {
        const value = (raw ?? "").trim();
        if (value !== (original[studentId]?.[subject] ?? "").trim()) list.push({ studentId, subject, value });
      }
    }
    return list;
  }, [values, original]);

  /** Changed cells whose grade doesn't fit the subject's format, with the reason. */
  const invalid = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of changes) {
      if (!c.value || detectNonGradeStatus(c.value)) continue;
      const a = assessmentFor.get(key(c.studentId, c.subject));
      if (!a) {
        map.set(key(c.studentId, c.subject), "This student isn't in this subject's year group");
        continue;
      }
      const problem = validateGrade(c.value, a.gradeFormat as GradeFormat, undefined);
      if (problem) map.set(key(c.studentId, c.subject), problem);
    }
    return map;
  }, [changes, assessmentFor]);

  const dirty = changes.length > 0;

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const students = useMemo(() => {
    const words = nameFilter.toLowerCase().split(/\s+/).filter(Boolean);
    return (sheet?.students ?? [])
      .filter((s) => words.every((w) => s.fullName.toLowerCase().includes(w)))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [sheet, nameFilter]);
  const subjects = useMemo(
    () => (sheet?.subjects ?? []).filter((s) => s.toLowerCase().includes(subjectFilter.toLowerCase().trim())),
    [sheet, subjectFilter],
  );
  const studentName = useMemo(() => new Map((sheet?.students ?? []).map((s) => [s.id, s.fullName])), [sheet]);

  const locked = sheet?.point.status === "LOCKED";
  const inUse = sheet?.point.status === "PUBLISHED";

  function update(id: string, subject: string, value: string) {
    setValues((v) => ({ ...v, [id]: { ...v[id], [subject]: value } }));
  }

  function paste(e: React.ClipboardEvent<HTMLInputElement>, row: number, column: number) {
    const cells = parseClipboard(e.clipboardData.getData("text/plain"));
    if (!cells.length || (cells.length === 1 && cells[0].length === 1)) return; // a single value pastes normally
    e.preventDefault();
    const fits = cells.length <= students.length - row && cells.every((r) => r.length <= subjects.length - column);
    if (!fits) {
      toast("The pasted range is bigger than the visible sheet. Clear the filters or start from an earlier cell.", "error");
      return;
    }
    setValues((prev) => {
      const next = { ...prev };
      cells.forEach((r, ri) => {
        const id = students[row + ri].id;
        next[id] = { ...next[id] };
        r.forEach((value, ci) => {
          next[id][subjects[column + ci]] = value.trim();
        });
      });
      return next;
    });
    toast(`Pasted ${cells.length} row${cells.length === 1 ? "" : "s"}. Check them, then save.`, "success");
  }

  function focusFirstInvalid() {
    const first = [...invalid.keys()][0];
    if (!first) return;
    const [studentId, subject] = first.split("::");
    setNameFilter("");
    setSubjectFilter("");
    requestAnimationFrame(() => {
      const ri = students.findIndex((s) => s.id === studentId);
      const ci = subjects.indexOf(subject);
      refs.current[`${ri}:${ci}`]?.focus();
    });
  }

  function discard() {
    setValues(original);
    setError("");
  }

  async function save() {
    if (!sheet || !dirty) return;
    if (invalid.size) {
      setError(`${invalid.size} grade${invalid.size === 1 ? " needs" : "s need"} fixing before you can save. They're outlined in red.`);
      focusFirstInvalid();
      return;
    }
    setSaving(true);
    setError("");
    // One request per subject that changed, sending only the changed cells.
    const bySubject = new Map<Assessment, Array<{ studentId: string; value: string }>>();
    for (const c of changes) {
      const a = assessmentFor.get(key(c.studentId, c.subject));
      if (!a) continue;
      if (!bySubject.has(a)) bySubject.set(a, []);
      bySubject.get(a)!.push(c);
    }
    const saved: string[] = [];
    const failed: string[] = [];
    let cleared = 0;
    const nextOriginal = structuredClone(original);
    for (const [a, cells] of bySubject) {
      try {
        const response = await fetch(`/api/assessments/points/${pointId}/grid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "changes",
            yearGroup: a.yearGroup,
            gradeFormat: a.gradeFormat,
            subjects: [a.subject],
            entries: cells.map((c) => {
              const s = sheet.students.find((x) => x.id === c.studentId)!;
              return { studentId: s.id, upn: s.upn ?? "", studentName: s.fullName, values: { [a.subject]: c.value } };
            }),
          }),
        });
        const result = await response.json();
        if (!response.ok || result.totalFailed) throw new Error(result.error || "Not saved");
        cleared += result.totalCleared ?? 0;
        for (const c of cells) (nextOriginal[c.studentId] ??= {})[a.subject] = c.value;
        saved.push(a.subject);
      } catch {
        failed.push(a.subject);
      }
    }
    setOriginal(nextOriginal);
    setSaving(false);
    if (failed.length) {
      setError(
        `${saved.length ? `Saved ${saved.join(", ")}. ` : ""}Couldn't save ${failed.join(", ")}. Your changes there are still on screen; try saving again.`,
      );
    } else {
      toast(`Saved ${saved.length} ${saved.length === 1 ? "subject" : "subjects"}${cleared ? `, ${cleared} grade${cleared === 1 ? "" : "s"} removed` : ""}`, "success");
    }
  }

  const changedCount = changes.length;
  const invalidList = [...invalid.entries()].slice(0, 4);

  return (
    <div className={styles.sheetPage}>
      <AssessmentsBreadcrumb
        items={[
          { label: "Attainment", href: "/assessments" },
          { label: sheet?.point.cycleLabel ?? "Cycle", href: `/assessments/${cycleId}` },
          { label: sheet?.point.label ?? "Result point", href: `/assessments/${cycleId}/points/${pointId}` },
          { label: "Enter grades" },
        ]}
      />
      <header className={styles.sheetHeader}>
        <div>
          <h1>Enter grades</h1>
          <p>
            {sheet ? `${sheet.point.cycleLabel} · ${sheet.point.label}. ` : ""}Type grades, or paste a block copied from Excel into
            the first cell. Clear a cell to remove a grade.
          </p>
        </div>
        <div className={styles.actions}>
          {dirty && !saving && (
            <button type="button" className={styles.secondary} onClick={discard}>
              Discard changes
            </button>
          )}
          <button type="button" className={styles.primary} onClick={save} disabled={!dirty || saving || locked}>
            {saving ? "Saving…" : dirty ? `Save ${changedCount} ${changedCount === 1 ? "change" : "changes"}` : "Save grades"}
          </button>
        </div>
      </header>

      {locked && <p className={styles.notice}>These results are locked, so grades can&apos;t be changed. An administrator can unlock them from the cycle page.</p>}
      {inUse && (
        <p className={styles.notice}>These results are in use. Saved changes show straight away in attainment insights and on student profiles.</p>
      )}
      {sheet?.point.status === "DRAFT" && (
        <p className={styles.notice}>These results are a draft: they show on student profiles but are left out of attainment insights until published.</p>
      )}
      {error && (
        <div role="alert" className={styles.error}>
          <p>{error}</p>
          {invalidList.length > 0 && (
            <ul>
              {invalidList.map(([k, why]) => {
                const [sid, subject] = k.split("::");
                return (
                  <li key={k}>
                    {studentName.get(sid)}, {subject}: &ldquo;{values[sid]?.[subject]}&rdquo; — {why}
                  </li>
                );
              })}
              {invalid.size > invalidList.length && <li>and {invalid.size - invalidList.length} more</li>}
            </ul>
          )}
        </div>
      )}

      {!sheet ? (
        <p className={styles.empty}>{error ? "" : "Loading students and grades…"}</p>
      ) : !sheet.subjects.length ? (
        <div className={styles.emptyCard}>
          <h2>No subjects yet</h2>
          <p>Subjects appear here once their first results are uploaded.</p>
          <Link href={`/assessments/${cycleId}/points/${pointId}/upload`}>Upload results</Link>
        </div>
      ) : (
        <section className={styles.workbook} aria-label="Grades">
          <div className={styles.sheetToolbar}>
            <label>
              Find a student
              <input type="search" placeholder="Name…" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
            </label>
            <label>
              Show subjects
              <input type="search" placeholder="Subject…" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} />
            </label>
          </div>
          <div className={styles.formulaBar}>
            <span>{active || "Select a cell to start typing"}</span>
            <span>
              {dirty ? `${changedCount} unsaved ${changedCount === 1 ? "change" : "changes"}` : "No unsaved changes"} · {students.length} of {sheet.students.length} students · {subjects.length} of {sheet.subjects.length} subjects
            </span>
          </div>
          <div className={styles.sheetScroll}>
            <table className={styles.sheetTable}>
              <thead>
                <tr>
                  <th className={styles.studentColumn}>Student</th>
                  {subjects.map((s) => {
                    const format = sheet.assessments.find((a) => a.subject === s)?.gradeFormat ?? "";
                    return (
                      <th key={s} title={FORMAT_HINT[format]}>
                        {s}
                        <span>{FORMAT_HINT[format] ?? ""}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((s, ri) => (
                  <tr key={s.id}>
                    <th className={styles.studentColumn} scope="row">
                      {s.fullName}
                      <small>{formatYearGroup(s.yearGroup)}</small>
                    </th>
                    {subjects.map((subject, ci) => {
                      const k = key(s.id, subject);
                      const value = values[s.id]?.[subject] ?? "";
                      const changed = value.trim() !== (original[s.id]?.[subject] ?? "").trim();
                      const problem = invalid.get(k);
                      const inSubject = assessmentFor.has(k);
                      return (
                        <td key={subject} className={`${changed ? styles.changed : ""} ${problem ? styles.invalid : ""} ${!inSubject ? styles.outside : ""}`}>
                          <input
                            ref={(el) => {
                              refs.current[`${ri}:${ci}`] = el;
                            }}
                            aria-label={`${s.fullName}, ${subject}`}
                            aria-invalid={problem ? true : undefined}
                            title={problem ?? (!inSubject ? "Not in this subject's year group" : undefined)}
                            value={value}
                            disabled={locked || saving}
                            autoComplete="off"
                            spellCheck={false}
                            onChange={(e) => update(s.id, subject, e.target.value)}
                            onFocus={() => setActive(`${subject} · ${s.fullName}${problem ? ` · ${problem}` : ""}`)}
                            onPaste={(e) => paste(e, ri, ci)}
                            onKeyDown={(e) => {
                              const r = e.key === "Enter" || e.key === "ArrowDown" ? ri + 1 : e.key === "ArrowUp" ? ri - 1 : ri;
                              if (r !== ri && refs.current[`${r}:${ci}`]) {
                                e.preventDefault();
                                refs.current[`${r}:${ci}`]?.focus();
                              }
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {(!students.length || !subjects.length) && <p className={styles.empty}>No matches. Change the student or subject search.</p>}
          </div>
          <footer className={styles.sheetFooter}>
            Changed cells are shaded until saved; red means the grade doesn&apos;t fit the subject. Paste fills from the selected cell in the
            order shown. Enter moves down, Tab moves across.
          </footer>
        </section>
      )}
    </div>
  );
}
