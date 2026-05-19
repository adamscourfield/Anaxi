"use client";

export default function TenantError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold text-text">Something went wrong</h1>
      <p className="mt-2 text-sm text-text-muted">
        This page could not be loaded. Try again or go back to home.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Try again
        </button>
        <a href="/home" className="rounded-md border border-border px-4 py-2 text-sm">
          Home
        </a>
      </div>
    </div>
  );
}
