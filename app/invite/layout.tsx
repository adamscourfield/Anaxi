import { AuthFlowMain, AuthNav, AuthShell } from "@/components/auth-shell";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell variant="light">
      <AuthNav />
      <AuthFlowMain>{children}</AuthFlowMain>
    </AuthShell>
  );
}
