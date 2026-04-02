import { redirect } from "next/navigation";

export default async function StudentAnalysisRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/students/${params.id}`);
}
