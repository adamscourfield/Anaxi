import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DepartmentsAdminTable } from "./DepartmentsAdminTable";

export default async function AdminDepartmentsPage() {
  const user = await requireAdminUser();

  const departments = await (prisma as any).department.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { name: "asc" },
    include: {
      memberships: {
        include: { user: { select: { id: true, fullName: true } } },
      },
    },
  });

  const allUsers = await (prisma as any).user.findMany({
    where: { tenantId: user.tenantId, isActive: true },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  async function createDepartment(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const name = String(formData.get("name") || "").trim();
    if (!name) return;
    await (prisma as any).department.upsert({
      where: { tenantId_name: { tenantId: admin.tenantId, name } },
      update: {},
      create: { tenantId: admin.tenantId, name },
    });
    revalidatePath("/admin/departments");
  }

  async function renameDepartment(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    const name = String(formData.get("name") || "").trim();
    if (!name || !id) return;
    await (prisma as any).department.updateMany({
      where: { id, tenantId: admin.tenantId },
      data: { name },
    });
    revalidatePath("/admin/departments");
  }

  async function deleteDepartment(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const id = String(formData.get("id"));
    await (prisma as any).department.deleteMany({ where: { id, tenantId: admin.tenantId } });
    revalidatePath("/admin/departments");
  }

  async function addMember(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const departmentId = String(formData.get("departmentId"));
    const userId = String(formData.get("userId") || "");
    if (!userId) return;
    const dept = await (prisma as any).department.findFirst({ where: { id: departmentId, tenantId: admin.tenantId } });
    if (!dept) return;
    await (prisma as any).departmentMembership.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      update: {},
      create: { tenantId: admin.tenantId, departmentId, userId, isHeadOfDepartment: false },
    });
    revalidatePath("/admin/departments");
  }

  async function removeMember(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const departmentId = String(formData.get("departmentId"));
    const userId = String(formData.get("userId"));
    const dept = await (prisma as any).department.findFirst({ where: { id: departmentId, tenantId: admin.tenantId } });
    if (!dept) return;
    await (prisma as any).departmentMembership.deleteMany({ where: { departmentId, userId } });
    revalidatePath("/admin/departments");
  }

  async function toggleHod(formData: FormData) {
    "use server";
    const admin = await requireAdminUser();
    const departmentId = String(formData.get("departmentId"));
    const userId = String(formData.get("userId"));
    const current = String(formData.get("current")) === "true";
    const dept = await (prisma as any).department.findFirst({ where: { id: departmentId, tenantId: admin.tenantId } });
    if (!dept) return;
    await (prisma as any).departmentMembership.updateMany({
      where: { departmentId, userId },
      data: { isHeadOfDepartment: !current },
    });
    revalidatePath("/admin/departments");
  }

  const deptList = departments as any[];

  // Serialize for client component
  const serializedDepts = deptList.map((d: any) => ({
    id: d.id as string,
    name: d.name as string,
    faculty: d.faculty as string | null,
    memberships: (d.memberships as any[]).map((m: any) => ({
      userId: m.userId as string,
      isHeadOfDepartment: m.isHeadOfDepartment as boolean,
      user: { id: m.user.id as string, fullName: m.user.fullName as string },
    })),
  }));

  const serializedUsers = (allUsers as any[]).map((u: any) => ({
    id: u.id as string,
    fullName: u.fullName as string,
  }));

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        variant="ledger"
        eyebrowClassName="anx-eyebrow !text-[#6B7280]"
        eyebrow={
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>Administration</span>
            <span className="text-[#9CA3AF]" aria-hidden>
              &gt;
            </span>
            <span>Academic Departments</span>
          </span>
        }
        title="Academic Departments"
        titleClassName="!text-[#111827]"
        subtitleClassName="anx-page-subtitle !text-[#6B7280]"
        subtitle="Structure your school: departments, heads of department, and staff assignments for the current year."
        actions={
          <>
            <Link
              href="/api/admin/departments/export"
              className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-4 py-2.5 text-[0.8125rem] font-semibold text-[#111827] shadow-sm calm-transition hover:bg-[#F9FAFB]"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 3v14M6 13l4 4 4-4" />
              </svg>
              Export ledger
            </Link>
            <form action={createDepartment} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <input
                name="name"
                placeholder="New department name"
                className="min-h-[2.75rem] w-full min-w-0 flex-1 rounded-xl border border-[#E5E7EB] bg-[var(--surface-container-lowest)] px-4 text-sm text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#CBD5E1] focus:ring-2 focus:ring-[rgba(15,23,42,0.06)] sm:min-w-[12rem] sm:max-w-[220px]"
                required
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white shadow-sm calm-transition hover:bg-[#1e293b]"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
                  <path d="M10 4v12M4 10h12" />
                </svg>
                Add department
              </button>
            </form>
          </>
        }
      />

      {deptList.length === 0 ? (
        <EmptyState title="No departments yet" description="Add your first department using the form above." />
      ) : (
        <DepartmentsAdminTable
          departments={serializedDepts}
          allUsers={serializedUsers}
          deleteDepartmentAction={deleteDepartment}
          addMemberAction={addMember}
          removeMemberAction={removeMember}
          toggleHodAction={toggleHod}
          renameDepartmentAction={renameDepartment}
        />
      )}
    </div>
  );
}
