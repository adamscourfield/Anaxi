"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SUBJECT_STAGES, SUBJECT_STAGE_LABELS, type SubjectStage } from "@/lib/subjectStages";

export type SubjectRow = {
  id: string;
  name: string;
  stages: string[];
  active: boolean;
};

const CARD =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

const FIELD =
  "min-h-[2.5rem] w-full min-w-0 flex-1 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3.5 text-sm text-[var(--on-surface)] outline-none transition placeholder:text-[var(--on-surface-variant)] focus:border-[color-mix(in_srgb,var(--outline-variant)_50%,transparent)] focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]";

function GripIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="7" r="1.25" />
      <circle cx="15" cy="7" r="1.25" />
      <circle cx="9" cy="12" r="1.25" />
      <circle cx="15" cy="12" r="1.25" />
      <circle cx="9" cy="17" r="1.25" />
      <circle cx="15" cy="17" r="1.25" />
    </svg>
  );
}

function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="6" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="18" r="1.5" />
    </svg>
  );
}

function StageCheckboxes({ defaultStages, name = "stages" }: { defaultStages: string[]; name?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[0.75rem] text-[var(--on-surface-variant)]">
      {SUBJECT_STAGES.map((stage) => (
        <label key={stage} className="inline-flex items-center gap-1.5">
          <input type="checkbox" name={name} value={stage} defaultChecked={defaultStages.includes(stage)} />
          {SUBJECT_STAGE_LABELS[stage]}
        </label>
      ))}
    </div>
  );
}

function stageBadges(stages: string[]) {
  if (stages.length === 0) {
    return (
      <span className="inline-flex rounded-md bg-[var(--surface-container-low)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--on-surface-variant)]">
        All stages
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {stages.map((s) => (
        <span
          key={s}
          className="inline-flex rounded-md bg-[var(--surface-container-low)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--on-surface)]"
        >
          {SUBJECT_STAGE_LABELS[s as SubjectStage] ?? s}
        </span>
      ))}
    </div>
  );
}

export function SubjectsAdminView({
  rows: initialRows,
  addSubject,
  saveSubjects,
  deleteSubject,
  reorderSubjects,
}: {
  rows: SubjectRow[];
  addSubject: (formData: FormData) => Promise<void>;
  saveSubjects: (formData: FormData) => Promise<void>;
  deleteSubject: (formData: FormData) => Promise<void>;
  reorderSubjects: (formData: FormData) => Promise<void>;
}) {
  const [rows, setRows] = useState<SubjectRow[]>(initialRows);
  const [dragId, setDragId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const activeCount = useMemo(() => rows.filter((r) => r.active).length, [rows]);
  const inactiveCount = rows.length - activeCount;

  async function persistOrder(order: SubjectRow[]) {
    const fd = new FormData();
    fd.set("orderedIds", order.map((r) => r.id).join(","));
    await reorderSubjects(fd);
  }

  function handleDragEnter(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.id === dragId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function handleDragEnd() {
    if (dragId) {
      await persistOrder(rowsRef.current);
    }
    setDragId(null);
  }

  return (
    <div className={CARD}>
      <div className="flex flex-col gap-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-[var(--on-surface)]">Subjects</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--on-surface-variant)]">
            The subject names used across attainment uploads and grade entry. Tick the key stages each
            one applies to so it&rsquo;s only suggested where relevant; leave all unticked for every stage.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#ECFDF5] px-2.5 py-1 text-[0.6875rem] font-semibold text-[#166534]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
            {activeCount} active
          </span>
          {inactiveCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-container-low)] px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--on-surface-variant)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9CA3AF]" />
              {inactiveCount} inactive
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-6 pb-7 pt-5 sm:px-8">
        {rows.length === 0 ? (
          <EmptyState
            mode="embedded"
            title="No subjects yet"
            description="Add your subjects below. Attainment uploads and grade entry will suggest exactly these names, so spelling stays consistent across cycles."
          />
        ) : (
          <form action={saveSubjects}>
          <div className="overflow-x-auto rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)]">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-low)]">
                  <th className="w-10 px-2 py-3 sm:w-12" aria-hidden />
                  <th className="px-4 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">Subject</th>
                  <th className="w-[120px] px-4 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">Active</th>
                  <th className="w-14 px-4 py-3" aria-label="More actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  return (
                    <tr key={row.id} className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] last:border-b-0" onDragEnter={() => handleDragEnter(row.id)}>
                      <td className="align-middle px-2 py-4">
                        <button
                          type="button"
                          draggable
                          onDragStart={() => setDragId(row.id)}
                          onDragEnd={() => void handleDragEnd()}
                          className="flex h-9 w-9 cursor-grab items-center justify-center rounded-lg text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)] active:cursor-grabbing"
                          title="Drag to reorder"
                          aria-label="Drag to reorder"
                        >
                          <GripIcon className="h-5 w-5" />
                        </button>
                      </td>
                      <td className="min-w-0 px-4 py-4 align-middle">
                        <div className="flex min-w-0 flex-col gap-2">
                          <input type="hidden" name="rowId" value={row.id} />
                          <input name={`name_${row.id}`} defaultValue={row.name} aria-label="Subject name" className={FIELD} required />
                          <StageCheckboxes defaultStages={row.stages} name={`stages_${row.id}`} />
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <label className="inline-flex items-center gap-2 text-[0.8125rem] text-[var(--on-surface)]">
                          <input type="checkbox" name={`active_${row.id}`} defaultChecked={row.active} />
                          Active
                        </label>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right align-middle">
                        <div className="inline-flex items-center justify-end">
                          <div className="relative inline-block" ref={menuOpenId === row.id ? menuRef : undefined}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId((id) => (id === row.id ? null : row.id));
                              }}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] calm-transition hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface)]"
                              aria-expanded={menuOpenId === row.id}
                              aria-haspopup="menu"
                              title="More actions"
                            >
                              <MoreVerticalIcon className="h-5 w-5" />
                            </button>
                            {menuOpenId === row.id ? (
                              <div
                                className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-sm border border-border bg-[var(--surface-container-lowest)] py-1 shadow-none"
                                role="menu"
                              >
                                {/* Inside the table's form, so it sends its own payload rather than every row's fields. */}
                                <button
                                  type="submit"
                                  formAction={async () => {
                                    const fd = new FormData();
                                    fd.set("id", row.id);
                                    await deleteSubject(fd);
                                  }}
                                  formNoValidate
                                  className="flex w-full px-3 py-2 text-left text-[0.8125rem] font-medium text-error hover:bg-error/10"
                                  role="menuitem"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="submit">Save changes</Button>
            <span className="text-[0.75rem] text-[var(--on-surface-variant)]">Saves names, key stages and active status for every subject. Drag rows to reorder; order saves straight away.</span>
          </div>
          </form>
        )}

        <div className="mt-6 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-low)] p-5 sm:p-6">
          <h3 className="text-[0.9375rem] font-bold text-[var(--on-surface)]">Add subject</h3>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--on-surface-variant)]">
            New subjects are active by default and apply to all stages unless you tag them.
          </p>
          <form action={addSubject} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="mb-1.5 block text-[0.8125rem] font-semibold text-[var(--on-surface)]">Subject name</span>
                <input name="name" className={FIELD} placeholder="e.g. Combined Science" required autoComplete="off" />
              </label>
              <button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--on-surface)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm calm-transition hover:bg-[var(--primary-container)]"
              >
                Add
              </button>
            </div>
            <StageCheckboxes defaultStages={[]} />
          </form>
        </div>
      </div>
    </div>
  );
}
