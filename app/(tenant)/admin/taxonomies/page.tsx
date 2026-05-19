import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Label } from "@/components/ui/typography";
import { TaxonomyTabSelect } from "./TaxonomyTabSelect";
import { TaxonomyEditableSection } from "./TaxonomyEditableSection";

const TABS = ["loa-reasons", "loa-authorisers", "on-call-reasons", "on-call-locations", "on-call-recipients"] as const;
type Tab = (typeof TABS)[number];

const LEAVE_TABS: Tab[] = ["loa-reasons", "loa-authorisers"];
const ON_CALL_TABS: Tab[] = ["on-call-reasons", "on-call-locations", "on-call-recipients"];

const NAV_CARD =
  "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

const ICON_WELL_BASE =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border [&_svg]:shrink-0";

const TAB_META: Record<Tab, { label: string; icon: JSX.Element; description: string }> = {
  "loa-reasons": {
    label: "LOA Reasons",
    description: "Categories staff can choose when requesting leave.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M12 18v-6M9 15h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "loa-authorisers": {
    label: "LOA Authorisers",
    description: "Staff who can approve or deny leave requests.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 8v6M22 11h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "on-call-reasons": {
    label: "On Call Reasons",
    description: "Reasons available when creating on-call requests.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "on-call-locations": {
    label: "On Call Locations",
    description: "Locations available for on-call incident reports.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  "on-call-recipients": {
    label: "On Call Recipients",
    description: "Email addresses that receive on-call notifications.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 7l9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

const TAB_LABELS: Record<Tab, string> = Object.fromEntries(
  (Object.keys(TAB_META) as Tab[]).map((k) => [k, TAB_META[k].label])
) as Record<Tab, string>;

export default async function AdminTaxonomiesPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const user = await requireAdminUser();
  const requested = (searchParams?.tab ?? "loa-reasons") as Tab;
  const tab = (TABS.includes(requested) ? requested : "loa-reasons") as Tab;

  const [loaReasons, onCallReasons, locations, recipients, staff, loaAuthorisers, loaApprovalScopes] = await Promise.all([
    prisma.loaReason.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    (prisma as any).onCallReason.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    (prisma as any).onCallLocation.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    (prisma as any).onCallRecipient.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ sortOrder: "asc" }, { email: "asc" }] }),
    (prisma as any).user.findMany({ where: { tenantId: user.tenantId, isActive: true }, orderBy: { fullName: "asc" } }),
    (prisma as any).lOAAuthoriser.findMany({ where: { tenantId: user.tenantId }, include: { user: true } }),
    (prisma as any).lOAApprovalScope.findMany({
      where: { tenantId: user.tenantId },
      include: { approver: { select: { id: true, fullName: true, email: true } }, targetUser: { select: { id: true, fullName: true } } },
    }),
  ]);

  const scopesByApprover = new Map<string, { approver: any; targets: any[] }>();
  for (const scope of loaApprovalScopes as any[]) {
    const existing = scopesByApprover.get(scope.approverId);
    if (existing) {
      existing.targets.push(scope);
    } else {
      scopesByApprover.set(scope.approverId, { approver: scope.approver, targets: [scope] });
    }
  }

  async function addItem(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const type = String(formData.get("type"));
    const value = String(formData.get("value") || "").trim();
    if (!value) return;

    if (type === "loa") {
      const agg = await prisma.loaReason.aggregate({
        where: { tenantId: admin.tenantId },
        _max: { sortOrder: true },
      });
      const sortOrder = (agg._max.sortOrder ?? -1) + 1;
      await prisma.loaReason.create({ data: { tenantId: admin.tenantId, label: value, sortOrder } });
    }
    if (type === "reason") {
      const agg = await (prisma as any).onCallReason.aggregate({
        where: { tenantId: admin.tenantId },
        _max: { sortOrder: true },
      });
      const sortOrder = (agg._max.sortOrder ?? -1) + 1;
      await (prisma as any).onCallReason.create({ data: { tenantId: admin.tenantId, label: value, sortOrder } });
    }
    if (type === "location") {
      const agg = await (prisma as any).onCallLocation.aggregate({
        where: { tenantId: admin.tenantId },
        _max: { sortOrder: true },
      });
      const sortOrder = (agg._max.sortOrder ?? -1) + 1;
      await (prisma as any).onCallLocation.create({ data: { tenantId: admin.tenantId, label: value, sortOrder } });
    }
    if (type === "recipient") {
      const agg = await (prisma as any).onCallRecipient.aggregate({
        where: { tenantId: admin.tenantId },
        _max: { sortOrder: true },
      });
      const sortOrder = (agg._max.sortOrder ?? -1) + 1;
      await (prisma as any).onCallRecipient.create({ data: { tenantId: admin.tenantId, email: value, sortOrder } });
    }
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

  async function deleteItem(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const type = String(formData.get("type"));
    const id = String(formData.get("id"));
    if (!id) return;
    if (type === "loa") await prisma.loaReason.deleteMany({ where: { id, tenantId: admin.tenantId } });
    if (type === "reason") await (prisma as any).onCallReason.deleteMany({ where: { id, tenantId: admin.tenantId } });
    if (type === "location") await (prisma as any).onCallLocation.deleteMany({ where: { id, tenantId: admin.tenantId } });
    if (type === "recipient") await (prisma as any).onCallRecipient.deleteMany({ where: { id, tenantId: admin.tenantId } });
    revalidatePath("/admin/taxonomies");
  }

  async function reorderTaxonomy(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const type = String(formData.get("type"));
    const raw = String(formData.get("orderedIds") || "");
    const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return;

    if (type === "loa") {
      await prisma.$transaction(
        ids.map((rowId, idx) =>
          prisma.loaReason.updateMany({ where: { id: rowId, tenantId: admin.tenantId }, data: { sortOrder: idx } })
        )
      );
    }
    if (type === "reason") {
      await prisma.$transaction(
        ids.map((rowId, idx) =>
          (prisma as any).onCallReason.updateMany({ where: { id: rowId, tenantId: admin.tenantId }, data: { sortOrder: idx } })
        )
      );
    }
    if (type === "location") {
      await prisma.$transaction(
        ids.map((rowId, idx) =>
          (prisma as any).onCallLocation.updateMany({ where: { id: rowId, tenantId: admin.tenantId }, data: { sortOrder: idx } })
        )
      );
    }
    if (type === "recipient") {
      await prisma.$transaction(
        ids.map((rowId, idx) =>
          (prisma as any).onCallRecipient.updateMany({ where: { id: rowId, tenantId: admin.tenantId }, data: { sortOrder: idx } })
        )
      );
    }
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

  const tabTileLink = (value: Tab) => {
    const meta = TAB_META[value];
    const active = tab === value;
    return (
      <Link
        key={value}
        href={`/admin/taxonomies?tab=${value}`}
        scroll={false}
        className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 calm-transition ${
          active
            ? "border-[#3B82F6] bg-[#EFF6FF] shadow-sm"
            : "border-transparent hover:bg-[#F9FAFB]"
        }`}
      >
        <span
          className={`${ICON_WELL_BASE} ${
            active
              ? "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]"
              : "border-[#E5E7EB] bg-[#F3F4F6] text-[#6B7280]"
          }`}
        >
          {meta.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[0.9375rem] font-bold ${active ? "text-[#111827]" : "text-[#111827]"}`}>{meta.label}</span>
          <span className="mt-0.5 block text-[0.75rem] text-[#6B7280]">Manage…</span>
        </span>
      </Link>
    );
  };

  const globalAuthoriserIds = new Set((loaAuthorisers as any[]).map((a) => a.userId));
  const scopedApproverIds = new Set(scopesByApprover.keys());

  const loaRows = (loaReasons as any[]).map((r) => ({
    id: r.id as string,
    value: r.label as string,
    active: Boolean(r.active),
  }));
  const reasonRows = (onCallReasons as any[]).map((r) => ({
    id: r.id as string,
    value: r.label as string,
    active: Boolean(r.active),
  }));
  const locationRows = (locations as any[]).map((r) => ({
    id: r.id as string,
    value: r.label as string,
    active: Boolean(r.active),
  }));
  const recipientRows = (recipients as any[]).map((r) => ({
    id: r.id as string,
    value: r.email as string,
    active: Boolean(r.active),
  }));

  const AUTH_CARD =
    "overflow-hidden rounded-sm border border-border bg-[var(--surface-container-lowest)] shadow-none";

  return (
    <div className="space-y-6 pb-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3.5 py-2 text-[0.8125rem] font-semibold text-[#111827] shadow-sm calm-transition hover:bg-[#F9FAFB]"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Admin
      </Link>

      <PageHeader
        variant="ledger"
        title="Taxonomies"
        titleClassName="!text-[#111827]"
        subtitleClassName="anx-page-subtitle !text-[#6B7280]"
        subtitle="Configure leave reasons, on-call options, and who can approve leave. Changes apply to new requests; existing records keep their labels."
        actions={
          <Link
            href="/admin/leave-approvals"
            className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-[0.8125rem] font-semibold text-[#111827] shadow-sm calm-transition hover:bg-[#F9FAFB]"
          >
            <svg className="h-4 w-4 shrink-0 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 21v-7M4 10V8a2 2 0 012-2h6a2 2 0 012 2v2M4 21h16M8 21v-9M12 21v-5M16 21v-3M20 10v11" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 8h1M11 8h1M15 8h1" strokeLinecap="round" />
            </svg>
            Approval rules
          </Link>
        }
      />

      <div className="flex gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-[0.8125rem] leading-relaxed text-[#111827]">
        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 16v-5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="min-w-0">
          <strong>Leave approval rules</strong> (groups) and <strong>per-person authorisers</strong> below both apply — a user can approve if they match either system. Configure groups in{" "}
          <a className="font-semibold text-[#2563EB] underline decoration-[#93C5FD] underline-offset-2 hover:text-[#1D4ED8]" href="/admin/leave-approvals">
            Leave approval rules
          </a>
          . Here you manage dropdown values, notification emails, and legacy global/scoped authorisers.
        </p>
      </div>

      <TaxonomyTabSelect tabs={TABS} current={tab} labels={TAB_LABELS} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={NAV_CARD}>
          <p className="border-b border-[#E5E7EB] px-5 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Leave of absence</p>
          <nav className="flex flex-col divide-y divide-[#E5E7EB] p-2" aria-label="Leave taxonomy sections">
            {LEAVE_TABS.map((t) => tabTileLink(t))}
          </nav>
        </div>
        <div className={NAV_CARD}>
          <p className="border-b border-[#E5E7EB] px-5 py-3 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">On call</p>
          <nav className="flex flex-col divide-y divide-[#E5E7EB] p-2" aria-label="On-call taxonomy sections">
            {ON_CALL_TABS.map((t) => tabTileLink(t))}
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
          updateItem={updateItem}
          toggleActive={toggleActive}
          deleteItem={deleteItem}
          reorderTaxonomy={reorderTaxonomy}
          addItem={addItem}
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
          updateItem={updateItem}
          toggleActive={toggleActive}
          deleteItem={deleteItem}
          reorderTaxonomy={reorderTaxonomy}
          addItem={addItem}
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
          updateItem={updateItem}
          toggleActive={toggleActive}
          deleteItem={deleteItem}
          reorderTaxonomy={reorderTaxonomy}
          addItem={addItem}
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
          updateItem={updateItem}
          toggleActive={toggleActive}
          deleteItem={deleteItem}
          reorderTaxonomy={reorderTaxonomy}
          addItem={addItem}
        />
      ) : null}

      {tab === "loa-authorisers" ? (
        <div className="space-y-6">
          <div className={AUTH_CARD}>
            <div className="border-b border-[#E5E7EB] px-5 py-5 sm:px-7 sm:py-6">
              <h2 className="text-lg font-bold tracking-tight text-[#111827]">Global authorisers</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6B7280]">
                Can approve or deny leave for any staff member. Use this for senior leaders or HR.
              </p>
            </div>
            <div className="space-y-2 px-5 pb-6 pt-4 sm:px-7">
              {(loaAuthorisers as any[]).map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={row.user?.fullName ?? "?"} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold text-[#111827]">{row.user?.fullName}</p>
                      <p className="truncate text-xs text-[#6B7280]">{row.user?.email}</p>
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
                    <form action={removeAuthoriser}>
                      <input type="hidden" name="id" value={row.id} />
                      <Button variant="ghost" type="submit" className="py-2 text-xs text-[#6B7280] hover:text-red-600">
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

            <div className="mx-5 mb-6 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-5 sm:mx-7">
              <h3 className="text-[0.9375rem] font-bold text-[#111827]">Add global authoriser</h3>
              <p className="mt-1 text-[0.8125rem] text-[#6B7280]">Staff already listed as scoped-only approvers are excluded until you remove that role.</p>
              <form action={addItem} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <input type="hidden" name="type" value="loa_authoriser" />
                <div className="min-w-0 flex-1">
                  <Label htmlFor="global-auth-staff">Staff member</Label>
                  <select
                    id="global-auth-staff"
                    name="value"
                    className="mt-1 min-h-[2.75rem] w-full rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3 text-sm text-[#111827] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
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
                <Button type="submit" className="w-full shrink-0 rounded-xl sm:w-auto">
                  Add
                </Button>
              </form>
            </div>
          </div>

          <div className={AUTH_CARD}>
            <div className="border-b border-[#E5E7EB] px-5 py-5 sm:px-7 sm:py-6">
              <h2 className="text-lg font-bold tracking-tight text-[#111827]">Scoped authorisers</h2>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-[#6B7280]">
                Each person here only sees leave requests from the colleagues you attach. Good for line managers.
              </p>
            </div>

            <div className="space-y-4 px-5 pb-6 pt-4 sm:px-7">
              {Array.from(scopesByApprover.entries()).map(([approverId, { approver, targets }]) => (
                <div key={approverId} className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)]">
                  <div className="flex flex-col gap-3 border-b border-[#E5E7EB] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={approver?.fullName ?? "?"} size="md" />
                      <div className="min-w-0">
                        <p className="font-semibold text-[#111827]">{approver?.fullName}</p>
                        <p className="truncate text-xs text-[#6B7280]">{approver?.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-[#FFFBEB] px-2.5 py-1 text-xs font-semibold text-[#92400E]">
                        {targets.length} {targets.length === 1 ? "person" : "people"}
                      </span>
                      <form action={removeScopedAuthoriser}>
                        <input type="hidden" name="approverId" value={approverId} />
                        <Button variant="ghost" type="submit" className="py-2 text-xs text-[#6B7280] hover:text-red-600">
                          Remove all
                        </Button>
                      </form>
                    </div>
                  </div>

                  <div className="px-4 py-4">
                    <p className="mb-2 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-[#6B7280]">Can authorise leave for</p>
                    <div className="flex flex-wrap gap-2">
                      {targets.map((scope: any) => (
                        <form key={scope.id} action={removeScopedTarget} className="contents">
                          <input type="hidden" name="id" value={scope.id} />
                          <button
                            type="submit"
                            className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-medium text-[#111827] shadow-sm calm-transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          >
                            <span className="truncate">{scope.targetUser?.fullName}</span>
                            <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3 shrink-0 text-[#9CA3AF] group-hover:text-red-600" aria-hidden>
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
                          className="mt-1 min-h-[2.75rem] w-full rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3 text-sm text-[#111827] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
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
                      <Button type="submit" variant="secondary" className="w-full shrink-0 rounded-xl sm:w-auto">
                        Add
                      </Button>
                    </form>
                  </div>
                </div>
              ))}

              {scopesByApprover.size === 0 ? (
                <EmptyState
                  mode="embedded"
                  title="No scoped authorisers"
                  description="Use the form below to pick an approver and one team member they can cover. Repeat to widen coverage."
                />
              ) : null}
            </div>

            <div className="mx-5 mb-6 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-5 sm:mx-7">
              <h3 className="text-[0.9375rem] font-bold text-[#111827]">New scoped authoriser</h3>
              <p className="mt-1 text-[0.8125rem] text-[#6B7280]">
                Pick who approves, then who they cover. After saving, open their card to attach more people.
              </p>
              <form action={addScopedAuthoriser} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <div className="min-w-0">
                  <Label htmlFor="scoped-new-approver">Authoriser</Label>
                  <select
                    id="scoped-new-approver"
                    name="approverId"
                    className="mt-1 min-h-[2.75rem] w-full rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3 text-sm text-[#111827] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
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
                    className="mt-1 min-h-[2.75rem] w-full rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-3 text-sm text-[#111827] outline-none transition focus:ring-2 focus:ring-[rgba(15,23,42,0.06)]"
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
                <Button type="submit" className="w-full rounded-xl lg:w-auto">
                  Add pair
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
