"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { AppShell } from "@/components/app-shell";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <AppShell>{children}</AppShell>
    </NextAuthSessionProvider>
  );
}
