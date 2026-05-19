"use client";

import { AppErrorFallback } from "@/components/ui/app-error-fallback";

export default function TenantError({
  reset,
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppErrorFallback
      reset={reset}
      error={error}
      homeHref="/home"
      homeLabel="Home"
      description="This page could not be loaded. Try again or go back to home."
    />
  );
}
