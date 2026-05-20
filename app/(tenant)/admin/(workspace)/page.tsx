import { Suspense } from "react";
import { parseAdminSection } from "@/lib/admin-sections";
import { renderAdminPanel } from "@/app/(tenant)/admin/(panels)/render-panel";
import { AdminPanelSkeleton } from "@/components/admin/admin-panel-skeleton";

export default async function AdminWorkspacePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const section = parseAdminSection(searchParams?.section);
  const panel = await renderAdminPanel(section, searchParams);

  return <Suspense fallback={<AdminPanelSkeleton />}>{panel}</Suspense>;
}
