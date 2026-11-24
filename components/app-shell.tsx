"use client";

import { ToastProvider } from "@/components/toast-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}
