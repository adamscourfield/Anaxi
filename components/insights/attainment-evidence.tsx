import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import type { AttainmentCycleOption } from "@/modules/analysis/attainmentCycle";
import styles from "./attainment-evidence.module.css";

export { styles as evidenceStyles };

export type EvidencePage = "analysis" | "groups" | "students" | "teachers";

const PAGES: Array<{ key: EvidencePage; label: string; path: string }> = [
  { key: "analysis", label: "Analysis", path: "/insights/attainment/evidence" },
  { key: "groups", label: "Groups", path: "/insights/attainment/group-evidence" },
  { key: "students", label: "Students", path: "/insights/attainment/student-evidence" },
  { key: "teachers", label: "Teachers", path: "/insights/attainment/teacher-evidence" },
];

export function evidenceHref(page: EvidencePage, params: Record<string, string | undefined> = {}): string {
  const path = PAGES.find((p) => p.key === page)!.path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/** Header, page switcher and cycle picker shared by the four attainment evidence pages. */
export function AttainmentEvidenceShell({
  page,
  title,
  subtitle,
  cycles,
  selected,
  cycleHref,
  exportView,
  children,
}: {
  page: EvidencePage;
  title: string;
  subtitle: string;
  cycles: AttainmentCycleOption[];
  selected: AttainmentCycleOption | null;
  /** Link for switching cycle, keeping this page's other choices. */
  cycleHref: (cycleId: string) => string;
  /** Export view name; omit to hide the export button. */
  exportView?: string;
  children: ReactNode;
}) {
  const cycleParam = selected ? { cycle: selected.id } : {};
  return (
    <div className={styles.page}>
      <Link className={styles.back} href={selected ? `/insights/attainment?cycle=${selected.id}` : "/insights/attainment"}>
        ← Attainment insights
      </Link>
      <PageHeader
        variant="ledger"
        title={title}
        subtitle={subtitle}
        actions={
          exportView && selected ? (
            <form className={styles.export} action="/api/explorer/export" method="POST">
              <input type="hidden" name="view" value={exportView} />
              <input type="hidden" name="cycle" value={selected.id} />
              <button type="submit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5 5 5-5M12 15V3" />
                </svg>
                Export CSV
              </button>
            </form>
          ) : undefined
        }
      />
      <div className={styles.bar}>
        <nav className={styles.segmented} aria-label="Attainment evidence">
          {PAGES.map((p) => (
            <Link key={p.key} href={evidenceHref(p.key, cycleParam)} aria-current={p.key === page ? "page" : undefined}>
              {p.label}
            </Link>
          ))}
        </nav>
        {cycles.length > 1 ? (
          <div className={styles.cycle}>
            <span id="attainment-cycle-label">Assessment cycle</span>
            <nav className={styles.segmented} aria-labelledby="attainment-cycle-label">
              {cycles.map((c) => (
                <Link key={c.id} href={cycleHref(c.id)} aria-current={selected?.id === c.id ? "true" : undefined}>
                  {c.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : selected ? (
          <p className={styles.cycle}>
            Assessment cycle <span className={styles.cycleName}>{selected.label}</span>
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function EvidenceEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.emptyCard}>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function EvidencePagination({
  page,
  pageCount,
  total,
  perPage,
  itemLabel,
  href,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  itemLabel: string;
  href: (page: number) => string;
}) {
  if (total <= perPage) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  return (
    <div className={styles.pagination}>
      <span>
        {from}–{to} of {total} {itemLabel}
      </span>
      <nav aria-label={`${itemLabel} pages`}>
        {page > 1 && <Link href={href(page - 1)}>← Previous</Link>}
        <span>
          Page {page} of {pageCount}
        </span>
        {page < pageCount && <Link href={href(page + 1)}>Next →</Link>}
      </nav>
    </div>
  );
}
