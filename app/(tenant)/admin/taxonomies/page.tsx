import { redirect } from "next/navigation";
import { adminSectionPath } from "@/lib/admin-sections";

export default function AdminTaxonomiesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tabParam = Array.isArray(searchParams?.tab) ? searchParams.tab[0] : searchParams?.tab;
  redirect(adminSectionPath("taxonomies", tabParam ? { tab: tabParam } : undefined));
}
