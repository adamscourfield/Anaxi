"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function InvestigationScroll() {
  const params = useSearchParams();
  const normalised = new URLSearchParams(params.toString());
  if (normalised.get("page") === "1") normalised.delete("page");
  normalised.sort();
  const key = "insights-scroll:" + normalised.toString();
  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    if (saved) requestAnimationFrame(() => window.scrollTo(0, Number(saved)));
    const remember = () => sessionStorage.setItem(key, String(window.scrollY));
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [key]);
  return null;
}
