import { createHash } from "crypto";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import styles from "../../login/login.module.css";
import { InviteForm } from "./invite-form";
import { Button } from "@/components/ui/button";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  const invite = await (prisma as any).schoolAdminInvite.findUnique({
    where: { tokenHash: hashToken(resolvedParams.token) },
    include: { tenant: true },
  });

  if (!invite) notFound();

  const expired = invite.acceptedAt || new Date(invite.expiresAt).getTime() < Date.now();

  return (
    <>
      <h1 className={styles.title}>Accept invitation<span>.</span></h1>
      <p className={styles.subtitle}>Set a password to accept your school admin invitation and open your workspace.</p>
      <div className={styles.card}>
        {expired ? (
          <div className="space-y-4 py-2 text-center" role="alert">
            <p className={styles.successTitle}>Invite unavailable</p>
            <p className={styles.help}>
              This invite link has expired or was already used. Ask your school administrator to send a new invite.
            </p>
            <Button asChild variant="secondary" className={`${styles.button} ${styles.secondary}`}>
              <a href="/login">Return to sign in</a>
            </Button>
          </div>
        ) : (
          <InviteForm token={resolvedParams.token} fullName={invite.fullName} email={invite.email} schoolName={invite.tenant.name} />
        )}
      </div>

      <div className="mt-7 flex justify-center">
        <Link href="/login" className={styles.forgot}>← Back to sign in</Link>
      </div>
    </>
  );
}
