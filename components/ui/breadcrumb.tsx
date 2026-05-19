import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

export function Breadcrumb({ items, className = "" }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted ${className}`.trim()}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden className="text-muted/70">›</span> : null}
            {item.href && !isLast ? (
              <Link href={item.href} className="link-subtle calm-transition text-muted hover:text-text">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-text" aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
