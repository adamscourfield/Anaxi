"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { AssessmentsBreadcrumb } from "@/components/assessments/assessments-chrome";
import { AttainmentPageShell } from "@/components/assessments/AttainmentPageShell";
import { LockedPointBanner } from "@/components/assessments/LockedPointBanner";
import { toast } from "@/components/toast-provider";
import { stageForQualificationType } from "@/lib/subjectStages";
import type { GradeFormat } from "@prisma/client";

const GRADE_FORMAT_LABELS: Record<GradeFormat, string> = {
  GCSE: "GCSE (1–9 numeric)",
  A_LEVEL: "A Level (A*–U letter grades)",
  PERCENTAGE: "Percentage (0–100%)",
  RAW: "Raw score",
};

type RosterStudent = { id: string; upn: string | null; fullName: string };

type PointAssessment = { subject: string; yearGroup: string };

/** The year group already in use on this point's existing subjects, if any — the
 * mode (most common value) in the unlikely case a point somehow spans more than one. */
function derivePointYearGroup(assessments: PointAssessment[]): string | null {
  if (assessments.length === 0) return null;
  const counts = new Map<string, number>();
  for (const a of assessments) counts.set(a.yearGroup, (counts.get(a.yearGroup) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

type ImportResult = {
  subjectsImported: number;
  totalProcessed: number;
  totalFailed: number;
  parseErrors?: number;
  results: Array<{ subject: string; rowsProcessed: number; rowsFailed: number }>;
};

export default function EnterGradesPage() {
  const { cycleId, pointId } = useParams<{ cycleId: string; pointId: string }>();
  const router = useRouter();

  const [pointLabel, setPointLabel] = useState("");
  const [cycleLabel, setCycleLabel] = useState("");
  const [qualificationType, setQualificationType] = useState<string>("GCSE");
  const [isLocked, setIsLocked] = useState(false);
  const [gradeFormat, setGradeFormat] = useState<GradeFormat>("GCSE");

  const [pointYearGroup, setPointYearGroup] = useState<string | null>(null);
  const [yearGroup, setYearGroup] = useState("");
  const [yearGroupOptions, setYearGroupOptions] = useState<string[]>([]);
  const [existingSubjects, setExistingSubjects] = useState<string[]>([]);
  const [checkedExistingSubjects, setCheckedExistingSubjects] = useState<Set<string>>(new Set());
  const [subjectChips, setSubjectChips] = useState<string[]>([]);
  const [subjectInputValue, setSubjectInputValue] = useState("");
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);

  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});
  const [sortKey, setSortKey] = useState<"name" | "upn">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch(`/api/assessments/points/${pointId}`)
      .then((r) => r.json())
      .then(({ point }) => {
        setPointLabel(point?.label ?? "");
        setCycleLabel(point?.cycle?.label ?? "");
        setQualificationType(point?.cycle?.qualificationType ?? "GCSE");
        setIsLocked(point?.resultStatus === "LOCKED");
        if (point?.cycle?.qualificationType === "A_LEVEL") setGradeFormat("A_LEVEL");
        else if (point?.cycle?.qualificationType === "GCSE") setGradeFormat("GCSE");
        else if (point?.cycle?.qualificationType === "PERCENTAGE") setGradeFormat("PERCENTAGE");

        const assessments: PointAssessment[] = point?.assessments ?? [];
        const derivedYearGroup = derivePointYearGroup(assessments);
        setPointYearGroup(derivedYearGroup);
        if (derivedYearGroup) setYearGroup(derivedYearGroup);

        const subjects = [...new Set(assessments.map((a) => a.subject))].sort((a, b) => a.localeCompare(b));
        setExistingSubjects(subjects);
        setCheckedExistingSubjects(new Set(subjects));
      })
      .catch(() => {});
  }, [pointId]);

  useEffect(() => {
    if (pointYearGroup) return; // already locked to this point's own cohort
    fetch("/api/assessments/year-groups")
      .then((r) => r.json())
      .then((data) => setYearGroupOptions(data.yearGroups ?? []))
      .catch(() => {});
  }, [pointYearGroup]);

  useEffect(() => {
    const stage = stageForQualificationType(qualificationType);
    fetch(`/api/assessments/subjects${stage ? `?stage=${stage}` : ""}`)
      .then((r) => r.json())
      .then((data) => setSubjectSuggestions(data.subjects ?? []))
      .catch(() => {});
  }, [qualificationType]);

  function addSubjectChip(raw: string) {
    const name = raw.trim();
    if (!name) return;
    const alreadySuggested = subjectSuggestions.some((s) => s.toLowerCase() === name.toLowerCase());
    setSubjectChips((prev) => (prev.some((s) => s.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name]));
    setSubjectInputValue("");

    if (!alreadySuggested) {
      const stage = stageForQualificationType(qualificationType);
      fetch("/api/assessments/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stage }),
      })
        .then(() => setSubjectSuggestions((prev) => (prev.includes(name) ? prev : [...prev, name].sort())))
        .catch(() => {});
    }
  }

  function removeSubjectChip(name: string) {
    setSubjectChips((prev) => prev.filter((s) => s !== name));
  }

  function toggleExistingSubject(name: string) {
    setCheckedExistingSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  // Subjects to grade: this point's own existing subjects (only the checked
  // ones) plus any genuinely new subject added below — never an arbitrary
  // subject unrelated to this point.
  const effectiveSubjects = useMemo(
    () => [...existingSubjects.filter((s) => checkedExistingSubjects.has(s)), ...subjectChips],
    [existingSubjects, checkedExistingSubjects, subjectChips],
  );

  async function loadRoster() {
    if (!yearGroup.trim()) { setError("Select the year group."); toast("Select the year group.", "error"); return; }
    if (effectiveSubjects.length === 0) { setError("Select at least one subject."); toast("Select at least one subject.", "error"); return; }

    setError(null);
    setLoadingRoster(true);
    try {
      const res = await fetch(`/api/assessments/roster?yearGroup=${encodeURIComponent(yearGroup.trim())}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to load students"); toast(data.error || "Failed to load students", "error"); return; }
      const students: RosterStudent[] = data.students ?? [];
      if (students.length === 0) {
        setError(`No active students found in "${yearGroup.trim()}".`);
        toast(`No active students found in "${yearGroup.trim()}".`, "error");
        return;
      }
      setRoster(students);
      setGrid(Object.fromEntries(students.map((s) => [s.id, {}])));
    } finally {
      setLoadingRoster(false);
    }
  }

  function setCell(studentId: string, subject: string, value: string) {
    setGrid((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [subject]: value } }));
  }

  const sortedRoster = useMemo(() => {
    if (!roster) return null;
    const copy = [...roster];
    copy.sort((a, b) => {
      const av = sortKey === "upn" ? (a.upn ?? "") : a.fullName;
      const bv = sortKey === "upn" ? (b.upn ?? "") : b.fullName;
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [roster, sortKey, sortDir]);

  function toggleSort(key: "name" | "upn") {
    setSortKey((prevKey) => {
      setSortDir((prevDir) => (prevKey === key ? (prevDir === "asc" ? "desc" : "asc") : "asc"));
      return key;
    });
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return; // single value: let the default paste happen

    e.preventDefault();
    if (!sortedRoster) return;
    const lines = text.replace(/\r/g, "").split("\n");
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

    setGrid((prev) => {
      const next = { ...prev };
      lines.forEach((line, li) => {
        const r = rowIdx + li;
        if (r >= sortedRoster.length) return;
        const student = sortedRoster[r];
        const cells = line.split("\t");
        const updatedRow = { ...next[student.id] };
        cells.forEach((val, ci) => {
          const c = colIdx + ci;
          if (c >= effectiveSubjects.length) return;
          updatedRow[effectiveSubjects[c]] = val.trim();
        });
        next[student.id] = updatedRow;
      });
      return next;
    });
  }

  const filledCellCount = useMemo(() => {
    let count = 0;
    for (const values of Object.values(grid)) {
      for (const v of Object.values(values)) {
        if (v.trim()) count++;
      }
    }
    return count;
  }, [grid]);

  async function handleSave() {
    if (!roster) return;
    setSaving(true);
    setError(null);
    try {
      const entries = roster.map((s) => ({
        upn: s.upn ?? "",
        studentName: s.fullName,
        values: grid[s.id] ?? {},
      }));
      const res = await fetch(`/api/assessments/points/${pointId}/grid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearGroup: yearGroup.trim(), gradeFormat, subjects: effectiveSubjects, entries }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Save failed"); toast(data.error || "Save failed", "error"); return; }
      setImportResult(data);
      const failed = data.totalFailed ?? 0;
      const invalid = data.parseErrors ?? 0;
      toast(
        failed > 0 || invalid > 0
          ? `Saved with ${failed + invalid} issue${failed + invalid !== 1 ? "s" : ""} — see summary below.`
          : `Saved ${data.subjectsImported ?? 0} subject${(data.subjectsImported ?? 0) !== 1 ? "s" : ""} (${data.totalProcessed ?? 0} grades).`,
        failed > 0 || invalid > 0 ? "error" : "success",
      );
    } finally {
      setSaving(false);
    }
  }

  if (importResult) {
    return (
      <AttainmentPageShell>
        <div className="mx-auto max-w-3xl space-y-8">
          <AssessmentsBreadcrumb
            items={[
              { label: "Attainment", href: "/assessments" },
              { label: cycleLabel || "Cycle", href: `/assessments/${cycleId}` },
              { label: "Grades saved" },
            ]}
          />
          <PageHeader variant="ledger" eyebrow="Attainment" title="Grades saved" subtitle="Entries are being matched to students and results recomputed." />
          <Card className="space-y-5">
            <SectionHeader
              title={`${importResult.subjectsImported} subject${importResult.subjectsImported !== 1 ? "s" : ""} saved`}
              subtitle={`${importResult.totalProcessed} grade${importResult.totalProcessed !== 1 ? "s" : ""} recorded${importResult.totalFailed > 0 ? ` · ${importResult.totalFailed} rows could not be matched` : ""}${(importResult.parseErrors ?? 0) > 0 ? ` · ${importResult.parseErrors} invalid grade${(importResult.parseErrors ?? 0) !== 1 ? "s" : ""} skipped` : ""}`}
            />
            <div className="table-shell border-0 rounded-none shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="table-head-row text-left">
                      <th className="px-5 py-3.5">Subject</th>
                      <th className="px-4 py-3.5 text-right">Saved</th>
                      <th className="px-5 py-3.5 text-right">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.results.map((r) => (
                      <tr key={r.subject} className="table-row calm-transition">
                        <td className="px-5 py-3 font-medium">{r.subject}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--success)]">{r.rowsProcessed}</td>
                        <td className={`px-5 py-3 text-right tabular-nums ${r.rowsFailed > 0 ? "text-[var(--error)]" : "text-[var(--on-surface-muted)]"}`}>
                          {r.rowsFailed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => router.push(`/assessments/${cycleId}/points/${pointId}`)}>View analysis</Button>
              <Button variant="ghost" onClick={() => { setImportResult(null); setRoster(null); setGrid({}); }}>
                Enter more grades
              </Button>
              <Button variant="ghost" onClick={() => router.push(`/assessments/${cycleId}`)}>Back to cycle</Button>
            </div>
          </Card>
        </div>
      </AttainmentPageShell>
    );
  }

  if (isLocked) {
    return (
      <AttainmentPageShell>
        <div className="mx-auto max-w-3xl space-y-8">
          <AssessmentsBreadcrumb
            items={[
              { label: "Attainment", href: "/assessments" },
              { label: cycleLabel || "Cycle", href: `/assessments/${cycleId}` },
              { label: "Locked" },
            ]}
          />
          <PageHeader variant="ledger" eyebrow="Attainment" title="Result point locked" subtitle="This result point has been locked and cannot accept new entries." />
          <LockedPointBanner status="LOCKED" cycleId={cycleId} />
          <Button variant="ghost" onClick={() => router.push(`/assessments/${cycleId}`)}>← Back to cycle</Button>
        </div>
      </AttainmentPageShell>
    );
  }

  return (
    <AttainmentPageShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <AssessmentsBreadcrumb
          items={[
            { label: "Attainment", href: "/assessments" },
            { label: cycleLabel || "Cycle", href: `/assessments/${cycleId}` },
            { label: pointLabel ? `Enter grades — ${pointLabel}` : "Enter grades" },
          ]}
        />

        <PageHeader
          variant="ledger"
          eyebrow="Attainment"
          title="Enter grades directly"
          subtitle={
            pointYearGroup
              ? `Select which of this result point's subjects to grade, then type or paste grades straight from a spreadsheet — one row per student.`
              : "Pick a year group and subjects, then type or paste grades straight from a spreadsheet — one row per student."
          }
        />

        <Card className="space-y-5">
          <SectionHeader title="Set up the grid" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Year group</label>
              {pointYearGroup ? (
                <>
                  <p className="field flex w-full items-center bg-[var(--surface-container-low)] text-[var(--on-surface)]">
                    {pointYearGroup}
                  </p>
                  <p className="text-xs text-[var(--on-surface-muted)]">
                    Locked to this result point&apos;s existing cohort — grades are only entered for {pointYearGroup} students.
                  </p>
                </>
              ) : (
                <select
                  className="field w-full"
                  value={yearGroup}
                  onChange={(e) => setYearGroup(e.target.value)}
                  disabled={roster !== null}
                >
                  <option value="">Select a year group…</option>
                  {yearGroupOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--on-surface)]">Grade format</label>
              <select
                className="field w-full"
                value={gradeFormat}
                onChange={(e) => setGradeFormat(e.target.value as GradeFormat)}
                disabled={roster !== null}
              >
                {Object.entries(GRADE_FORMAT_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--on-surface)]">Subjects</label>

            {existingSubjects.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-[var(--on-surface-muted)]">Already on this result point — pick which to grade:</p>
                <div className="flex flex-wrap gap-1.5">
                  {existingSubjects.map((s) => {
                    const checked = checkedExistingSubjects.has(s);
                    return (
                      <label
                        key={s}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium calm-transition ${
                          checked
                            ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--on-surface)]"
                            : "border-border bg-[var(--surface-container-low)] text-[var(--on-surface-muted)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-[var(--accent)]"
                          checked={checked}
                          disabled={roster !== null}
                          onChange={() => toggleExistingSubject(s)}
                        />
                        {s}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {subjectChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {subjectChips.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-container-low)] px-2.5 py-1 text-xs font-medium text-[var(--on-surface)]"
                  >
                    {s}
                    {roster === null && (
                      <button
                        type="button"
                        onClick={() => removeSubjectChip(s)}
                        className="text-[var(--on-surface-muted)] hover:text-[var(--error)]"
                        aria-label={`Remove ${s}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {roster === null && (
              <>
                <input
                  className="field w-full"
                  list="subject-suggestions"
                  placeholder={existingSubjects.length > 0 ? "Add another subject to this result point (optional)" : "Type a subject and press Enter (pick from the list to keep names consistent)"}
                  value={subjectInputValue}
                  onChange={(e) => setSubjectInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addSubjectChip(subjectInputValue);
                    }
                  }}
                  onBlur={() => addSubjectChip(subjectInputValue)}
                />
                <datalist id="subject-suggestions">
                  {subjectSuggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
              </>
            )}
          </div>

          {error && <p className="text-sm text-[var(--error)]">{error}</p>}

          {roster === null ? (
            <Button onClick={loadRoster} disabled={loadingRoster}>
              {loadingRoster ? "Loading students…" : "Load students →"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => { setRoster(null); setGrid({}); setImportResult(null); }}>
              {pointYearGroup ? "← Change subjects" : "← Change year group / subjects"}
            </Button>
          )}
        </Card>

        {roster !== null && (
          <Card className="space-y-4">
            <SectionHeader
              title={`${roster.length} student${roster.length !== 1 ? "s" : ""} — ${yearGroup}`}
              subtitle={`Click a cell and type, or copy a block of grades from a spreadsheet and paste into the first cell. ${filledCellCount} of ${roster.length * effectiveSubjects.length} cells filled.`}
            />
            <div className="table-shell border-0 rounded-none shadow-none">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="table-head-row">
                      <th className="sticky left-0 z-10 min-w-[140px] bg-[var(--surface-container-low)] px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSort("upn")}
                          className="inline-flex items-center gap-1 font-semibold hover:text-[var(--on-surface)]"
                        >
                          UPN
                          {sortKey === "upn" && <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>}
                        </button>
                      </th>
                      <th className="sticky left-[140px] z-10 min-w-[200px] bg-[var(--surface-container-low)] px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSort("name")}
                          className="inline-flex items-center gap-1 font-semibold hover:text-[var(--on-surface)]"
                        >
                          Student
                          {sortKey === "name" && <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span>}
                        </button>
                      </th>
                      {effectiveSubjects.map((subject) => (
                        <th key={subject} className="min-w-[120px] px-3 py-2.5 text-center">{subject}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRoster!.map((student, rowIdx) => (
                      <tr key={student.id} className="table-row">
                        <td className="sticky left-0 z-10 bg-[var(--surface-container-lowest)] px-4 py-2 text-[var(--on-surface-muted)] tabular-nums">
                          {student.upn ?? "—"}
                        </td>
                        <td className="sticky left-[140px] z-10 bg-[var(--surface-container-lowest)] px-4 py-2 font-medium text-[var(--on-surface)]">
                          {student.fullName}
                        </td>
                        {effectiveSubjects.map((subject, colIdx) => {
                          const cellKey = `${rowIdx}-${colIdx}`;
                          return (
                            <td key={subject} className="px-1.5 py-1">
                              <input
                                ref={(el) => { inputRefs.current[cellKey] = el; }}
                                className="field h-9 w-full min-w-[80px] text-center text-sm tabular-nums"
                                value={grid[student.id]?.[subject] ?? ""}
                                onChange={(e) => setCell(student.id, subject, e.target.value)}
                                onPaste={(e) => handlePaste(e, rowIdx, colIdx)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving || filledCellCount === 0}>
                {saving ? "Saving…" : `Save ${filledCellCount} grade${filledCellCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AttainmentPageShell>
  );
}
