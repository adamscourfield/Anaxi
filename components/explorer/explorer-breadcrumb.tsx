import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";

export function ExplorerBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <Breadcrumb
      items={[{ label: "Insights", href: "/insights" }, ...items]}
      className="mb-1"
    />
  );
}

export function AnalysisBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <Breadcrumb
      items={[{ label: "Insights", href: "/insights" }, { label: "Analysis", href: "/insights/students/patterns" }, ...items]}
      className="mb-1"
    />
  );
}
