import { redirect } from "next/navigation";
import { adminSectionPath } from "@/lib/admin-sections";

export default function AdminDepartmentsPage() {
  redirect(adminSectionPath("departments"));
}
