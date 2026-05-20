import { Suspense } from "react";
import { requireAdminUser } from "@/lib/admin";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { AdminWorkspaceShellFallback } from "@/components/admin/admin-workspace-shell";

export default async function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser();
  return (
    <Suspense fallback={<AdminWorkspaceShellFallback />}>
      <AdminWorkspace role={user.role}>{children}</AdminWorkspace>
    </Suspense>
  );
}
