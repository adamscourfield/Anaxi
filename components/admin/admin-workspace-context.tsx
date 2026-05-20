"use client";

import { createContext, useContext } from "react";
import type { AdminSectionId } from "@/lib/admin-sections";
import type { AdminSectionExtra } from "@/lib/admin-workspace-nav";

type AdminWorkspaceContextValue = {
  selectSection: (section: AdminSectionId, extra?: AdminSectionExtra) => void;
};

export const AdminWorkspaceContext = createContext<AdminWorkspaceContextValue | null>(null);

export function useAdminWorkspace() {
  return useContext(AdminWorkspaceContext);
}
