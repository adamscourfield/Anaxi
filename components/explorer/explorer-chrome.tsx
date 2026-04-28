import Link from "next/link";

/** Standard “Back to Explorer” row above child explorer pages */
export function ExplorerBackLink() {
  return (
    <div className="mb-6">
      <Link
        href="/explorer"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted calm-transition hover:text-accent"
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Explorer
      </Link>
    </div>
  );
}
