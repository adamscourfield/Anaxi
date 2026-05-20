"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/typography";
import { TaxonomyTabsShell } from "@/components/admin/taxonomy-tabs-shell";
import {
  LEAVE_TAXONOMY_TABS,
  ON_CALL_TAXONOMY_TABS,
  TAB_LABELS,
  TAB_META,
  TAXONOMY_AUTH_CARD,
  TAXONOMY_ICON_WELL_BASE,
  TAXONOMY_NAV_CARD,
  TAXONOMY_TABS,
  type TaxonomyTab,
} from "@/components/admin/taxonomy-tab-meta";
import { TaxonomyEditableSection, type TaxonomyRow } from "@/app/(tenant)/admin/taxonomies/TaxonomyEditableSection";

type StaffOption = { id: string; fullName: string; email: string };

type GlobalAuthoriser = {
  id: string;
  userId: string;
  user: { fullName: string; email: string } | null;
};

type ScopedTarget = {
  id: string;
  targetUserId: string;
  targetUser: { fullName: string } | null;
};

type ScopedApproverGroup = {
  approverId: string;
  approver: { fullName: string; email: string } | null;
  targets: ScopedTarget[];
};

type TaxonomyActions = {
  addItem: (formData: FormData) => Promise<void>;
  updateItem: (formData: FormData) => Promise<void>;
  toggleActive: (formData: FormData) => Promise<void>;
  deleteItem: (formData: FormData) => Promise<void>;
  reorderTaxonomy: (formData: FormData) => Promise<void>;
  removeAuthoriser: (formData: FormData) => Promise<void>;
  addScopedAuthoriser: (formData: FormData) => Promise<void>;
  removeScopedTarget: (formData: FormData) => Promise<void>;
  removeScopedAuthoriser: (formData: FormData) => Promise<void>;
};

