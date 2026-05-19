"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AppErrorFallback({
  reset,
  error,
  homeHref = "/home",
  homeLabel = "Home",
  description = "This page could not be loaded. Try again or return home.",
}: {
  reset: () => void;
  error?: Error & { digest?: string };
  homeHref?: string;
  homeLabel?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <div className="anx-page-header-shell space-y-2">
        <p className="anx-eyebrow">Error</p>
        <h1 className="anx-page-title">Something went wrong</h1>
        <p className="anx-page-subtitle">{description}</p>
        {error?.digest ? (
          <p className="text-2xs font-mono text-muted">
            Reference: <span className="select-all">{error.digest}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button variant="secondary" asChild>
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
