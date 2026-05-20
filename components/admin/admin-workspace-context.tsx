"use client";

import { createContext, useContext } from "react";
import type { AdminSectionId } from "@/lib/admin-sections";

type AdminWorkspaceContextValue = {
  selectSection: (section: AdminSectionId) => void;
};

export const AdminWorkspaceContext = createContext<AdminWorkspaceContextValue | null>(null);

export function useAdminWorkspace() {
  return useContext(AdminWorkspaceContext);
}
