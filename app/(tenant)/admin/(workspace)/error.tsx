"use client";

import { AppErrorFallback } from "@/components/ui/app-error-fallback";

export default function AdminWorkspaceError({
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
      homeHref="/admin"
      homeLabel="Administration"
      description="This admin section could not be loaded. Try again or return to the admin overview."
    />
  );
}
