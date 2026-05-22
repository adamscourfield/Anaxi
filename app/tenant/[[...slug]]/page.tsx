import { redirect } from "next/navigation";

export default async function TenantCompatPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    redirect("/home");
  }

  const destination = `/${slug.join("/")}`;
  redirect(destination);
}
