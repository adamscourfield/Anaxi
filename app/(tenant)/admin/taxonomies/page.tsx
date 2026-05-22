import { redirect } from "next/navigation";
import { adminSectionPath } from "@/lib/admin-sections";

export default async function AdminTaxonomiesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  redirect(adminSectionPath("taxonomies", tabParam ? { tab: tabParam } : undefined));
}
