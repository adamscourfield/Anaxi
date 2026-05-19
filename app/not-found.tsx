import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { NotFoundScreen } from "@/components/ui/not-found-screen";

export default async function NotFound() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  const isAuthed = Boolean(user?.role);
  const homeHref = !isAuthed ? "/login" : user?.role === "SUPER_ADMIN" ? "/god" : "/home";
  const homeLabel = !isAuthed ? "Sign in" : user?.role === "SUPER_ADMIN" ? "God Mode" : "Home";

  return <NotFoundScreen homeHref={homeHref} homeLabel={homeLabel} />;
}
