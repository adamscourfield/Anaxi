import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { Figtree } from "next/font/google";
import styles from "./landing.module.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if ((session as any)?.user?.id) {
    redirect("/home");
  }

  return (
    <div className={`${styles.page} ${figtree.className}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Anaxi home">
          <Image src="/anaxi-logo.png" alt="" width={32} height={32} priority />
          <span>Anaxi<span className={styles.brandDot}>.</span></span>
        </Link>
        <span className={styles.headerLabel}>Institutional intelligence</span>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.eyebrow}><span aria-hidden="true" /> A clearer view of your school</div>
          <h1 className={styles.title}>
            <span>Institutional</span>
            <span>Awareness<span className={styles.titleDot}>.</span></span>
          </h1>
          <p className={styles.description}>
            Observations, assessments, and leadership signals in one place—so your school can act
            with evidence, not guesswork.
          </p>
          <div className={styles.actions}>
            <Link href="/login" className={styles.signIn}>
              Sign in
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10m0 0L9 4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <p className={styles.hint}>For existing schools. Continue with your school-issued email.</p>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>Anaxi — institutional intelligence for schools</p>
        <a href="mailto:hi@anaxi.io">hi@anaxi.io <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
