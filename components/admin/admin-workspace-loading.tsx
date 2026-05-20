"use client";

import { useSearchParams } from "next/navigation";
import { parseAdminSection } from "@/lib/admin-sections";
import { AdminPanelSkeleton } from "@/components/admin/admin-panel-skeleton";

/** Route-level loading UI: skeleton shape matches the target section query param. */
export function AdminWorkspaceLoading() {
  const searchParams = useSearchParams();
  const section = parseAdminSection(searchParams.get("section"));
  return <AdminPanelSkeleton section={section} />;
}
