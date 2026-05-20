import { requireAdminUser } from "@/lib/admin";
import { parseAdminSection } from "@/lib/admin-sections";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { OverviewAdminPanel } from "@/components/admin/panels/overview-panel";
import { UsersAdminPanel } from "@/app/(tenant)/admin/(panels)/users";
import { DepartmentsAdminPanel } from "@/app/(tenant)/admin/(panels)/departments";
import { CoachingAdminPanel } from "@/app/(tenant)/admin/(panels)/coaching";
import { LeaveApprovalsAdminPanel } from "@/app/(tenant)/admin/(panels)/leave-approvals";
import { SettingsAdminPanel } from "@/app/(tenant)/admin/(panels)/settings";
import { LanguageAdminPanel } from "@/app/(tenant)/admin/(panels)/language";
import { SignalsAdminPanel } from "@/app/(tenant)/admin/(panels)/signals";
import { EmailLogAdminPanel } from "@/app/(tenant)/admin/(panels)/email-log";
import { TaxonomiesAdminPanel } from "@/app/(tenant)/admin/(panels)/taxonomies";
import { TimetableAdminPanel } from "@/app/(tenant)/admin/(panels)/timetable";
import { ImportsAdminPanel } from "@/app/(tenant)/admin/(panels)/imports";
import StaffImportPage from "@/app/(tenant)/admin/users/import/page";

export default async function AdminWorkspacePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireAdminUser();
  const section = parseAdminSection(searchParams?.section);

  return (
    <AdminWorkspace
      role={user.role}
      initialSection={section}
      panels={{
        overview: <OverviewAdminPanel />,
        users: <UsersAdminPanel />,
        usersImport: <StaffImportPage />,
        departments: <DepartmentsAdminPanel />,
        coaching: <CoachingAdminPanel />,
        leaveApprovals: <LeaveApprovalsAdminPanel />,
        settings: <SettingsAdminPanel />,
        language: <LanguageAdminPanel />,
        signals: <SignalsAdminPanel />,
        emailLog: <EmailLogAdminPanel />,
        taxonomies: <TaxonomiesAdminPanel searchParams={searchParams} />,
        timetable: <TimetableAdminPanel />,
        imports: <ImportsAdminPanel />,
      }}
    />
  );
}
