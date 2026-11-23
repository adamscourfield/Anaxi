import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import styles from "@/app/god/god.module.css";
import { notFound } from "next/navigation";
import { requireSuperAdminUser } from "@/lib/admin";
import { getCsrfToken } from "@/lib/csrf";
import { readGodInvitePreview } from "@/lib/godInviteCookie";
import { CsrfInput } from "@/components/CsrfInput";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { H1, H2, MetaText } from "@/components/ui/typography";
import { StatusPill } from "@/components/ui/status-pill";
import { SectionHeader } from "@/components/ui/section-header";

const MODULES = [
  "OBSERVATIONS",
  "SIGNALS",
  "STUDENTS",
  "STUDENTS_IMPORT",
  "LEAVE",
  "ON_CALL",
  "STRATEGY",
  "MEETINGS",
  "TIMETABLE",
  "ADMIN",
  "ADMIN_SETTINGS",
  "ANALYSIS",
  "STUDENT_ANALYSIS",
  "ASSESSMENTS",
] as const;

export default async function SchoolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<{ inviteCreated?: string }>;
}) {
  await requireSuperAdminUser();
  const csrfToken = await getCsrfToken();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const invitePreview =
    resolvedSearchParams?.inviteCreated === "1" ? await readGodInvitePreview(resolvedParams.tenantId) : null;

  const school = await prisma.tenant.findUnique({
    where: { id: resolvedParams.tenantId },
    include: {
      features: true,
      users: {
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true, email: true, role: true, isActive: true },
      },
      adminInvites: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!school) notFound();

  const settings = await (prisma as any).tenantSettings.findUnique({ where: { tenantId: school.id } });
  const schoolType = settings?.schoolType ?? "SECONDARY";

  const enabled = new Set(school.features.filter((f) => f.enabled).map((f) => f.key));
  const statusLabel = school.status.charAt(0) + school.status.slice(1).toLowerCase();

  return (
    <div className={styles.page}>
      {invitePreview ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Invite created.</div>
          <MetaText>
            An invite email was sent to the admin. You can also copy the link below if needed.
          </MetaText>
          <details className="mt-2">
            <summary className="link-underline cursor-pointer text-xs text-muted">Show invite link</summary>
            <div className="mt-1 break-all text-xs">{invitePreview}</div>
          </details>
        </Card>
      ) : null}
      <Link href="/god" className={styles.backLink}>← Schools</Link>
      <PageHeader variant="ledger" title={school.name} subtitle={`${school.slug ?? "No slug set"} · ${statusLabel}`} />
      <nav className={styles.jumpNav} aria-label="School settings"><a href="#school-configuration">Configuration</a><a href="#school-modules">Modules</a><a href="#school-admins">Administrators</a><a href="#school-invites">Invitations</a><Link href={`/god/audit?tenantId=${school.id}`}>School activity</Link></nav>
      <div id="school-configuration" className={styles.settingsGrid}>
      <Card>
        <form method="post" action={`/api/god/schools/${school.id}/status`} className={styles.inlineForm}>
          <CsrfInput token={csrfToken} />
          <label>
            Status
            <select name="status" defaultValue={school.status} className="field">
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">Save status</Button>
        </form>
      </Card>

      <Card>
        <form method="post" action={`/api/god/schools/${school.id}/school-type`} className={styles.inlineForm}>
          <CsrfInput token={csrfToken} />
          <label>
            School type
            <select name="schoolType" defaultValue={schoolType} className="field">
              <option value="SECONDARY">Secondary</option>
              <option value="PRIMARY">Primary</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">Save type</Button>
        </form>
        <MetaText className="mt-2">
          Sets the school’s observation signal catalogue.
        </MetaText>
      </Card>

      </div>
      <Card id="school-modules">
        <form method="post" action={`/api/god/schools/${school.id}/modules`} className="space-y-3">
          <CsrfInput token={csrfToken} />
          <H2>Modules</H2>
          <div className={styles.moduleGrid}>
            {MODULES.map((m) => (
              <label key={m} className="flex items-center gap-2.5 rounded-[10px] border border-[#e5e5e6] bg-white px-3 py-2.5 text-sm calm-transition hover:bg-[#fafafa]">
                <input type="checkbox" name="modules" value={m} defaultChecked={enabled.has(m)} />
                {m.toLowerCase().split("_").map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ")}
              </label>
            ))}
          </div>
          <Button type="submit">Save modules</Button>
        </form>
      </Card>

      <Card id="school-admins">
        <SectionHeader title="Administrators" subtitle={`${school.users.length} admin account${school.users.length === 1 ? "" : "s"}`} />
        <ul className="mt-2">
          {school.users.map((u) => (
            <li key={u.id} className={styles.adminRow}>
              <strong>{u.fullName}</strong>
              <span>{u.email}</span>
              <StatusPill variant="neutral" size="sm">{u.role === "SUPER_ADMIN" ? "Super user" : "Administrator"}</StatusPill>
              <StatusPill variant={u.isActive ? "success" : "neutral"} size="sm">{u.isActive ? "Active" : "Inactive"}</StatusPill>
            </li>
          ))}
          {school.users.length === 0 ? <li className="py-3 text-sm text-muted">No administrators yet. Invite one below.</li> : null}
        </ul>
      </Card>

      <Card id="school-invites">
        <form method="post" action={`/api/god/schools/${school.id}/invites`} className="space-y-3">
          <CsrfInput token={csrfToken} />
          <H2>Invite school admin</H2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted">Full name<input required name="fullName" placeholder="Full name" className="field" /></label>
            <label className="grid gap-1 text-xs text-muted">Email<input required type="email" name="email" placeholder="Email" className="field" /></label>
          </div>
          <Button type="submit">Create invite link</Button>
        </form>
      </Card>

      <Card>
        <SectionHeader title="Recent invites" />
        <ul className="mt-2 space-y-2 text-sm">
          {school.adminInvites.map((i) => {
            const isAccepted = Boolean(i.acceptedAt);
            const isExpired = !isAccepted && new Date(i.expiresAt).getTime() < Date.now();
            return (
              <li key={i.id} className="rounded-[10px] border border-[#e5e5e6] p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="break-all">{i.fullName} · {i.email}</div>
                    <MetaText>
                      {isAccepted
                        ? `Accepted ${new Date(i.acceptedAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                        : isExpired
                          ? "Expired"
                          : `Expires ${new Date(i.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                    </MetaText>
                  </div>
                  {!isAccepted ? (
                    <div className="flex gap-1">
                      <form method="post" action={`/api/god/schools/${school.id}/invites/${i.id}/resend`}>
                        <CsrfInput token={csrfToken} />
                        <Button variant="secondary" type="submit" className="h-8 px-3 py-0 text-xs">Resend</Button>
                      </form>
                      {!isExpired ? (
                        <form method="post" action={`/api/god/schools/${school.id}/invites/${i.id}/revoke`}>
                          <CsrfInput token={csrfToken} />
                          <Button variant="ghost" type="submit" className="h-8 px-3 py-0 text-xs text-error">Revoke</Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
          {school.adminInvites.length === 0 ? <li className="text-muted">No invites sent yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
