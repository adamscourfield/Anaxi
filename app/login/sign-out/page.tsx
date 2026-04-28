import { Suspense } from "react";
import SignOutContent from "./sign-out-content";
import { AuthFlowMain, AuthNav, AuthShell } from "@/components/auth-shell";

function SignOutFallback() {
  return (
    <AuthShell variant="light">
      <AuthNav />
      <AuthFlowMain>
        <p className="text-center text-sm text-muted">Loading…</p>
      </AuthFlowMain>
    </AuthShell>
  );
}

export default function SignOutPage() {
  return (
    <Suspense fallback={<SignOutFallback />}>
      <SignOutContent />
    </Suspense>
  );
}
