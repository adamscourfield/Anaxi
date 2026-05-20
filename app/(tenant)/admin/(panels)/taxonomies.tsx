import Link from "next/link";
import { adminSectionPath, revalidateAdmin } from "@/lib/admin-sections";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { PageHeader } from "@/components/ui/page-header";
import { TaxonomiesAdminView } from "@/components/admin/taxonomies-admin-view";
import { TAXONOMY_TABS, type TaxonomyTab } from "@/components/admin/taxonomy-tab-meta";

export async function TaxonomiesAdminPanel({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireAdminUser();
  const tabParam = Array.isArray(searchParams?.tab) ? searchParams.tab[0] : searchParams?.tab;
  const requested = (tabParam ?? "loa-reasons") as TaxonomyTab;
  const initialTab = (TAXONOMY_TABS.includes(requested) ? requested : "loa-reasons") as TaxonomyTab;

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
    revalidateAdmin("taxonomies");
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
    revalidateAdmin("taxonomies");
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
    revalidateAdmin("taxonomies");
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
    revalidateAdmin("taxonomies");
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
    revalidateAdmin("taxonomies");
  }

  async function removeAuthoriser(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    await (prisma as any).lOAAuthoriser.deleteMany({ where: { id, tenantId: admin.tenantId } });
    revalidateAdmin("taxonomies");
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
    revalidateAdmin("taxonomies");
  }

  async function removeScopedTarget(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    await (prisma as any).lOAApprovalScope.deleteMany({ where: { id, tenantId: admin.tenantId } });
    revalidateAdmin("taxonomies");
  }

  async function removeScopedAuthoriser(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const approverId = String(formData.get("approverId"));
    await (prisma as any).lOAApprovalScope.deleteMany({ where: { tenantId: admin.tenantId, approverId } });
    revalidateAdmin("taxonomies");
  }

  const globalAuthoriserIds = (loaAuthorisers as any[]).map((a) => a.userId as string);
  const scopedApproverIds = Array.from(scopesByApprover.keys());

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

  const scopedGroups = Array.from(scopesByApprover.entries()).map(([approverId, { approver, targets }]) => ({
    approverId,
    approver: approver
      ? { fullName: approver.fullName as string, email: approver.email as string }
      : null,
    targets: (targets as any[]).map((scope) => ({
      id: scope.id as string,
      targetUserId: scope.targetUserId as string,
      targetUser: scope.targetUser ? { fullName: scope.targetUser.fullName as string } : null,
    })),
  }));

  const authoriserRows = (loaAuthorisers as any[]).map((row) => ({
    id: row.id as string,
    userId: row.userId as string,
    user: row.user
      ? { fullName: row.user.fullName as string, email: row.user.email as string }
      : null,
  }));

  const staffOptions = (staff as any[]).map((s) => ({
    id: s.id as string,
    fullName: s.fullName as string,
    email: s.email as string,
  }));

  return (
    <div className="space-y-6 pb-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-3.5 py-2 text-[0.8125rem] font-semibold text-[var(--on-surface)] shadow-sm calm-transition hover:bg-[var(--surface-container-low)]"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-[var(--on-surface-variant)]" aria-hidden>
          <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Admin
      </Link>

      <PageHeader
        variant="ledger"
        title="Taxonomies"
        titleClassName="!text-[var(--on-surface)]"
        subtitleClassName="anx-page-subtitle !text-[var(--on-surface-variant)]"
        subtitle="Configure leave reasons, on-call options, and who can approve leave. Changes apply to new requests; existing records keep their labels."
        actions={
          <Link
            href={adminSectionPath("leave-approvals")}
            className="inline-flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--outline-variant)_55%,transparent)] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-[0.8125rem] font-semibold text-[var(--on-surface)] shadow-sm calm-transition hover:bg-[var(--surface-container-low)]"
          >
            <svg className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 21v-7M4 10V8a2 2 0 012-2h6a2 2 0 012 2v2M4 21h16M8 21v-9M12 21v-5M16 21v-3M20 10v11" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 8h1M11 8h1M15 8h1" strokeLinecap="round" />
            </svg>
            Approval rules
          </Link>
        }
      />

      <div className="flex gap-3 rounded-xl border border-[color-mix(in_srgb,var(--info)_35%,transparent)] bg-[color-mix(in_srgb,var(--info)_08%,var(--surface-container-lowest))] p-4 text-[0.8125rem] leading-relaxed text-[var(--on-surface)]">
        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 16v-5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="min-w-0">
          <strong>Leave approval rules</strong> (groups) and <strong>per-person authorisers</strong> below both apply — a user can approve if they match either system. Configure groups in{" "}
          <a className="font-semibold text-[#2563EB] underline decoration-[#93C5FD] underline-offset-2 hover:text-[#1D4ED8]" href={adminSectionPath("leave-approvals")}>
            Leave approval rules
          </a>
          . Here you manage dropdown values, notification emails, and legacy global/scoped authorisers.
        </p>
      </div>

      <TaxonomiesAdminView
        initialTab={initialTab}
        loaRows={loaRows}
        reasonRows={reasonRows}
        locationRows={locationRows}
        recipientRows={recipientRows}
        loaAuthorisers={authoriserRows}
        scopedGroups={scopedGroups}
        staff={staffOptions}
        globalAuthoriserIds={globalAuthoriserIds}
        scopedApproverIds={scopedApproverIds}
        actions={{
          addItem,
          updateItem,
          toggleActive,
          deleteItem,
          reorderTaxonomy,
          removeAuthoriser,
          addScopedAuthoriser,
          removeScopedTarget,
          removeScopedAuthoriser,
        }}
      />
    </div>
  );
}
