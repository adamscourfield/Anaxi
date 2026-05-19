"use client";

import { AppErrorFallback } from "@/components/ui/app-error-fallback";

export default function RootError({
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
      homeHref="/login"
      homeLabel="Sign in"
      description="An unexpected error occurred. Try again or return to sign in."
    />
  );
}
