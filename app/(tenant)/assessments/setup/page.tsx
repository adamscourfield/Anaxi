import { redirect } from "next/navigation";

// Legacy redirect — setup moved to /assessments/new
export default function LegacySetupPage() {
  redirect("/assessments/new");
}
