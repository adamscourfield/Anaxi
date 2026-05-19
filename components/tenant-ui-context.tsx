"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FeatureKey, UserRole } from "@/lib/types";

type TenantUiContextValue = {
  role: UserRole;
  enabledFeatures: FeatureKey[];
};

const TenantUiContext = createContext<TenantUiContextValue | null>(null);

export function TenantUiProvider({
  role,
  enabledFeatures,
  children,
}: TenantUiContextValue & { children: ReactNode }) {
  return (
    <TenantUiContext.Provider value={{ role, enabledFeatures }}>
      {children}
    </TenantUiContext.Provider>
  );
}

export function useTenantUi(): TenantUiContextValue {
  const ctx = useContext(TenantUiContext);
  if (!ctx) {
    throw new Error("useTenantUi must be used within TenantUiProvider");
  }
  return ctx;
}

export function useTenantUiOptional(): TenantUiContextValue | null {
  return useContext(TenantUiContext);
}
