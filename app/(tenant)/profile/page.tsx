import { getSessionUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { avatarUrlFor } from "@/lib/avatarUpload";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import styles from "./page.module.css";
import { updateOwnAvatar } from "./actions";

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  SLT: "Senior Leadership",
  HOD: "Head of Department",
  LEADER: "Leader",
  TEACHER: "Teacher",
  SUPPORT: "Support",
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
      avatarUpdatedAt: true,
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
    <div className={styles.page}>
      <PageHeader variant="ledger" title="Your profile" subtitle="Account details and permissions." />

      {/* Avatar + name */}
      <Card className={styles.identity}>
        <AvatarUploader
          name={fullUser?.fullName ?? "?"}
          avatarUrl={avatarUrlFor(user.id, fullUser?.avatarUpdatedAt)}
          uploadAction={updateOwnAvatar}
        />
        <div className={styles.accountDetails}>
          <p className="text-lg font-semibold text-text">{fullUser?.fullName}</p>
          <p className="text-sm text-muted">{fullUser?.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={styles.role}>{ROLE_LABELS[fullUser?.role] ?? fullUser?.role}</span>
            {fullUser?.isActive ? (
              <span className={styles.active}><i aria-hidden="true" />Active</span>
            ) : (
              <StatusPill variant="error" size="sm">Inactive</StatusPill>
            )}
          </div>
        </div>
      </Card>

      {/* School */}
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 9h.01M15 9h.01M9 12h.01M15 12h.01" /></svg></span>School</h2>
        <p className="text-sm font-medium text-text">{tenant?.name ?? "—"}</p>
      </Card>

      {/* Departments */}
      {departments.length > 0 && (
        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" /></svg></span>Departments</h2>
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
      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7zM8 12l3 3 5-5" /></svg></span>Permissions</h2>
        <div className={styles.permissions}>
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
