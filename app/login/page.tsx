import { Suspense } from "react";
import { LoginClient } from "./login-client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-[var(--surface-bright)] text-sm text-[var(--on-surface-variant)]">
          Loading…
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
