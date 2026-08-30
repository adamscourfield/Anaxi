import type { ReactNode } from "react";
import type { AdminSectionId } from "@/lib/admin-sections";
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
import { SubjectsAdminPanel } from "@/app/(tenant)/admin/(panels)/subjects";
import { TimetableAdminPanel } from "@/app/(tenant)/admin/(panels)/timetable";
import { ImportsAdminPanel } from "@/app/(tenant)/admin/(panels)/imports";
import StaffImportPage from "@/app/(tenant)/admin/users/import/page";

export async function renderAdminPanel(
  section: AdminSectionId,
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<ReactNode> {
  switch (section) {
    case "overview":
      return <OverviewAdminPanel />;
    case "users":
      return <UsersAdminPanel />;
    case "users-import":
      return <StaffImportPage />;
    case "departments":
      return <DepartmentsAdminPanel />;
    case "coaching":
      return <CoachingAdminPanel />;
    case "leave-approvals":
      return <LeaveApprovalsAdminPanel />;
    case "settings":
      return <SettingsAdminPanel />;
    case "language":
      return <LanguageAdminPanel />;
    case "signals":
      return <SignalsAdminPanel />;
    case "email-log":
      return <EmailLogAdminPanel />;
    case "taxonomies":
      return <TaxonomiesAdminPanel searchParams={searchParams} />;
    case "subjects":
      return <SubjectsAdminPanel />;
    case "timetable":
      return <TimetableAdminPanel />;
    case "imports":
      return <ImportsAdminPanel />;
    default:
      return <OverviewAdminPanel />;
  }
}
