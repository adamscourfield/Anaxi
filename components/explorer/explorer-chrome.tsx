import Link from "next/link";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";

/** Standard breadcrumb row above child explorer pages (UX-024). */
export function ExplorerBackLink({
  section,
  sectionHref,
  detail,
}: {
  section?: string;
  sectionHref?: string;
  detail?: string;
}) {
  const items: BreadcrumbItem[] = [{ label: "Explorer", href: "/explorer" }];
  if (section) items.push({ label: section, href: sectionHref });
  if (detail) items.push({ label: detail });

  if (items.length > 1) {
    return (
      <nav className="mb-6" aria-label="Breadcrumb">
        <Breadcrumb items={items} />
      </nav>
    );
  }

  return (
    <div className="mb-6">
      <Link
        href="/explorer"
        className="link-muted-accent inline-flex items-center gap-1.5 text-[0.8125rem] font-medium"
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Explorer
      </Link>
    </div>
  );
}
