"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export type TaxonomyRow = {
  id: string;
  value: string;
  active: boolean;
  /** Recipient rows only: the underlying staff user. */
  userId?: string;
  /** Recipient rows only: which on-call request types this user is notified for. */
  notifiesBehaviour?: boolean;
  notifiesFirstAid?: boolean;
  /** LOA reason rows only: whether this reason triggers the medical-evidence requirement. */
  requiresMedicalEvidence?: boolean;
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

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
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

export type StaffOption = { id: string; fullName: string; email: string };

export function TaxonomyEditableSection({
  title,
  description,
  type,
  field,
  rows: initialRows,
  valueColumnHeader,
  addItemNoun,
  staffOptions,
  saveItems,
  deleteItem,
  reorderTaxonomy,
  addItem,
}: {
  title: string;
  description: string;
  type: "loa" | "reason" | "location" | "recipient";
  field: "label" | "email";
  rows: TaxonomyRow[];
  valueColumnHeader: string;
  addItemNoun: string;
  staffOptions?: StaffOption[];
  saveItems: (formData: FormData) => Promise<void>;
  deleteItem: (formData: FormData) => Promise<void>;
  reorderTaxonomy: (formData: FormData) => Promise<void>;
  addItem: (formData: FormData) => Promise<void>;
}) {
  const [rows, setRows] = useState<TaxonomyRow[]>(initialRows);
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
  const existingUserIds = useMemo(() => new Set(rows.map((r) => r.userId).filter(Boolean)), [rows]);

  async function persistOrder(order: TaxonomyRow[]) {
    const fd = new FormData();
    fd.set("type", type);
    fd.set("orderedIds", order.map((r) => r.id).join(","));
    await reorderTaxonomy(fd);
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

  const valueInputLabel = field === "email" ? "Email address" : valueColumnHeader;

  return (
    <div className={CARD}>
      <div className="flex flex-col gap-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-[var(--on-surface)]">{title}</h2>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--on-surface-variant)]">{description}</p>
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
            title={`No ${title.toLowerCase()} yet`}
            description="Add an entry below. Inactive items stay in the list but are hidden from staff when they choose a reason or location."
          />
        ) : (
          <form action={saveItems}>
            <input type="hidden" name="type" value={type} />
            <div className="overflow-x-auto rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)]">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-low)]">
                    <th className="w-10 px-2 py-3 sm:w-12" aria-hidden />
                    <th className="px-4 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">{valueColumnHeader}</th>
                    <th className="w-[110px] px-4 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">Status</th>
                    <th className="w-14 px-4 py-3" aria-label="More actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
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
                          <div className="flex min-w-0 items-center gap-2">
                            {field === "email" ? <EnvelopeIcon className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" /> : null}
                            {type === "recipient" ? (
                              <span className="min-w-0 truncate text-sm text-[var(--on-surface)]" title={row.value}>
                                {row.value}
                              </span>
                            ) : (
                              <input name={`label_${row.id}`} defaultValue={row.value} aria-label={valueInputLabel} className={FIELD} required />
                            )}
                          </div>
                          {type === "recipient" ? (
                            <div className="flex flex-wrap items-center gap-3 text-[0.75rem] text-[var(--on-surface-variant)]">
                              <label className="inline-flex items-center gap-1.5">
                                <input type="checkbox" name={`notifiesBehaviour_${row.id}`} defaultChecked={row.notifiesBehaviour !== false} />
                                Behaviour
                              </label>
                              <label className="inline-flex items-center gap-1.5">
                                <input type="checkbox" name={`notifiesFirstAid_${row.id}`} defaultChecked={row.notifiesFirstAid !== false} />
                                First aid
                              </label>
                            </div>
                          ) : null}
                          {type === "loa" ? (
                            <label className="inline-flex items-center gap-1.5 text-[0.75rem] text-[var(--on-surface-variant)]">
                              <input type="checkbox" name={`requiresMedicalEvidence_${row.id}`} defaultChecked={row.requiresMedicalEvidence === true} />
                              Requires medical evidence for longer absences
                            </label>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <label className="inline-flex items-center gap-2 text-[0.8125rem] text-[var(--on-surface)]">
                          <input type="checkbox" name={`active_${row.id}`} defaultChecked={row.active} />
                          Active
                        </label>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right align-middle">
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
                              {/* Inside the list's form, so it sends its own payload rather than every row's fields. */}
                              <button
                                type="submit"
                                formAction={async () => {
                                  const fd = new FormData();
                                  fd.set("type", type);
                                  fd.set("id", row.id);
                                  await deleteItem(fd);
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit">Save changes</Button>
              <span className="text-[0.75rem] text-[var(--on-surface-variant)]">Saves every row in this list. Drag rows to reorder; order saves straight away.</span>
            </div>
          </form>
        )}

        <div className="mt-6 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-low)] p-5 sm:p-6">
          <h3 className="text-[0.9375rem] font-bold text-[var(--on-surface)]">Add {addItemNoun}</h3>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--on-surface-variant)]">
            New entries are active by default. You can deactivate them anytime without deleting history.
          </p>
          <form action={addItem} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="type" value={type} />
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-[0.8125rem] font-semibold text-[var(--on-surface)]">
                {field === "email" ? "Staff member" : valueColumnHeader}
              </span>
              {field === "email" && staffOptions ? (
                <select name="value" className={FIELD} required defaultValue="">
                  <option value="" disabled>
                    Choose someone…
                  </option>
                  {staffOptions
                    .filter((s) => !existingUserIds.has(s.id))
                    .map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.fullName} ({s.email})
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  name="value"
                  className={FIELD}
                  placeholder={field === "email" ? "name@school.org" : `e.g. Annual leave`}
                  required
                  autoComplete={field === "email" ? "email" : "off"}
                />
              )}
            </label>
            {type === "recipient" ? (
              <div className="flex flex-wrap items-center gap-3 text-[0.8125rem] font-medium text-[var(--on-surface)] sm:pb-2.5">
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" name="notifiesBehaviour" defaultChecked />
                  Behaviour
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" name="notifiesFirstAid" defaultChecked />
                  First aid
                </label>
              </div>
            ) : null}
            {type === "loa" ? (
              <div className="flex flex-wrap items-center gap-3 text-[0.8125rem] font-medium text-[var(--on-surface)] sm:pb-2.5">
                <label className="inline-flex items-center gap-1.5">
                  <input type="checkbox" name="requiresMedicalEvidence" />
                  Requires medical evidence
                </label>
              </div>
            ) : null}
            <button
              type="submit"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--on-surface)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm calm-transition hover:bg-[var(--primary-container)]"
            >
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
