import Link from "next/link";

/**
 * Back link above child Insights pages, styled like the redesigned Insights pages ("← Insights").
 * The page title already says where you are, so the old breadcrumb row and "Back to Insights"
 * pill are gone. The props are kept so existing call sites don't need to change.
 */
export function ExplorerBackLink(_props: {
  section?: string;
  sectionHref?: string;
  detail?: string;
} = {}) {
  return (
    <div className="mb-2">
      <Link href="/insights" className="text-xs text-[#6e6e73] calm-transition hover:text-[#1c1c1e]">
        ← Insights
      </Link>
    </div>
  );
}
