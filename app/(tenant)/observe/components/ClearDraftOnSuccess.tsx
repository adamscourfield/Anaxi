"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/components/toast-provider";
import { clearDraft } from "./observationDraft";

const confirmed = new Set<string>();

/** After a save: drop the draft, confirm once, and tidy the address so a refresh doesn't repeat it. */
export function ClearDraftOnSuccess({ draftKey }: { draftKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    clearDraft(draftKey);
    if (!confirmed.has(pathname)) {
      confirmed.add(pathname);
      toast("Observation saved", "success");
    }
    router.replace(pathname, { scroll: false });
  }, [draftKey, pathname, router]);

  return null;
}
