"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TenantSchoolType } from "@/lib/tenantSchoolType";
import { getSignalsForPhase } from "@/modules/observations/getSignalsBySchoolType";
import {
  clearDraft,
  emptyDraft,
  guessYearGroup,
  loadDraft,
  persistDraft,
  todayInSchoolZone,
  yearGroupOptions,
  type ObservationDraft,
  type Phase,
} from "./observationDraft";
import styles from "./flow.module.css";

type Teacher = { id: string; fullName: string; email: string };
type Department = { id: string; name: string };

type PhaseOption = { key: Phase; label: string; body: string };

function phaseOptions(schoolType: TenantSchoolType): PhaseOption[] {
  const start: PhaseOption =
    schoolType === "PRIMARY"
      ? { key: "TRANSITION_START", label: "Transition or start", body: "Coming in, settling and the first minutes." }
      : { key: "THRESHOLD", label: "Threshold", body: "Entry, the do now and the first minutes." };
  return [
    start,
    { key: "INSTRUCTION", label: "Instruction", body: "The teacher is explaining or modelling." },
    { key: "GUIDED_PRACTICE", label: "Guided practice", body: "Students practise with the teacher close by." },
    { key: "INDEPENDENT_PRACTICE", label: "Independent practice", body: "Students work on their own." },
    { key: "UNKNOWN", label: "Several or not sure", body: "Rate every classroom signal." },
    { key: "BOOKS", label: "Book look", body: "Reviewing work in books, not a lesson." },
  ];
}

