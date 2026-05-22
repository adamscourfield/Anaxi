import { redirect } from "next/navigation";
import { adminSectionPath } from "@/lib/admin-sections";

export default async function AdminSettingsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
  const resolvedSearchParams = await searchParams;
  if (resolvedSearchParams?.tab === "modules") {
    redirect("/admin/features");
  }
  redirect(adminSectionPath("settings"));
}
