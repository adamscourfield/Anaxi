import Link from "next/link";
import Image from "next/image";
import { Figtree } from "next/font/google";
import { requireSuperAdminUser } from "@/lib/admin";
import { GodSchoolSwitcher } from "@/components/god-school-switcher";
import { PlatformNav } from "@/components/god/PlatformNav";
import styles from "./god.module.css";
const figtree=Figtree({subsets:["latin"],weight:["400","500","600","700"]});
export default async function GodLayout({children}:{children:React.ReactNode}) {
  await requireSuperAdminUser();
  return <div className={`${styles.shell} ${figtree.className}`}>
    <a href="#platform-main" className={styles.skip}>Skip to workspace</a>
    <header className={styles.topbar}><Link href="/god" className={styles.brand}><Image src="/anaxi-logo.png" alt="Anaxi" width={28} height={28}/><span>ANAXI<small>PLATFORM</small></span></Link><div className={styles.topActions}><span className={styles.access}>Super user</span><GodSchoolSwitcher/><Link href="/home">Exit GOD mode ↗</Link></div></header>
    <aside className={styles.sidebar}><div><p className={styles.navLabel}>GOD mode</p><PlatformNav/></div><div className={styles.sidebarFoot}><span className={styles.liveDot}/>Live platform<Link href="/login/sign-out?callbackUrl=/login&returnTo=/home">Sign out ↗</Link></div></aside>
    <main id="platform-main" className={styles.main}><div className={styles.context}><span>Platform administration</span><span>Changes apply to live schools</span></div><div className={styles.content}>{children}</div></main>
  </div>;
}
