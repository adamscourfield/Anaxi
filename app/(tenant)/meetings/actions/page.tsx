import { redirect } from "next/navigation";

/** Legacy route — consolidated into /my-actions (UX-021). */
export default function MeetingsActionsRedirect() {
  redirect("/my-actions");
}
