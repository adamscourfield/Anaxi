import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";

export default async function AdminLeaveApprovalsPage() {
  const user = await requireAdminUser();

  const allUsers = await (prisma as any).user.findMany({
    where: { tenantId: user.tenantId, isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  const groups = await (prisma as any).leaveApprovalGroup.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
    include: {
      approvers: { include: { approver: { select: { id: true, fullName: true } } } },
      scopes: { include: { subject: { select: { id: true, fullName: true } } } },
    },
  });

  async function createGroup(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const name = String(formData.get("name") || "").trim();
    const appliesTo = String(formData.get("appliesTo") || "ALL_STAFF");
    if (!name) return;
    await (prisma as any).leaveApprovalGroup.create({ data: { tenantId: admin.tenantId, name, appliesTo } });
    revalidatePath("/admin/leave-approvals");
  }

  async function deleteGroup(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    await (prisma as any).leaveApprovalGroup.deleteMany({ where: { id, tenantId: admin.tenantId } });
    revalidatePath("/admin/leave-approvals");
  }

  async function addApprover(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const groupId = String(formData.get("groupId"));
    const approverUserId = String(formData.get("approverUserId") || "");
    if (!approverUserId) return;
    const grp = await (prisma as any).leaveApprovalGroup.findFirst({ where: { id: groupId, tenantId: admin.tenantId } });
    if (!grp) return;
    await (prisma as any).leaveApprovalGroupMember.upsert({
      where: { groupId_approverUserId: { groupId, approverUserId } },
      update: {},
      create: { tenantId: admin.tenantId, groupId, approverUserId },
    });
    revalidatePath("/admin/leave-approvals");
  }

  async function removeApprover(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const groupId = String(formData.get("groupId"));
    const approverUserId = String(formData.get("approverUserId"));
    const grp = await (prisma as any).leaveApprovalGroup.findFirst({ where: { id: groupId, tenantId: admin.tenantId } });
    if (!grp) return;
    await (prisma as any).leaveApprovalGroupMember.deleteMany({ where: { groupId, approverUserId } });
    revalidatePath("/admin/leave-approvals");
  }

  async function addScope(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const groupId = String(formData.get("groupId"));
    const subjectUserId = String(formData.get("subjectUserId") || "");
    if (!subjectUserId) return;
    const grp = await (prisma as any).leaveApprovalGroup.findFirst({ where: { id: groupId, tenantId: admin.tenantId } });
    if (!grp) return;
    await (prisma as any).leaveApprovalGroupScope.upsert({
      where: { groupId_subjectUserId: { groupId, subjectUserId } },
      update: {},
      create: { tenantId: admin.tenantId, groupId, subjectUserId },
    });
    revalidatePath("/admin/leave-approvals");
  }

  async function removeScope(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const groupId = String(formData.get("groupId"));
    const subjectUserId = String(formData.get("subjectUserId"));
    const grp = await (prisma as any).leaveApprovalGroup.findFirst({ where: { id: groupId, tenantId: admin.tenantId } });
    if (!grp) return;
    await (prisma as any).leaveApprovalGroupScope.deleteMany({ where: { groupId, subjectUserId } });
    revalidatePath("/admin/leave-approvals");
  }

  const groupList = groups as any[];

  return (
    <div className="space-y-6">
      <PageHeader variant="ledger"
        title="Leave Approval Rules"
        subtitle="Manage approval groups, approvers, and optional scoped staff coverage for leave requests."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/admin/taxonomies?tab=loa-reasons"
              className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-muted calm-transition hover:bg-[var(--surface-container-low)] hover:text-text"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 6v4l3 3" />
                <circle cx="10" cy="10" r="7" />
              </svg>
              LOA Reasons
            </Link>
            <form action={createGroup} className="flex items-center gap-2">
              <input
                name="name"
                placeholder="Group name…"
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 w-48"
                required
              />
              <select
                name="appliesTo"
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text w-44"
              >
                <option value="ALL_STAFF">All staff</option>
                <option value="SELECTED_MEMBERS">Selected members</option>
              </select>
              <Button type="submit" className="gap-2">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 4v12M4 10h12" />
                </svg>
                Create Group
              </Button>
            </form>
          </div>
        }
      />

      {groupList.length === 0 ? (
        <EmptyState title="No approval groups yet" description="Create a group above to configure leave approvals." />
      ) : (
        <div className="table-shell">
          {/* Table head */}
          <div className="table-head-row grid grid-cols-[1fr_160px_1fr_120px] items-center px-6 py-3">
            <span>Group Name</span>
            <span className="text-center">Scope</span>
            <span>Approvers</span>
            <span className="text-center">Actions</span>
          </div>

          {/* Table body */}
          {groupList.map((group: any) => {
            const approverIds = new Set<string>((group.approvers as any[]).map((a: any) => a.approverUserId));
            const scopeIds = new Set<string>((group.scopes as any[]).map((s: any) => s.subjectUserId));

            return (
              <div key={group.id} className="table-row px-6 py-4">
                <div className="grid grid-cols-[1fr_160px_1fr_120px] items-center">
                  {/* Group Name */}
                  <div>
                    <p className="text-[15px] font-semibold text-text leading-tight">{group.name}</p>
                  </div>

                  {/* Scope */}
                  <div className="text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      group.appliesTo === "ALL_STAFF"
                        ? "bg-[var(--status-approved-light)] text-[var(--status-approved-text)]"
                        : "bg-[var(--status-pending-light)] text-[var(--status-pending-text)]"
                    }`}>
                      {group.appliesTo === "ALL_STAFF" ? "All Staff" : "Selected"}
                    </span>
                  </div>

                  {/* Approvers */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {(group.approvers as any[]).length > 0 ? (
                      <div className="flex items-center gap-1">
                        {(group.approvers as any[]).slice(0, 3).map((a: any) => (
                          <Avatar key={a.approverUserId} name={a.approver?.fullName ?? "?"} size="sm" />
                        ))}
                        {(group.approvers as any[]).length > 3 && (
                          <span className="text-xs text-muted ml-1">+{(group.approvers as any[]).length - 3}</span>
                        )}
                        <span className="ml-2 text-xs text-muted">{(group.approvers as any[]).length} approver{(group.approvers as any[]).length !== 1 ? "s" : ""}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted italic">No approvers</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-center">
                    <form action={deleteGroup}>
                      <input type="hidden" name="id" value={group.id} />
                      <button
                        type="submit"
                        className="rounded-md p-1.5 text-muted calm-transition hover:bg-error/10 hover:text-error"
                        title="Delete group"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 6h12M8 6V4h4v2M6 6v10a1 1 0 001 1h6a1 1 0 001-1V6" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>

                {/* Expandable details section */}
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 border-t border-[var(--surface-container-low)] pt-3">
                  {/* Approvers management */}
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Approvers</h3>
                    {(group.approvers as any[]).length > 0 && (
                      <ul className="mb-2 space-y-1.5">
                        {(group.approvers as any[]).map((a: any) => (
                          <li key={a.approverUserId} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Avatar name={a.approver?.fullName ?? "?"} size="sm" />
                              <span className="text-text">{a.approver?.fullName}</span>
                            </div>
                            <form action={removeApprover}>
                              <input type="hidden" name="groupId" value={group.id} />
                              <input type="hidden" name="approverUserId" value={a.approverUserId} />
                              <button
                                type="submit"
                                className="rounded-md p-1 text-muted calm-transition hover:bg-error/10 hover:text-error"
                                title="Remove approver"
                              >
                                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                  <path d="M4 8h8" />
                                </svg>
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form action={addApprover} className="flex gap-2">
                      <input type="hidden" name="groupId" value={group.id} />
                      <select name="approverUserId" className="field flex-1">
                        <option value="">Add approver…</option>
                        {(allUsers as any[])
                          .filter((u: any) => !approverIds.has(u.id))
                          .map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                      <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">Add</Button>
                    </form>
                  </div>

                  {/* Scoped staff (only for SELECTED_MEMBERS) */}
                  {group.appliesTo === "SELECTED_MEMBERS" && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Covered Staff</h3>
                      {(group.scopes as any[]).length > 0 && (
                        <ul className="mb-2 space-y-1.5">
                          {(group.scopes as any[]).map((s: any) => (
                            <li key={s.subjectUserId} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-container-low)] px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Avatar name={s.subject?.fullName ?? "?"} size="sm" />
                                <span className="text-text">{s.subject?.fullName}</span>
                              </div>
                              <form action={removeScope}>
                                <input type="hidden" name="groupId" value={group.id} />
                                <input type="hidden" name="subjectUserId" value={s.subjectUserId} />
                                <button
                                  type="submit"
                                  className="rounded-md p-1 text-muted calm-transition hover:bg-error/10 hover:text-error"
                                  title="Remove staff member"
                                >
                                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                    <path d="M4 8h8" />
                                  </svg>
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form action={addScope} className="flex gap-2">
                        <input type="hidden" name="groupId" value={group.id} />
                        <select name="subjectUserId" className="field flex-1">
                          <option value="">Add staff member…</option>
                          {(allUsers as any[])
                            .filter((u: any) => !scopeIds.has(u.id))
                            .map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                        </select>
                        <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">Add</Button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Footer with count */}
          <div className="flex items-center justify-between border-t border-[var(--surface-container-low)] px-6 py-3">
            <p className="text-sm text-muted">
              Showing <span className="font-semibold text-text">{groupList.length}</span> approval group{groupList.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
