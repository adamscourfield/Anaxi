"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "@/components/toast-provider";

export function LeaveCreatedToast() {
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (String(searchParams.get("created") || "") !== "1") return;
    fired.current = true;
    toast("Leave request submitted — you can track its status below.", "success");
    const url = new URL(window.location.href);
    url.searchParams.delete("created");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [searchParams]);

  return null;
}
