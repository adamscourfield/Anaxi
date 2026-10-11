"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Figtree } from "next/font/google";
import styles from "../login.module.css";
import landing from "../../landing.module.css";
import { SkipToContent } from "@/components/skip-to-content";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

import { Button } from "@/components/ui/button";

type State = "idle" | "loading" | "sent" | "error";

export default function ForgotPasswordPage() {
  const [state, setState] = useState<State>("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <div className={`${landing.page} ${styles.page} ${figtree.className}`}>
      <SkipToContent targetId="auth-form" label="Skip to reset password form" />
      <header className={landing.header}>
        <Link href="/" className={landing.brand} aria-label="Anaxi home">
          <Image src="/anaxi-logo.png" alt="" width={32} height={32} priority />
          <span>Anaxi<span className={landing.brandDot}>.</span></span>
        </Link>
        <span className={landing.headerLabel}>Institutional intelligence</span>
      </header>
      <main className={styles.main}>
        <div id="auth-form" className={styles.panel}>
        <h1 className={styles.title}>Reset password<span>.</span></h1>
        <p className={styles.subtitle}>Enter your school email and we’ll send you a link to set a new password.</p>
        <div className={styles.card}>
          {state === "sent" ? (
            <div className="space-y-4 py-2 text-center" role="status">
              <div className={styles.successIcon}>
                <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden>
                  <path
                    d="M3.5 10 7.5 14l9-8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className={styles.successTitle}>Check your email</p>
              <p className={styles.help}>
                If an account exists for that address, we&apos;ve sent a password reset link. It expires in 1
                hour. Check your spam or junk folder if it does not arrive within a few minutes.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className={styles.label} htmlFor="email">School email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@school.edu"
                  className={styles.field}
                  required
                  autoComplete="email"
                />
              </div>

              {state === "error" ? (
                <p className={styles.error} role="alert">Something went wrong. Please try again.</p>
              ) : null}

              <Button type="submit" disabled={state === "loading"} className={styles.button}>
                {state === "loading" ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
        </div>

        <div className="mt-7 flex justify-center">
          <Link href="/login" className={styles.forgot}>
            {state === "sent" ? "Return to sign in" : "← Back to sign in"}
          </Link>
        </div>
        </div>
      </main>
      <footer className={landing.footer}>
        <p>Anaxi — institutional intelligence for schools</p>
        <a href="mailto:hi@anaxi.io">hi@anaxi.io <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
