import { redirect } from "next/navigation";
import { adminSectionPath } from "@/lib/admin-sections";

export default function AdminLeaveApprovalsPage() {
  redirect(adminSectionPath("leave-approvals"));
}
