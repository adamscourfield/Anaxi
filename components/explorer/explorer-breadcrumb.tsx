import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";

export function ExplorerBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <Breadcrumb
      items={[{ label: "Explorer", href: "/explorer" }, ...items]}
      className="mb-1"
    />
  );
}

export function AnalysisBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <Breadcrumb
      items={[{ label: "Explorer", href: "/explorer" }, { label: "Analysis", href: "/explorer/analysis" }, ...items]}
      className="mb-1"
    />
  );
}
