import Image from "next/image";
import Link from "next/link";
import { Figtree } from "next/font/google";
import landing from "../landing.module.css";
import styles from "../login/login.module.css";
import { SkipToContent } from "@/components/skip-to-content";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${landing.page} ${styles.page} ${figtree.className}`}>
      <SkipToContent targetId="auth-form" label="Skip to invitation" />
      <header className={landing.header}>
        <Link href="/" className={landing.brand} aria-label="Anaxi home">
          <Image src="/anaxi-logo.png" alt="" width={32} height={32} priority />
          <span>Anaxi<span className={landing.brandDot}>.</span></span>
        </Link>
        <span className={landing.headerLabel}>Institutional intelligence</span>
      </header>
      <main className={styles.main}>
        <div id="auth-form" className={styles.panel}>{children}</div>
      </main>
      <footer className={landing.footer}>
        <p>Anaxi — institutional intelligence for schools</p>
        <a href="mailto:hi@anaxi.io">hi@anaxi.io <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
