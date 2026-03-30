import { notFound } from "next/navigation";
import { requireSuperAdminUser } from "@/lib/admin";
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
  "BEHAVIOUR_IMPORT",
  "LEAVE",
  "ON_CALL",
  "MEETINGS",
  "TIMETABLE",
  "ADMIN",
  "ADMIN_SETTINGS",
  "ANALYSIS",
  "STUDENT_ANALYSIS",
  "ASSESSMENTS",
] as const;

export default async function SchoolDetailPage({ params, searchParams }: { params: { tenantId: string }, searchParams?: { invite?: string } }) {
  await requireSuperAdminUser();

  const school = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
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

  const enabled = new Set(school.features.filter((f) => f.enabled).map((f) => f.key));

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      {searchParams?.invite ? (
        <Card className="border-success/30 bg-[var(--pill-success-bg)]">
          <div className="font-medium text-success">Invite created.</div>
          <MetaText>Copy this one-time link and send it securely to the admin.</MetaText>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs underline">Show invite link</summary>
            <div className="mt-1 break-all text-xs">{decodeURIComponent(searchParams.invite)}</div>
          </details>
        </Card>
      ) : null}
      <div>
        <H1>{school.name}</H1>
        <MetaText>{school.id} · {school.slug ?? "no-slug"} · {school.status}</MetaText>
      </div>

      <Card>
        <form method="post" action={`/api/god/schools/${school.id}/status`} className="flex items-end gap-3">
          <label className="text-sm font-medium">
            Status
            <select name="status" defaultValue={school.status} className="field ml-2">
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
          </label>
          <Button type="submit">Update</Button>
        </form>
      </Card>

      <Card>
        <form method="post" action={`/api/god/schools/${school.id}/modules`} className="space-y-3">
          <H2>Modules</H2>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {MODULES.map((m) => (
              <label key={m} className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-surface/60 px-3 py-2 text-sm calm-transition hover:border-accent/30 hover:bg-[var(--accent-tint)]">
                <input type="checkbox" name="modules" value={m} defaultChecked={enabled.has(m)} className="accent-accent" />
                {m}
              </label>
            ))}
          </div>
          <Button type="submit">Save modules</Button>
        </form>
      </Card>

      <Card>
        <SectionHeader title="Admins" subtitle={`${school.users.length} admin account${school.users.length === 1 ? "" : "s"}`} />
        <ul className="mt-2 space-y-1.5 text-sm">
          {school.users.map((u) => (
            <li key={u.id} className="flex items-center gap-2">
              <span>{u.fullName} · {u.email}</span>
              <StatusPill variant={u.isActive ? "success" : "neutral"} size="sm">{u.isActive ? "Active" : "Inactive"}</StatusPill>
              <StatusPill variant="neutral" size="sm">{u.role}</StatusPill>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <form method="post" action={`/api/god/schools/${school.id}/invites`} className="space-y-3">
          <H2>Invite school admin</H2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input required name="fullName" placeholder="Full name" className="field" />
            <input required type="email" name="email" placeholder="Email" className="field" />
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
              <li key={i.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div>{i.fullName} · {i.email}</div>
                    <MetaText>
                      {isAccepted
                        ? `accepted ${new Date(i.acceptedAt!).toLocaleDateString("en-GB")}`
                        : isExpired
                          ? "expired"
                          : `expires ${new Date(i.expiresAt).toLocaleDateString("en-GB")}`}
                    </MetaText>
                  </div>
                  {!isAccepted ? (
                    <div className="flex gap-1">
                      <form method="post" action={`/api/god/schools/${school.id}/invites/${i.id}/resend`}>
                        <Button variant="secondary" type="submit" className="px-2 py-1 text-xs">Resend</Button>
                      </form>
                      {!isExpired ? (
                        <form method="post" action={`/api/god/schools/${school.id}/invites/${i.id}/revoke`}>
                          <Button variant="ghost" type="submit" className="px-2 py-1 text-xs">Revoke</Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
          {school.adminInvites.length === 0 ? <li className="text-muted">No invites yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
