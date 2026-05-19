import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NotFoundScreen({
  homeHref,
  homeLabel,
}: {
  homeHref: string;
  homeLabel: string;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center space-y-8 px-6 py-16 text-center sm:items-start sm:text-left">
      <Image src="/anaxi-logo.png" alt="Anaxi" width={40} height={40} className="h-10 w-10 object-contain" />
      <div className="anx-page-header-shell w-full space-y-2">
        <p className="anx-eyebrow">404</p>
        <h1 className="anx-page-title">Page not found</h1>
        <p className="anx-page-subtitle">
          This address does not exist, or you may not have permission to view it. Check the URL or
          return to a page you can access.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
        <Button asChild>
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
