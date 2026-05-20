import { redirect } from "next/navigation";
import { adminSectionPath } from "@/lib/admin-sections";

export default function AdminSettingsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  if (searchParams?.tab === "modules") {
    redirect("/admin/features");
  }
  redirect(adminSectionPath("settings"));
}
