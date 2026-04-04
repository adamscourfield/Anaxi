import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { UserDirectoryTable } from "./UserDirectoryTable";

// ─── Inline icons ─────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 3v10M6 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AddStaffIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 7a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 17v-1a5 5 0 015-5h2a5 5 0 015 5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 4v4M14 6h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default async function AdminUsersPage() {
  const user = await requireAdminUser();
  const users = await (prisma as any).user.findMany({ where: { tenantId: user.tenantId }, orderBy: { fullName: "asc" } });
  const scopes = await (prisma as any).lOAApprovalScope.findMany({ where: { tenantId: user.tenantId } });

  const scopedByApprover = new Map<string, Set<string>>();
  for (const scope of scopes as any[]) {
    if (!scopedByApprover.has(scope.approverId)) scopedByApprover.set(scope.approverId, new Set());
    scopedByApprover.get(scope.approverId)!.add(scope.targetUserId);
  }

  // ── Computed stats ──────────────────────────────────────────────────────────
  const allUsers = users as any[];
  const activeCount = allUsers.filter((u) => u.isActive).length;
  const inactiveCount = allUsers.length - activeCount;
  const adminCount = allUsers.filter((u: any) => u.role === "ADMIN" || u.role === "SLT" || u.role === "SUPER_ADMIN").length;
  const activePercent = allUsers.length > 0 ? Math.round((activeCount / allUsers.length) * 100) : 0;

  // ── Server actions ──────────────────────────────────────────────────────────

  async function createUser(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const fullName = String(formData.get("fullName") || "");
    const email = String(formData.get("email") || "").toLowerCase();
    const role = String(formData.get("role") || "TEACHER") as any;
    const password = String(formData.get("password") || "Password123!");
    const hash = await bcrypt.hash(password, 10);
    await (prisma as any).user.create({
      data: {
        tenantId: admin.tenantId,
        fullName,
        email,
        role,
        passwordHash: hash,
        isActive: true,
        canApproveAllLoa: false,
        receivesOnCallEmails: false,
      },
    });
    revalidatePath("/admin/users");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    const active = String(formData.get("active")) === "true";
    await (prisma as any).user.updateMany({ where: { id, tenantId: admin.tenantId }, data: { isActive: !active } });
    revalidatePath("/admin/users");
  }

  async function resetPassword(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    const password = String(formData.get("password") || "Password123!");
    const hash = await bcrypt.hash(password, 10);
    await (prisma as any).user.updateMany({ where: { id, tenantId: admin.tenantId }, data: { passwordHash: hash } });
    revalidatePath("/admin/users");
  }

  async function toggleApproveAllLoa(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    const enabled = String(formData.get("enabled")) === "true";
    await (prisma as any).user.updateMany({ where: { id, tenantId: admin.tenantId }, data: { canApproveAllLoa: !enabled } });
    revalidatePath("/admin/users");
  }

  async function toggleOnCallEmail(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    const enabled = String(formData.get("enabled")) === "true";
    await (prisma as any).user.updateMany({ where: { id, tenantId: admin.tenantId }, data: { receivesOnCallEmails: !enabled } });
    revalidatePath("/admin/users");
  }

  async function addScopedLoaApprover(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const approverId = String(formData.get("approverId") || "");
    const targetUserId = String(formData.get("targetUserId") || "");
    if (!approverId || !targetUserId || approverId === targetUserId) return;

    await (prisma as any).lOAApprovalScope.upsert({
      where: {
        tenantId_approverId_targetUserId: {
          tenantId: admin.tenantId,
          approverId,
          targetUserId,
        },
      },
      update: {},
      create: { tenantId: admin.tenantId, approverId, targetUserId },
    });
    revalidatePath("/admin/users");
  }

  async function removeScopedLoaApprover(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const approverId = String(formData.get("approverId") || "");
    const targetUserId = String(formData.get("targetUserId") || "");
    await (prisma as any).lOAApprovalScope.deleteMany({ where: { tenantId: admin.tenantId, approverId, targetUserId } });
    revalidatePath("/admin/users");
  }

  // Serializable user data for client component
  const tableUsers = allUsers.map((u: any) => ({
    id: u.id as string,
    fullName: u.fullName as string,
    email: u.email as string,
    role: u.role as string,
    isActive: u.isActive as boolean,
    receivesOnCallEmails: u.receivesOnCallEmails as boolean,
    canApproveAllLoa: u.canApproveAllLoa as boolean,
  }));

  // All teachers for scoping dropdowns
  const allTeachers = allUsers
    .filter((u: any) => u.isActive)
    .map((u: any) => ({ id: u.id as string, fullName: u.fullName as string }));

  // Scoped LOA approval targets grouped by approver user id
  const scopedLoaByUser: Record<string, string[]> = {};
  for (const [approverId, targetIds] of scopedByApprover.entries()) {
    scopedLoaByUser[approverId] = Array.from(targetIds);
  }

  // Comprehensive update server action
  async function updateUser(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const userId = String(formData.get("userId") || "");
    const role = String(formData.get("role") || "");
    const receivesOnCallEmails = String(formData.get("receivesOnCallEmails")) === "true";
    const canApproveAllLoa = String(formData.get("canApproveAllLoa")) === "true";
    const scopedLoaRaw = String(formData.get("scopedLoaTargetIds") || "");
    const scopedLoaTargetIds = scopedLoaRaw ? scopedLoaRaw.split(",").filter(Boolean) : [];

    if (!userId) return;

    // Update user fields
    await (prisma as any).user.updateMany({
      where: { id: userId, tenantId: admin.tenantId },
      data: { role, receivesOnCallEmails, canApproveAllLoa },
    });

    // Sync LOA approval scopes: remove old, add new
    await (prisma as any).lOAApprovalScope.deleteMany({
      where: { tenantId: admin.tenantId, approverId: userId },
    });
    if (!canApproveAllLoa && scopedLoaTargetIds.length > 0) {
      await (prisma as any).lOAApprovalScope.createMany({
        data: scopedLoaTargetIds.map((targetUserId) => ({
          tenantId: admin.tenantId,
          approverId: userId,
          targetUserId,
        })),
      });
    }

    revalidatePath("/admin/users");
  }

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader
        eyebrow={<>Internal&ensp;›&ensp;User Directory</>}
        title="User Directory"
        actions={
          <>
            <Link href="/admin/users/import">
              <Button variant="secondary" type="button" className="gap-2">
                <UploadIcon />
                Upload Ledger
              </Button>
            </Link>
            <Link href="/admin/users/import">
              <Button variant="primary" type="button" className="gap-2">
                <AddStaffIcon />
                Add Staff
              </Button>
            </Link>
          </>
        }
      />

      {/* ── Summary stats (KPI row — matches Explorer / Signals) ───── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Staff"
          value={allUsers.length.toLocaleString()}
          tone="glass"
          contextVariant="inline"
          context={
            <span className="font-medium text-muted">
              {activeCount} active · {inactiveCount} inactive
            </span>
          }
        />
        <StatCard
          label="Active Now"
          value={activeCount.toLocaleString()}
          tone="glass"
          contextVariant="inline"
          context={
            <span className="font-medium text-muted">Institutional presence: {activePercent}%</span>
          }
        />
        <StatCard
          label="On Leave"
          value={inactiveCount.toLocaleString()}
          tone="glass"
          contextVariant="inline"
          context={
            inactiveCount > 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-error">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-error" aria-hidden />
                Action required for {Math.min(inactiveCount, 2)}
              </span>
            ) : (
              <span className="font-medium text-muted">All active</span>
            )
          }
        />
        <StatCard
          label="Administrators"
          value={adminCount.toLocaleString()}
          tone="glass"
          contextVariant="inline"
          context={<span className="font-medium text-muted">Core system access</span>}
        />
      </div>

      {/* ── User directory table ───────────────────────────────────── */}
      {allUsers.length === 0 ? (
        <EmptyState title="No users yet" description="Create a user manually or import users from a CSV file." />
      ) : (
        <UserDirectoryTable
          users={tableUsers}
          allTeachers={allTeachers}
          scopedLoaByUser={scopedLoaByUser}
          saveAction={updateUser}
        />
      )}
    </div>
  );
}
