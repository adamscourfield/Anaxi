import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-8">
      <PageHeader
        eyebrow={<>Administration&ensp;›&ensp;Academic Departments</>}
        eyebrowClassName="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/55"
        title="Academic Departments"
        titleClassName="text-pretty text-[clamp(1.75rem,4vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.035em] text-text"
        subtitle="Structure your school: departments, heads of department, and staff assignments for the current year."
        subtitleClassName="max-w-full text-pretty text-sm font-medium leading-relaxed text-muted/90 md:max-w-2xl"
        className="border-b border-[color-mix(in_srgb,var(--outline-variant)_22%,transparent)] pb-8"
        actions={
          <>
            <Link href="/api/admin/departments/export">
              <Button type="button" variant="secondary" className="gap-2 rounded-full border border-border/80 bg-surface-container-lowest px-4 py-2.5 shadow-sm hover:bg-surface-container-low">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 3v14M6 13l4 4 4-4" />
                </svg>
                Export ledger
              </Button>
            </Link>
            <form action={createDepartment} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                name="name"
                placeholder="New department name"
                className="w-full min-w-[12rem] rounded-full border border-border/60 bg-surface-container-lowest/90 px-4 py-2.5 text-sm text-text shadow-inner placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/25 sm:w-52"
                required
              />
              <Button type="submit" className="gap-2 shrink-0 rounded-full px-5">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 4v12M4 10h12" />
                </svg>
                Add department
              </Button>
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
