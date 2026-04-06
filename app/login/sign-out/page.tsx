import { Suspense } from "react";
import SignOutContent from "./sign-out-content";

function SignOutFallback() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "var(--surface-bright)", color: "var(--on-surface-variant)" }}
    >
      <p className="text-sm">Loading…</p>
    </div>
  );
}

export default function SignOutPage() {
  return (
    <Suspense fallback={<SignOutFallback />}>
      <SignOutContent />
    </Suspense>
  );
}
