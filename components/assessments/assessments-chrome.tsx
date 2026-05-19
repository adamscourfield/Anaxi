import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";

export type { BreadcrumbItem };

/** Consistent attainment navigation trail */
export function AssessmentsBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return <Breadcrumb items={items} />;
}
