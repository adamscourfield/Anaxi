import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Label } from "@/components/ui/typography";
import { TaxonomyTabSelect } from "./TaxonomyTabSelect";

const TABS = ["loa-reasons", "loa-authorisers", "on-call-reasons", "on-call-locations", "on-call-recipients"] as const;
type Tab = (typeof TABS)[number];

const LEAVE_TABS: Tab[] = ["loa-reasons", "loa-authorisers"];
const ON_CALL_TABS: Tab[] = ["on-call-reasons", "on-call-locations", "on-call-recipients"];

const TAB_META: Record<Tab, { label: string; icon: JSX.Element; description: string }> = {
  "loa-reasons": {
    label: "LOA Reasons",
    description: "Categories staff can choose when requesting leave.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  "loa-authorisers": {
    label: "LOA Authorisers",
    description: "Staff who can approve or deny leave requests.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M13 13l2 2 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "on-call-reasons": {
    label: "On Call Reasons",
    description: "Reasons available when creating on-call requests.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d="M5 3h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  "on-call-locations": {
    label: "On Call Locations",
    description: "Locations available for on-call incident reports.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d="M10 2a6 6 0 016 6c0 4-6 10-6 10S4 12 4 8a6 6 0 016-6z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  "on-call-recipients": {
    label: "On Call Recipients",
    description: "Email addresses that receive on-call notifications.",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 6l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

const TAB_LABELS: Record<Tab, string> = Object.fromEntries(
  (Object.keys(TAB_META) as Tab[]).map((k) => [k, TAB_META[k].label])
) as Record<Tab, string>;

export default async function AdminTaxonomiesPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const user = await requireAdminUser();
  const tab = (TABS.includes((searchParams?.tab as Tab) || "loa-reasons") ? (searchParams?.tab as Tab) : "loa-reasons") as Tab;

  const [loaReasons, onCallReasons, locations, recipients, staff, loaAuthorisers, loaApprovalScopes] = await Promise.all([
    prisma.loaReason.findMany({ where: { tenantId: user.tenantId }, orderBy: { label: "asc" } }),
    (prisma as any).onCallReason.findMany({ where: { tenantId: user.tenantId }, orderBy: { label: "asc" } }),
    (prisma as any).onCallLocation.findMany({ where: { tenantId: user.tenantId }, orderBy: { label: "asc" } }),
    (prisma as any).onCallRecipient.findMany({ where: { tenantId: user.tenantId }, orderBy: { email: "asc" } }),
    (prisma as any).user.findMany({ where: { tenantId: user.tenantId, isActive: true }, orderBy: { fullName: "asc" } }),
    (prisma as any).lOAAuthoriser.findMany({ where: { tenantId: user.tenantId }, include: { user: true } }),
    (prisma as any).lOAApprovalScope.findMany({
      where: { tenantId: user.tenantId },
      include: { approver: { select: { id: true, fullName: true, email: true } }, targetUser: { select: { id: true, fullName: true } } },
    }),
  ]);

  // Group scoped approvals by approver
  const scopesByApprover = new Map<string, { approver: any; targets: any[] }>();
  for (const scope of loaApprovalScopes as any[]) {
    const existing = scopesByApprover.get(scope.approverId);
    if (existing) {
      existing.targets.push(scope);
    } else {
      scopesByApprover.set(scope.approverId, { approver: scope.approver, targets: [scope] });
    }
  }

  // ---------- Server Actions ----------

  async function addItem(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const type = String(formData.get("type"));
    const value = String(formData.get("value") || "").trim();
    if (!value) return;
    if (type === "loa") await prisma.loaReason.create({ data: { tenantId: admin.tenantId, label: value } });
    if (type === "reason") await (prisma as any).onCallReason.create({ data: { tenantId: admin.tenantId, label: value } });
    if (type === "location") await (prisma as any).onCallLocation.create({ data: { tenantId: admin.tenantId, label: value } });
    if (type === "recipient") await (prisma as any).onCallRecipient.create({ data: { tenantId: admin.tenantId, email: value } });
    if (type === "loa_authoriser") {
      await (prisma as any).lOAAuthoriser.upsert({
        where: { tenantId_userId: { tenantId: admin.tenantId, userId: value } },
        update: {},
        create: { tenantId: admin.tenantId, userId: value },
      });
    }
    revalidatePath("/admin/taxonomies");
  }

  async function updateItem(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const type = String(formData.get("type"));
    const id = String(formData.get("id"));
    const label = String(formData.get("label") || "").trim();
    if (!id) return;
    if (type === "loa") await prisma.loaReason.updateMany({ where: { id, tenantId: admin.tenantId }, data: { label } });
    if (type === "reason") await (prisma as any).onCallReason.updateMany({ where: { id, tenantId: admin.tenantId }, data: { label } });
    if (type === "location") await (prisma as any).onCallLocation.updateMany({ where: { id, tenantId: admin.tenantId }, data: { label } });
    if (type === "recipient") await (prisma as any).onCallRecipient.updateMany({ where: { id, tenantId: admin.tenantId }, data: { email: label } });
    revalidatePath("/admin/taxonomies");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const type = String(formData.get("type"));
    const id = String(formData.get("id"));
    const active = String(formData.get("active")) === "true";
    if (!id) return;
    if (type === "loa") await prisma.loaReason.updateMany({ where: { id, tenantId: admin.tenantId }, data: { active: !active } });
    if (type === "reason") await (prisma as any).onCallReason.updateMany({ where: { id, tenantId: admin.tenantId }, data: { active: !active } });
    if (type === "location") await (prisma as any).onCallLocation.updateMany({ where: { id, tenantId: admin.tenantId }, data: { active: !active } });
    if (type === "recipient") await (prisma as any).onCallRecipient.updateMany({ where: { id, tenantId: admin.tenantId }, data: { active: !active } });
    revalidatePath("/admin/taxonomies");
  }

  async function removeAuthoriser(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    await (prisma as any).lOAAuthoriser.deleteMany({ where: { id, tenantId: admin.tenantId } });
    revalidatePath("/admin/taxonomies");
  }

  async function addScopedAuthoriser(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const approverId = String(formData.get("approverId") || "").trim();
    const targetUserId = String(formData.get("targetUserId") || "").trim();
    if (!approverId || !targetUserId || approverId === targetUserId) return;
    await (prisma as any).lOAApprovalScope.upsert({
      where: { tenantId_approverId_targetUserId: { tenantId: admin.tenantId, approverId, targetUserId } },
      update: {},
      create: { tenantId: admin.tenantId, approverId, targetUserId },
    });
    revalidatePath("/admin/taxonomies");
  }

  async function removeScopedTarget(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    await (prisma as any).lOAApprovalScope.deleteMany({ where: { id, tenantId: admin.tenantId } });
    revalidatePath("/admin/taxonomies");
  }

  async function removeScopedAuthoriser(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const approverId = String(formData.get("approverId"));
    await (prisma as any).lOAApprovalScope.deleteMany({ where: { tenantId: admin.tenantId, approverId } });
    revalidatePath("/admin/taxonomies");
  }

  // ---------- Helpers ----------

  const tabNavLink = (value: Tab) => {
    const meta = TAB_META[value];
    const active = tab === value;
    return (
      <Link
        key={value}
        href={`/admin/taxonomies?tab=${value}`}
        scroll={false}
        className={`group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium calm-transition md:rounded-xl md:px-3.5 ${
          active
            ? "bg-[var(--surface-container-lowest)] text-accent shadow-ambient"
            : "text-muted hover:bg-[var(--surface-container-high)] hover:text-text"
        }`}
      >
        <span className={`shrink-0 ${active ? "text-accent" : "text-muted/60 group-hover:text-accent/70"}`}>
          {meta.icon}
        </span>
        {meta.label}
      </Link>
    );
  };

  const editableTaxonomy = (
    title: string,
    type: string,
    rows: any[],
    field: "label" | "email",
    opts?: { addItemNoun?: string; valueHeader?: string }
  ) => {
    const addItemNoun = opts?.addItemNoun ?? "item";
    const valueHeader = opts?.valueHeader ?? (field === "email" ? "Email" : "Name");
    const activeCount = rows.filter((r) => r.active).length;
    const inactiveCount = rows.length - activeCount;
    const meta = TAB_META[tab];
    const valueInputLabel = field === "email" ? "Email address" : valueHeader;

    return (
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader title={title} subtitle={meta.description} className="mb-0 sm:min-w-0 sm:flex-1" />
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-status-approved-bg px-2.5 py-1 text-xs font-medium text-status-approved-text">
              <span className="h-1.5 w-1.5 rounded-full bg-status-approved" />
              {activeCount} active
            </span>
            {inactiveCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-container-low)] px-2.5 py-1 text-xs font-medium text-on-surface-variant">
                <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
                {inactiveCount} inactive
              </span>
            ) : null}
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="mt-5 overflow-x-auto rounded-[1rem]">
            <div className="table-shell min-w-[min(100%,520px)]">
              <div className="table-head-row hidden grid-cols-[minmax(0,1fr)_108px_132px] items-center gap-3 px-4 py-2.5 md:grid md:px-6">
                <span>{valueHeader}</span>
                <span className="text-center">Status</span>
                <span className="text-right">Actions</span>
              </div>
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={`table-row grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_108px_132px] md:items-center md:gap-3 md:px-6 md:py-3 ${
                    row.active ? "" : "opacity-[0.72]"
                  }`}
                >
                  <form
                    action={updateItem}
                    className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end"
                  >
                    <input type="hidden" name="type" value={type} />
                    <input type="hidden" name="id" value={row.id} />
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`tax-${type}-${row.id}`} className="mb-1 md:sr-only">
                        {valueInputLabel}
                      </Label>
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            row.active ? "bg-scale-strong-bar" : "bg-outline-variant"
                          }`}
                          title={row.active ? "Active" : "Inactive"}
                        />
                        <input
                          id={`tax-${type}-${row.id}`}
                          name="label"
                          defaultValue={row[field]}
                          aria-label={valueInputLabel}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-[var(--surface-container-lowest)] px-3 py-2 text-sm focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15"
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" variant="secondary" className="w-full shrink-0 py-2 sm:w-auto sm:px-4">
                      Save
                    </Button>
                  </form>
                  <div className="flex items-center border-t border-[var(--divider-subtle)] pt-3 md:justify-center md:border-0 md:pt-0">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                        row.active
                          ? "bg-status-approved-bg text-status-approved-text"
                          : "bg-[var(--surface-container-low)] text-on-surface-variant"
                      }`}
                    >
                      {row.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <form action={toggleActive} className="flex md:justify-end">
                    <input type="hidden" name="type" value={type} />
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="active" value={String(row.active)} />
                    <button
                      type="submit"
                      className={`w-full rounded-lg px-3 py-2 text-xs font-semibold calm-transition md:w-auto ${
                        row.active
                          ? "bg-status-pending-bg text-status-pending-text hover:bg-status-pending-light"
                          : "bg-status-approved-bg text-status-approved-text hover:bg-status-approved-light"
                      }`}
                    >
                      {row.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              mode="embedded"
              title={`No ${title.toLowerCase()} yet`}
              description="Add an entry below. Inactive items stay in the list but are hidden from staff when they choose a reason or location."
            />
          </div>
        )}

        <div className="mt-6 rounded-[1rem] bg-[var(--surface-container-low)] p-4 md:p-5">
          <h3 className="text-[15px] font-semibold text-text">Add {addItemNoun}</h3>
          <p className="mt-0.5 text-xs text-muted">
            New entries are active by default. You can deactivate them anytime without deleting history.
          </p>
          <form action={addItem} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="type" value={type} />
            <div className="min-w-0 flex-1">
              <Label htmlFor={`tax-add-${type}`}>
                {field === "email" ? "Email address" : `${valueHeader}`}
              </Label>
              <input
                id={`tax-add-${type}`}
                name="value"
                className="mt-0 w-full rounded-lg border border-border bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm placeholder:text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15"
                placeholder={field === "email" ? "name@school.org" : `e.g. Annual leave`}
                required
                autoComplete={field === "email" ? "email" : "off"}
              />
            </div>
            <Button type="submit" className="w-full shrink-0 sm:w-auto">
              Add
            </Button>
          </form>
        </div>
      </Card>
    );
  };

  // ---------- Render ----------

  const globalAuthoriserIds = new Set((loaAuthorisers as any[]).map((a) => a.userId));
  const scopedApproverIds = new Set(scopesByApprover.keys());

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Admin
      </Link>

      <PageHeader
        title="Taxonomies"
        subtitle="Configure leave reasons, on-call options, and who can approve leave. Changes apply to new requests; existing records keep their labels."
        actions={
          <Link
            href="/admin/leave-approvals"
            className="inline-flex items-center gap-2 rounded-[0.75rem] border border-border bg-[var(--surface-container-lowest)] px-4 py-2.5 text-sm font-semibold text-text shadow-ambient calm-transition hover:bg-[var(--surface-container-low)]"
          >
            <svg className="h-4 w-4 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 6h12M4 10h12M4 14h8" strokeLinecap="round" />
            </svg>
            Approval rules
          </Link>
        }
      />

      <div className="flex gap-3 rounded-[1rem] bg-[var(--accent-surface)]/40 p-4 text-sm text-muted">
        <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-accent">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 9v4M10 7h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p>
          For <span className="font-medium text-text">group-based</span> leave approval, use{" "}
          <a className="font-medium text-accent hover:underline" href="/admin/leave-approvals">
            Leave approval rules
          </a>
          . Here you manage dropdown values, notification emails, and per-person LOA authorisers.
        </p>
      </div>

      <TaxonomyTabSelect tabs={TABS} current={tab} labels={TAB_LABELS} />

      <div className="hidden md:block">
        <div className="rounded-[1rem] bg-[var(--surface-container-low)] p-1.5">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted/80">
            Leave of absence
          </p>
          <nav className="flex flex-wrap gap-1" aria-label="Leave taxonomy sections">
            {LEAVE_TABS.map((t) => tabNavLink(t))}
          </nav>
        </div>
        <div className="mt-3 rounded-[1rem] bg-[var(--surface-container-low)] p-1.5">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted/80">
            On call
          </p>
          <nav className="flex flex-wrap gap-1" aria-label="On-call taxonomy sections">
            {ON_CALL_TABS.map((t) => tabNavLink(t))}
          </nav>
        </div>
      </div>

      {tab === "loa-reasons" &&
        editableTaxonomy("LOA Reasons", "loa", loaReasons as any[], "label", {
          addItemNoun: "reason",
          valueHeader: "Reason",
        })}
      {tab === "on-call-reasons" &&
        editableTaxonomy("On Call Reasons", "reason", onCallReasons as any[], "label", {
          addItemNoun: "reason",
          valueHeader: "Reason",
        })}
      {tab === "on-call-locations" &&
        editableTaxonomy("On Call Locations", "location", locations as any[], "label", {
          addItemNoun: "location",
          valueHeader: "Location",
        })}
      {tab === "on-call-recipients" &&
        editableTaxonomy("On Call Recipients", "recipient", recipients as any[], "email", {
          addItemNoun: "recipient",
          valueHeader: "Email",
        })}

      {tab === "loa-authorisers" && (
        <div className="space-y-6">
          <Card>
            <SectionHeader
              title="Global authorisers"
              subtitle="Can approve or deny leave for any staff member. Use this for senior leaders or HR."
            />
            <div className="mt-4 space-y-2">
              {(loaAuthorisers as any[]).map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-[1rem] bg-[var(--surface-container-low)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={row.user?.fullName ?? "?"} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold text-text">{row.user?.fullName}</p>
                      <p className="truncate text-xs text-muted">{row.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-status-approved-bg px-2.5 py-1 text-xs font-medium text-status-approved-text">
                      <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M5 8.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      All staff
                    </span>
                    <form action={removeAuthoriser}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button variant="ghost" type="submit" className="py-2 text-xs text-muted hover:text-error">
                        Remove
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
              {loaAuthorisers.length === 0 && (
                <EmptyState
                  mode="embedded"
                  title="No global authorisers"
                  description="Add at least one person if you want school-wide approvers outside of group rules."
                />
              )}
            </div>

            <div className="mt-6 rounded-[1rem] bg-[var(--surface-container-low)] p-4 md:p-5">
              <h3 className="text-[15px] font-semibold text-text">Add global authoriser</h3>
              <p className="mt-0.5 text-xs text-muted">Staff already listed as scoped-only approvers are excluded until you remove that role.</p>
              <form action={addItem} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="type" value="loa_authoriser" />
                <div className="min-w-0 flex-1">
                  <Label htmlFor="global-auth-staff">Staff member</Label>
                  <select
                    id="global-auth-staff"
                    name="value"
                    className="mt-0 w-full rounded-lg border border-border bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15"
                    required
                  >
                    <option value="">Choose someone…</option>
                    {(staff as any[])
                      .filter((s) => !globalAuthoriserIds.has(s.id) && !scopedApproverIds.has(s.id))
                      .map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.fullName} ({s.email})
                        </option>
                      ))}
                  </select>
                </div>
                <Button type="submit" className="w-full shrink-0 sm:w-auto">
                  Add
                </Button>
              </form>
            </div>
          </Card>

          <Card>
            <SectionHeader
              title="Scoped authorisers"
              subtitle="Each person here only sees leave requests from the colleagues you attach. Good for line managers."
            />

            <div className="mt-4 space-y-4">
              {Array.from(scopesByApprover.entries()).map(([approverId, { approver, targets }]) => (
                <div key={approverId} className="overflow-hidden rounded-[1rem] bg-[var(--surface-container-low)]">
                  <div className="flex flex-col gap-3 border-b border-[var(--divider-subtle)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={approver?.fullName ?? "?"} size="md" />
                      <div className="min-w-0">
                        <p className="font-semibold text-text">{approver?.fullName}</p>
                        <p className="truncate text-xs text-muted">{approver?.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-status-pending-bg px-2.5 py-1 text-xs font-medium text-status-pending-text">
                        {targets.length} {targets.length === 1 ? "person" : "people"}
                      </span>
                      <form action={removeScopedAuthoriser}>
                        <input type="hidden" name="approverId" value={approverId} />
                        <Button variant="ghost" type="submit" className="py-2 text-xs text-muted hover:text-error">
                          Remove all
                        </Button>
                      </form>
                    </div>
                  </div>

                  <div className="px-4 py-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Can authorise leave for
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {targets.map((scope: any) => (
                        <form key={scope.id} action={removeScopedTarget} className="contents">
                          <input type="hidden" name="id" value={scope.id} />
                          <button
                            type="submit"
                            className="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-medium text-text shadow-ambient calm-transition hover:bg-error/5 hover:text-error"
                          >
                            <span className="truncate">{scope.targetUser?.fullName}</span>
                            <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 shrink-0 text-muted/50 group-hover:text-error">
                              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                            </svg>
                          </button>
                        </form>
                      ))}
                    </div>

                    <form action={addScopedAuthoriser} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <input type="hidden" name="approverId" value={approverId} />
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`scoped-add-${approverId}`}>Add covered person</Label>
                        <select
                          id={`scoped-add-${approverId}`}
                          name="targetUserId"
                          className="mt-0 w-full rounded-lg border border-border bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15"
                          required
                        >
                          <option value="">Select staff…</option>
                          {(staff as any[])
                            .filter((s) => !targets.some((t: any) => t.targetUserId === s.id) && s.id !== approverId)
                            .map((s) => (
                              <option value={s.id} key={s.id}>
                                {s.fullName}
                              </option>
                            ))}
                        </select>
                      </div>
                      <Button type="submit" variant="secondary" className="w-full shrink-0 sm:w-auto">
                        Add
                      </Button>
                    </form>
                  </div>
                </div>
              ))}

              {scopesByApprover.size === 0 && (
                <EmptyState
                  mode="embedded"
                  title="No scoped authorisers"
                  description="Use the form below to pick an approver and one team member they can cover. Repeat to widen coverage."
                />
              )}
            </div>

            <div className="mt-6 rounded-[1rem] bg-[var(--surface-container-low)] p-4 md:p-5">
              <h3 className="text-[15px] font-semibold text-text">New scoped authoriser</h3>
              <p className="mt-0.5 text-xs text-muted">
                Pick who approves, then who they cover. After saving, open their card to attach more people.
              </p>
              <form action={addScopedAuthoriser} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <div className="min-w-0">
                  <Label htmlFor="scoped-new-approver">Authoriser</Label>
                  <select
                    id="scoped-new-approver"
                    name="approverId"
                    className="mt-0 w-full rounded-lg border border-border bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15"
                    required
                  >
                    <option value="">Choose…</option>
                    {(staff as any[])
                      .filter((s) => !globalAuthoriserIds.has(s.id))
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
                    className="mt-0 w-full rounded-lg border border-border bg-[var(--surface-container-lowest)] px-3 py-2.5 text-sm focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/15"
                    required
                  >
                    <option value="">Choose…</option>
                    {(staff as any[]).map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full lg:w-auto">
                  Add pair
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
