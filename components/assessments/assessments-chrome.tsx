import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

/** Consistent attainment navigation trail */
export function AssessmentsBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-2">
          {i > 0 ? <span aria-hidden className="text-muted/70">›</span> : null}
          {item.href ? (
            <Link href={item.href} className="calm-transition hover:text-text hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-text">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
