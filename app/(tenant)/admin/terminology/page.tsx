import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin";

export default async function AdminTerminologyPage() {
  await requireAdminUser();
  redirect("/admin/language");
}
