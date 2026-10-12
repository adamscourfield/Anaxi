"use client";

import styles from "./WatchlistToggle.module.css";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWatchlist } from "@/app/(tenant)/analysis/students/actions";

export function WatchlistToggle({
  studentId,
  initialOnWatchlist,
}: {
  studentId: string;
  initialOnWatchlist: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      title={initialOnWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      aria-label={initialOnWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={initialOnWatchlist}
      className={styles.toggle}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          await toggleWatchlist(studentId);
          router.refresh();
        });
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill={initialOnWatchlist ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91L12 3Z" />
      </svg>
    </button>
  );
}
