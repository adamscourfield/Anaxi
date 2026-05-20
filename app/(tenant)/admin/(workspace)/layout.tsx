import { requireAdminUser } from "@/lib/admin";
import { AdminWorkspace } from "@/components/admin/admin-workspace";

export default async function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser();
  return <AdminWorkspace role={user.role}>{children}</AdminWorkspace>;
}
