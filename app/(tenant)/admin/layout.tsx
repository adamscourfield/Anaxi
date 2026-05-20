import { requireAdminUser } from "@/lib/admin";
import { AdminHubShell } from "@/components/admin/admin-hub-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser();
  return <AdminHubShell role={user.role}>{children}</AdminHubShell>;
}