export function TaxonomiesAdminView({
  initialTab,
  loaRows,
  reasonRows,
  locationRows,
  recipientRows,
  loaAuthorisers,
  scopedGroups,
  staff,
  globalAuthoriserIds,
  scopedApproverIds,
  actions,
}: {
  initialTab: TaxonomyTab;
  loaRows: TaxonomyRow[];
  reasonRows: TaxonomyRow[];
  locationRows: TaxonomyRow[];
  recipientRows: TaxonomyRow[];
  loaAuthorisers: GlobalAuthoriser[];
  scopedGroups: ScopedApproverGroup[];
  staff: StaffOption[];
  globalAuthoriserIds: string[];
  scopedApproverIds: string[];
  actions: TaxonomyActions;
}) {
  const safeInitial = TAXONOMY_TABS.includes(initialTab) ? initialTab : "loa-reasons";
  const [tab, setTab] = useState<TaxonomyTab>(safeInitial);

  const globalAuthoriserSet = new Set(globalAuthoriserIds);
  const scopedApproverSet = new Set(scopedApproverIds);

  const tabTile = (value: TaxonomyTab) => {
    const meta = TAB_META[value];
    const active = tab === value;
    return (
      <button
        type="button"
        key={value}
        onClick={() => setTab(value)}
        className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left calm-transition ${
          active
            ? "border-[#3B82F6] bg-[color-mix(in_srgb,var(--info)_08%,var(--surface-container-lowest))] shadow-sm"
            : "border-transparent hover:bg-[var(--surface-container-low)]"
        }`}
      >
        <span
          className={`${TAXONOMY_ICON_WELL_BASE} ${
            active
              ? "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]"
              : "border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-low)] text-[var(--on-surface-variant)]"
          }`}
        >
          {meta.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-bold text-[var(--on-surface)]">{meta.label}</span>
          <span className="mt-0.5 block text-[0.75rem] text-[var(--on-surface-variant)]">Manage…</span>
        </span>
      </button>
    );
  };

  return (
    <TaxonomyTabsShell tabs={TAXONOMY_TABS} activeTab={tab} onTabChange={(t) => setTab(t as TaxonomyTab)} labels={TAB_LABELS}>
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        <div className={TAXONOMY_NAV_CARD}>
          <p className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-5 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
            Leave of absence
          </p>
          <nav className="flex flex-col divide-y divide-[#E5E7EB] p-2" aria-label="Leave taxonomy sections">
            {LEAVE_TAXONOMY_TABS.map((t) => tabTile(t))}
          </nav>
        </div>
        <div className={TAXONOMY_NAV_CARD}>
          <p className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-5 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
            On call
          </p>
          <nav className="flex flex-col divide-y divide-[#E5E7EB] p-2" aria-label="On-call taxonomy sections">
            {ON_CALL_TAXONOMY_TABS.map((t) => tabTile(t))}
          </nav>
        </div>
      </div>

      {tab === "loa-reasons" ? (
        <TaxonomyEditableSection
          title="LOA Reasons"
          description={TAB_META["loa-reasons"].description}
          type="loa"
          field="label"
          rows={loaRows}
          valueColumnHeader="Reason"
          addItemNoun="reason"
          updateItem={actions.updateItem}
          toggleActive={actions.toggleActive}
          deleteItem={actions.deleteItem}
          reorderTaxonomy={actions.reorderTaxonomy}
          addItem={actions.addItem}
        />
      ) : null}

      {tab === "on-call-reasons" ? (
        <TaxonomyEditableSection
          title="On Call Reasons"
          description={TAB_META["on-call-reasons"].description}
          type="reason"
          field="label"
          rows={reasonRows}
          valueColumnHeader="Reason"
          addItemNoun="reason"
          updateItem={actions.updateItem}
          toggleActive={actions.toggleActive}
          deleteItem={actions.deleteItem}
          reorderTaxonomy={actions.reorderTaxonomy}
          addItem={actions.addItem}
        />
      ) : null}

      {tab === "on-call-locations" ? (
        <TaxonomyEditableSection
          title="On Call Locations"
          description={TAB_META["on-call-locations"].description}
          type="location"
          field="label"
          rows={locationRows}
          valueColumnHeader="Location"
          addItemNoun="location"
          updateItem={actions.updateItem}
          toggleActive={actions.toggleActive}
          deleteItem={actions.deleteItem}
          reorderTaxonomy={actions.reorderTaxonomy}
          addItem={actions.addItem}
        />
      ) : null}

      {tab === "on-call-recipients" ? (
        <TaxonomyEditableSection
          title="On Call Recipients"
          description={TAB_META["on-call-recipients"].description}
          type="recipient"
          field="email"
          rows={recipientRows}
          valueColumnHeader="Email"
          addItemNoun="recipient"
          updateItem={actions.updateItem}
          toggleActive={actions.toggleActive}
          deleteItem={actions.deleteItem}
          reorderTaxonomy={actions.reorderTaxonomy}
          addItem={actions.addItem}
        />
      ) : null}

      {tab === "loa-authorisers" ? (
        <div className="space-y-6">
          <div className={TAXONOMY_AUTH_CARD}>
            <div className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-5 py-5 sm:px-7 sm:py-6">
              <h2 className="text-lg font-bold tracking-tight text-[var(--on-surface)]">Global authorisers</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--on-surface-variant)]">
                Can approve or deny leave for any staff member. Use this for senior leaders or HR.
              </p>
            </div>
            <div className="space-y-2 px-5 pb-6 pt-4 sm:px-7">
              {loaAuthorisers.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={row.user?.fullName ?? "?"} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--on-surface)]">{row.user?.fullName}</p>
                      <p className="truncate text-xs text-[var(--on-surface-variant)]">{row.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#ECFDF5] px-2.5 py-1 text-xs font-semibold text-[#166534]">
                      <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M5 8.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      All staff
                    </span>
                    <form action={actions.removeAuthoriser}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button variant="ghost" type="submit" className="py-2 text-xs text-[var(--on-surface-variant)] hover:text-red-600">
                        Remove
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
              {loaAuthorisers.length === 0 ? (
                <EmptyState
                  mode="embedded"
                  title="No global authorisers"
                  description="Add at least one person if you want school-wide approvers outside of group rules."
                />
              ) : null}
            </div>

            <div className="mx-5 mb-6 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-low)] p-5 sm:mx-7">
              <h3 className="text-[0.9375rem] font-bold text-[var(--on-surface)]">Add global authoriser</h3>
              <p className="mt-1 text-[0.8125rem] text-[var(--on-surface-variant)]">
                Staff already listed as scoped-only approvers are excluded until you remove that role.
              </p>
              <form action={actions.addItem} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="type" value="loa_authoriser" />
                <div className="min-w-0 flex-1">
                  <Label htmlFor="global-auth-staff">Staff member</Label>
                  <select
                    id="global-auth-staff"
                    name="value"
                    className="mt-1 min-h-[2.75rem] w-full rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3 text-sm text-[var(--on-surface)] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
                    required
                  >
                    <option value="">Choose someone…</option>
                    {staff
                      .filter((s) => !globalAuthoriserSet.has(s.id) && !scopedApproverSet.has(s.id))
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.fullName} ({s.email})
                        </option>
                      ))}
                  </select>
                </div>
                <Button type="submit" className="w-full shrink-0 rounded-xl sm:w-auto">
                  Add
                </Button>
              </form>
            </div>
          </div>

          <div className={TAXONOMY_AUTH_CARD}>
            <div className="border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-5 py-5 sm:px-7 sm:py-6">
              <h2 className="text-lg font-bold tracking-tight text-[var(--on-surface)]">Scoped authorisers</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[var(--on-surface-variant)]">
                Each person here only sees leave requests from the colleagues you attach. Good for line managers.
              </p>
            </div>

            <div className="space-y-4 px-5 pb-6 pt-4 sm:px-7">
              {scopedGroups.map(({ approverId, approver, targets }) => (
                <div
                  key={approverId}
                  className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)]"
                >
                  <div className="flex flex-col gap-3 border-b border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={approver?.fullName ?? "?"} size="md" />
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--on-surface)]">{approver?.fullName}</p>
                        <p className="truncate text-xs text-[var(--on-surface-variant)]">{approver?.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#92400E]">
                        {targets.length} {targets.length === 1 ? "person" : "people"}
                      </span>
                      <form action={actions.removeScopedAuthoriser}>
                        <input type="hidden" name="approverId" value={approverId} />
                        <Button variant="ghost" type="submit" className="py-2 text-xs text-[var(--on-surface-variant)] hover:text-red-600">
                          Remove all
                        </Button>
                      </form>
                    </div>
                  </div>

                  <div className="px-4 py-4">
                    <p className="mb-2 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]">
                      Can authorise leave for
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {targets.map((scope) => (
                        <form key={scope.id} action={actions.removeScopedTarget} className="contents">
                          <input type="hidden" name="id" value={scope.id} />
                          <button
                            type="submit"
                            className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-medium text-[var(--on-surface)] shadow-sm calm-transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <span className="truncate">{scope.targetUser?.fullName}</span>
                            <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 shrink-0 text-[var(--on-surface-variant)] group-hover:text-red-600" aria-hidden>
                              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            </svg>
                          </button>
                        </form>
                      ))}
                    </div>

                    <form action={actions.addScopedAuthoriser} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <input type="hidden" name="approverId" value={approverId} />
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`scoped-add-${approverId}`}>Add covered person</Label>
                        <select
                          id={`scoped-add-${approverId}`}
                          name="targetUserId"
                          className="mt-1 min-h-[2.75rem] w-full rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3 text-sm text-[var(--on-surface)] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
                          required
                        >
                          <option value="">Select staff…</option>
                          {staff
                            .filter((s) => !targets.some((t) => t.targetUserId === s.id) && s.id !== approverId)
                            .map((s) => (
                              <option value={s.id} key={s.id}>
                                {s.fullName}
                              </option>
                            ))}
                        </select>
                      </div>
                      <Button type="submit" variant="secondary" className="w-full shrink-0 rounded-xl sm:w-auto">
                        Add
                      </Button>
                    </form>
                  </div>
                </div>
              ))}

              {scopedGroups.length === 0 ? (
                <EmptyState
                  mode="embedded"
                  title="No scoped authorisers"
                  description="Use the form below to pick an approver and one team member they can cover. Repeat to widen coverage."
                />
              ) : null}
            </div>

            <div className="mx-5 mb-6 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-low)] p-5 sm:mx-7">
              <h3 className="text-[0.9375rem] font-bold text-[var(--on-surface)]">New scoped authoriser</h3>
              <p className="mt-1 text-[0.8125rem] text-[var(--on-surface-variant)]">
                Pick who approves, then who they cover. After saving, open their card to attach more people.
              </p>
              <form action={actions.addScopedAuthoriser} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <div className="min-w-0">
                  <Label htmlFor="scoped-new-approver">Authoriser</Label>
                  <select
                    id="scoped-new-approver"
                    name="approverId"
                    className="mt-1 min-h-[2.75rem] w-full rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3 text-sm text-[var(--on-surface)] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
                    required
                  >
                    <option value="">Choose…</option>
                    {staff
                      .filter((s) => !globalAuthoriserSet.has(s.id))
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.fullName}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <Label htmlFor="scoped-new-target">Covered person</Label>
                  <select
                    id="scoped-new-target"
                    name="targetUserId"
                    className="mt-1 min-h-[2.75rem] w-full rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3 text-sm text-[var(--on-surface)] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
                    required
                  >
                    <option value="">Choose…</option>
                    {staff.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full rounded-xl lg:w-auto">
                  Add pair
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </TaxonomyTabsShell>
  );
}
