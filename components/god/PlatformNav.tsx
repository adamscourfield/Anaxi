"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/app/god/god.module.css";
const links = [{href:"/god",label:"Schools",kind:"schools"},{href:"/god/integrations/arbor",label:"Arbor",kind:"arbor"},{href:"/god/audit",label:"Audit log",kind:"audit"}];
export function PlatformNav() {
  const pathname=usePathname();
  return <nav className={styles.nav} aria-label="Platform navigation">{links.map(link=><Link href={link.href} key={link.href} aria-current={(link.href==="/god" ? pathname==="/god"||pathname.startsWith("/god/schools") : pathname.startsWith(link.href)) ? "page":undefined}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{link.kind==="schools"?<><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5"/><path d="M9 9h.01M15 9h.01M9 12h.01M15 12h.01"/></>:link.kind==="arbor"?<><path d="M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4"/></>:<><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3"/></>}</svg>{link.label}<span aria-hidden="true">→</span>
  </Link>)}</nav>;
}
