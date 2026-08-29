import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  SLT: "Senior Leadership",
  HOD: "Head of Department",
  LEADER: "Leader",
  TEACHER: "Teacher",
};

export default async function ProfilePage() {
  const user = await getSessionUserOrThrow();
  const fullUser = await (prisma as any).user.findFirst({
    where: { id: user.id, tenantId: user.tenantId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      canApproveAllLoa: true,
      receivesOnCallEmails: true,
      receivesFirstAidEmails: true,
      tenant: { select: { name: true } },
      departmentMemberships: {
        include: { department: { select: { name: true } } },
      },
    },
  });

  const tenant = fullUser?.tenant;
  const departments = (fullUser?.departmentMemberships as any[]) ?? [];
  const hodDepts = departments.filter((m: any) => m.isHeadOfDepartment);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader variant="ledger" title="Your Profile" subtitle="Account details and permissions." />

      {/* Avatar + name */}
      <Card className="flex items-center gap-5">
        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-primary text-xl font-bold text-on-primary">
          {(fullUser?.fullName ?? "?")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((n: string) => n[0])
            .join("")
            .toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-text">{fullUser?.fullName}</p>
          <p className="text-sm text-muted">{fullUser?.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusPill variant="accent" size="sm">{ROLE_LABELS[fullUser?.role] ?? fullUser?.role}</StatusPill>
            {fullUser?.isActive ? (
              <StatusPill variant="success" size="sm">Active</StatusPill>
            ) : (
              <StatusPill variant="error" size="sm">Inactive</StatusPill>
            )}
          </div>
        </div>
      </Card>

      {/* School */}
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">School</p>
        <p className="text-sm font-medium text-text">{tenant?.name ?? "—"}</p>
      </Card>

      {/* Departments */}
      {departments.length > 0 && (
        <Card className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Departments</p>
          <ul className="space-y-1.5">
            {departments.map((m: any) => (
              <li key={m.id} className="flex items-center gap-2 text-sm text-text">
                <span>{m.department?.name}</span>
                {m.isHeadOfDepartment && <StatusPill variant="accent" size="sm">HOD</StatusPill>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Permissions summary */}
      <Card className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Permissions</p>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <span className="text-muted">Approve all leave</span>
            <span className={`font-medium ${fullUser?.canApproveAllLoa ? "text-accent" : "text-muted"}`}>
              {fullUser?.canApproveAllLoa ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <span className="text-muted">On-call emails</span>
            <span className={`font-medium ${fullUser?.receivesOnCallEmails ? "text-accent" : "text-muted"}`}>
              {fullUser?.receivesOnCallEmails ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
            <span className="text-muted">First aid emails</span>
            <span className={`font-medium ${fullUser?.receivesFirstAidEmails ? "text-accent" : "text-muted"}`}>
              {fullUser?.receivesFirstAidEmails ? "Yes" : "No"}
            </span>
          </div>
          {hodDepts.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 sm:col-span-2">
              <span className="text-muted">Head of department</span>
              <span className="font-medium text-accent">{hodDepts.map((d: any) => d.department?.name).join(", ")}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
