"use client";

import { ReactNode } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { ToastProvider } from "@/components/toast-provider";

/** Global chrome: navigation feedback + toasts. Wrap inside SessionProvider. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <NavigationProgress />
      {children}
    </ToastProvider>
  );
}
