"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export type TaxonomyRow = { id: string; value: string; active: boolean };

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

function SaveDiskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17 21 17 13 7 13 7 21" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7 3 7 8 15 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
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
  updateItem,
  toggleActive,
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
  updateItem: (formData: FormData) => Promise<void>;
  toggleActive: (formData: FormData) => Promise<void>;
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
  const existingEmails = useMemo(() => new Set(rows.map((r) => r.value.toLowerCase())), [rows]);

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
          <div className="overflow-x-auto rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)]">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-low)]">
                  <th className="w-10 px-2 py-3 sm:w-12" aria-hidden />
                  <th className="px-4 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">{valueColumnHeader}</th>
                  <th className="w-[120px] px-4 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">Status</th>
                  <th className="min-w-[240px] px-4 py-3 text-right text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const formId = `tax-update-${type}-${row.id}`;
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
                        <form id={formId} action={updateItem} className="flex min-w-0 items-center gap-2">
                          <input type="hidden" name="type" value={type} />
                          <input type="hidden" name="id" value={row.id} />
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--surface-container)]" aria-hidden />
                          {field === "email" ? <EnvelopeIcon className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" /> : null}
                          <input name="label" defaultValue={row.value} aria-label={valueInputLabel} className={FIELD} required />
                        </form>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span
                          className={`inline-flex rounded-md px-2.5 py-1 text-[0.6875rem] font-semibold ${
                            row.active ? "bg-[#ECFDF5] text-[#166534]" : "bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]"
                          }`}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right align-middle">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="submit"
                            form={formId}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3 py-2 text-[0.8125rem] font-semibold text-[var(--on-surface)] shadow-sm calm-transition hover:bg-[var(--surface-container-low)]"
                          >
                            <SaveDiskIcon className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" />
                            Save
                          </button>
                          <form action={toggleActive} className="inline">
                            <input type="hidden" name="type" value={type} />
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="active" value={String(row.active)} />
                            <button
                              type="submit"
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[0.8125rem] font-semibold calm-transition ${
                                row.active
                                  ? "border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
                                  : "border-[#86EFAC] bg-[#ECFDF5] text-[#166534] hover:bg-[#D1FAE5]"
                              }`}
                            >
                              <CheckCircleIcon className="h-4 w-4 shrink-0" />
                              {row.active ? "Deactivate" : "Activate"}
                            </button>
                          </form>
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
                                <form action={deleteItem}>
                                  <input type="hidden" name="type" value={type} />
                                  <input type="hidden" name="id" value={row.id} />
                                  <button
                                    type="submit"
                                    className="flex w-full px-3 py-2 text-left text-[0.8125rem] font-medium text-error hover:bg-error/10"
                                    role="menuitem"
                                  >
                                    Delete
                                  </button>
                                </form>
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
                    .filter((s) => !existingEmails.has(s.email.toLowerCase()))
                    .map((s) => (
                      <option value={s.email} key={s.id}>
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
