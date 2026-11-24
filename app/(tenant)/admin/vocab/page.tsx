import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/admin";

/** Vocabulary is edited on the Language page; this page was a duplicate of that section. */
export default async function AdminVocabPage() {
  await requireAdminUser();
  redirect("/admin/language#vocabulary");
}