export function ObservationContextForm({
  teachers,
  departments,
  draftKey,
  signalKeys,
  schoolType,
}: {
  teachers: Teacher[];
  departments: Department[];
  draftKey: string;
  signalKeys: string[];
  schoolType: TenantSchoolType;
}) {
  const router = useRouter();
  const phases = useMemo(() => phaseOptions(schoolType), [schoolType]);
  const years = useMemo(() => yearGroupOptions(schoolType), [schoolType]);
  const [draft, setDraft] = useState<ObservationDraft>(() => emptyDraft(signalKeys));
  const [loaded, setLoaded] = useState(false);
  const [yearTouched, setYearTouched] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const context = draft.context;

  // The draft lives in sessionStorage, so read it after mount to keep hydration stable.
  useEffect(() => {
    const stored = loadDraft(draftKey, signalKeys);
    let phase = stored.context.phase;
    if (schoolType === "PRIMARY" && phase === "THRESHOLD") phase = "TRANSITION_START";
    if (schoolType === "SECONDARY" && phase === "TRANSITION_START") phase = "THRESHOLD";
    const subjectDept = departments.find((d) => d.id === stored.context.department);
    setDraft({
      ...stored,
      context: {
        ...stored.context,
        phase,
        observedAt: stored.context.observedAt || todayInSchoolZone(),
        // Drop a department that has since been deleted.
        department: subjectDept ? subjectDept.id : "",
        subject: subjectDept ? subjectDept.name : "",
        // Older drafts stored free text here; keep it only if it is a real option.
        yearGroup: years.some((y) => y.value === stored.context.yearGroup) ? stored.context.yearGroup : "",
      },
    });
    setYearTouched(Boolean(stored.context.yearGroup));
    setLoaded(true);
  }, [draftKey, signalKeys, schoolType, departments, years]);

  const update = (patch: Partial<ObservationDraft["context"]>) =>
    setDraft((d) => ({ ...d, context: { ...d.context, ...patch } }));

  const teacherOptions = useMemo(
    () => teachers.map((t) => ({ value: t.id, label: t.fullName, detail: t.email })),
    [teachers],
  );
  const departmentOptions = useMemo(() => departments.map((d) => ({ value: d.id, label: d.name })), [departments]);
  const signalCounts = useMemo(
    () => Object.fromEntries(phases.map((p) => [p.key, getSignalsForPhase(p.key, schoolType).length])),
    [phases, schoolType],
  );

  const today = loaded ? todayInSchoolZone() : "";
  const errors = {
    teacherId: !context.teacherId ? "Choose who you observed." : null,
    department: !context.department ? "Choose a department." : null,
    classCode: !context.classCode.trim() ? "Enter the class or set." : null,
    yearGroup: !context.yearGroup ? "Choose a year group." : null,
    observedAt: !context.observedAt
      ? "Enter a date."
      : today && context.observedAt > today
        ? "The date can't be in the future."
        : null,
  };
  const valid = Object.values(errors).every((e) => e === null);
  const hasRatings = Object.values(draft.signalState).some((s) => s.valueKey || s.notObserved);

  const next = () => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    persistDraft(draftKey, { ...draft, context: { ...context, classCode: context.classCode.trim() } });
    router.push("/observe/new/signals");
  };

  const discard = () => {
    clearDraft(draftKey);
    router.push("/observe/history");
  };

  const fieldError = (msg: string | null) =>
    showErrors && msg ? <span className="mt-1 block text-[13px] text-[var(--pill-error-text)]">{msg}</span> : null;

  if (!loaded) return <div className={`${styles.card} h-[560px]`} aria-busy />;

  return (
    <form
      className={`${styles.card} p-6 sm:p-7`}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className={styles.label} id="obs-teacher-label">
            Who are you observing?
          </span>
          <SearchableSelect
            options={teacherOptions}
            value={context.teacherId}
            onChange={(value) => update({ teacherId: value })}
            ariaLabel="Who are you observing?"
            placeholder="Search staff"
            searchPlaceholder="Search by name or email"
          />
          {fieldError(errors.teacherId)}
        </div>

        <div>
          <span className={styles.label}>Department</span>
          <SearchableSelect
            options={departmentOptions}
            value={context.department}
            onChange={(value) => {
              const dept = departments.find((d) => d.id === value);
              update({ department: value, subject: dept?.name ?? "" });
            }}
            ariaLabel="Department"
            placeholder="Choose a department"
            searchPlaceholder="Search departments"
          />
          {fieldError(errors.department)}
        </div>

        <label className="block">
          <span className={styles.label}>Date</span>
          <input
            type="date"
            className={styles.input}
            value={context.observedAt}
            max={today || undefined}
            onChange={(e) => update({ observedAt: e.target.value })}
          />
          {fieldError(errors.observedAt)}
        </label>

        <label className="block">
          <span className={styles.label}>Class or set</span>
          <input
            className={styles.input}
            placeholder="e.g. 10A/Ma1"
            value={context.classCode}
            autoComplete="off"
            onChange={(e) => {
              const classCode = e.target.value;
              const guess = guessYearGroup(classCode, schoolType);
              update(yearTouched ? { classCode } : { classCode, yearGroup: guess });
            }}
          />
          {fieldError(errors.classCode)}
        </label>

        <label className="block">
          <span className={styles.label}>Year group</span>
          <select
            className={styles.input}
            value={context.yearGroup}
            onChange={(e) => {
              setYearTouched(true);
              update({ yearGroup: e.target.value });
            }}
          >
            <option value="">Choose a year</option>
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
          {fieldError(errors.yearGroup)}
        </label>
      </div>

      <fieldset className="mt-7">
        <legend className={styles.label}>What part of the lesson did you see?</legend>
        <div className={`${styles.choices} grid-cols-1 sm:grid-cols-2`} role="radiogroup">
          {phases.map((phase) => {
            const selected = context.phase === phase.key;
            return (
              <button
                key={phase.key}
                type="button"
                role="radio"
                aria-checked={selected}
                data-observation-phase
                className={styles.choice}
                onClick={() => update({ phase: phase.key })}
              >
                <span className={styles.choiceTitle}>
                  <span>{phase.label}</span>
                  <span className={styles.radio} aria-hidden />
                </span>
                <span className={styles.choiceBody}>
                  {phase.body} {signalCounts[phase.key]} signals.
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className={`${styles.footer} mt-7 border-t border-[#efeff0] pt-5`}>
        {hasRatings ? (
          <Button type="button" variant="ghost" className="h-10 min-h-0 px-4" onClick={() => setConfirmDiscard(true)}>
            Discard observation
          </Button>
        ) : (
          <Button asChild variant="ghost" className="h-10 min-h-0 px-4">
            <Link href="/observe/history" onClick={() => clearDraft(draftKey)}>
              Cancel
            </Link>
          </Button>
        )}
        <Button type="submit" className="h-10 min-h-0 px-5">
          {hasRatings ? "Back to signals" : "Start rating"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this observation?"
        confirmLabel="Discard"
        variant="danger"
        onClose={() => setConfirmDiscard(false)}
        onConfirm={discard}
      >
        The ratings you have entered will be lost.
      </ConfirmDialog>
    </form>
  );
}
