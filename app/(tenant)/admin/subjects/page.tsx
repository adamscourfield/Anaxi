import { redirect } from "next/navigation";
import { adminSectionPath } from "@/lib/admin-sections";

export default async function AdminSubjectsPage() {
  redirect(adminSectionPath("subjects"));
}
