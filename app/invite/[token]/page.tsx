import { createHash } from "crypto";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AuthBackLink, AuthCard, AuthFieldLabel, AuthPageHeader } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function InviteAcceptPage({ params }: { params: { token: string } }) {
  const invite = await (prisma as any).schoolAdminInvite.findUnique({
    where: { tokenHash: hashToken(params.token) },
    include: { tenant: true },
  });

  if (!invite) notFound();

  const expired = invite.acceptedAt || new Date(invite.expiresAt).getTime() < Date.now();

  return (
    <>
      <AuthPageHeader
        title="School admin invite"
        subtitle="Set a password to accept this invite and open your school workspace."
      />

      <AuthCard>
        {expired ? (
          <div className="space-y-4 py-2 text-center">
            <p className="text-[15px] font-semibold text-text">Invite unavailable</p>
            <p className="text-sm text-muted">
              This invite link has expired or was already used. Ask your school administrator to send a new invite.
            </p>
            <Button asChild variant="secondary" className="w-full">
              <a href="/login">Return to sign in</a>
            </Button>
          </div>
        ) : (
          <form method="post" action="/api/invite/accept" className="space-y-5">
            <p className="text-[13px] leading-relaxed text-muted">
              <span className="font-medium text-text">{invite.fullName}</span>
              <span className="text-muted"> · </span>
              {invite.email}
              <span className="text-muted"> · </span>
              {invite.tenant.name}
            </p>
            <div className="space-y-2">
              <AuthFieldLabel htmlFor="password">Password</AuthFieldLabel>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="field"
              />
            </div>
            <input type="hidden" name="token" value={params.token} />
            <Button type="submit" className="w-full">
              Accept invite
            </Button>
          </form>
        )}
      </AuthCard>

      <AuthBackLink href="/login" />
    </>
  );
}
