"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Figtree } from "next/font/google";
import styles from "../login.module.css";
import landing from "../../landing.module.css";
import { SkipToContent } from "@/components/skip-to-content";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

import { Button } from "@/components/ui/button";

type State = "idle" | "loading" | "success" | "error";

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    setState("loading");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      setState("error");
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setState("success");
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setState("error");
    }
  }

  const missingToken = !token;

  return (
    <div className={`${landing.page} ${styles.page} ${figtree.className}`}>
      <SkipToContent targetId="auth-form" label="Skip to new password form" />
      <header className={landing.header}>
        <Link href="/" className={landing.brand} aria-label="Anaxi home">
          <Image src="/anaxi-logo.png" alt="" width={32} height={32} priority />
          <span>Anaxi<span className={landing.brandDot}>.</span></span>
        </Link>
        <span className={landing.headerLabel}>Institutional intelligence</span>
      </header>
      <main className={styles.main}>
        <div id="auth-form" className={styles.panel}>
        <h1 className={styles.title}>New password<span>.</span></h1>
        <p className={styles.subtitle}>Choose a strong password for your Anaxi account.</p>
        <div className={styles.card}>
          {missingToken ? (
            <div className="space-y-3 py-2 text-center" role="alert">
              <p className={styles.successTitle}>Invalid link</p>
              <p className={styles.help}>
                This password reset link is missing a token.{" "}
                <Link href="/login/forgot-password" className={styles.forgot}>
                  Request a new one.
                </Link>
              </p>
            </div>
          ) : state === "success" ? (
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
              <p className={styles.successTitle}>Password updated</p>
              <p className={styles.help}>Redirecting you to sign in…</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <ul className={`${styles.help} list-disc space-y-1 pl-4`}>
                <li>At least 8 characters</li>
                <li>Use a mix of letters and numbers for a stronger password</li>
              </ul>
              <div className="space-y-2">
                <label className={styles.label} htmlFor="password">New password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  className={styles.field}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <label className={styles.label} htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  placeholder="Repeat your new password"
                  className={styles.field}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {state === "error" && errorMsg ? (
                <p className={styles.error} role="alert">{errorMsg}</p>
              ) : null}

              <Button type="submit" disabled={state === "loading"} className={styles.button}>
                {state === "loading" ? "Updating…" : "Set new password"}
                {state !== "loading" ? (
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                    <path
                      d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </Button>
            </form>
          )}
        </div>

        <div className="mt-7 flex justify-center">
          <Link href="/login" className={styles.forgot}>← Back to sign in</Link>
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
