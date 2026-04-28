"use client";

import { ToastProvider } from "@/components/toast-provider";
import { NavigationProgress } from "@/components/navigation-progress";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <NavigationProgress />
      {children}
    </ToastProvider>
  );
}
