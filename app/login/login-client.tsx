"use client";

import { FormEvent, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Figtree } from "next/font/google";
import styles from "./login.module.css";
import landing from "../landing.module.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

import { Button } from "@/components/ui/button";
import { SkipToContent } from "@/components/skip-to-content";

type School = { id: string; name: string };
type Step = "credentials" | "selectSchool";

export function LoginClient({ microsoftEnabled = false }: { microsoftEnabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const switchTo = searchParams.get("switchTo") || "";
  const prefillEmail = searchParams.get("email") || "";

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(searchParams.get("error") ? "Microsoft sign-in failed or your account is not linked. Contact your school administrator, or use your Anaxi password." : null);
  const [loading, setLoading] = useState(false);

  async function onCredentialsSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (switchTo) {
        await doSignIn(switchTo);
        return;
      }
      const res = await fetch("/api/auth/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      const tenants: School[] = data.tenants ?? [];
      if (tenants.length === 0) {
        setError("Invalid email or password.");
        return;
      }
      if (tenants.length === 1) {
        await doSignIn(tenants[0].id);
        return;
      }
      setSchools(tenants);
      setStep("selectSchool");
    } finally {
      setLoading(false);
    }
  }

  async function onSchoolSelect(tenantId: string) {
    setError(null);
    setLoading(true);
    try {
      await doSignIn(tenantId);
    } finally {
      setLoading(false);
    }
  }

  async function doSignIn(tenantId: string) {
    const res = await signIn("credentials", {
      email,
      password,
      tenantId,
      redirect: false,
      callbackUrl: "/home",
    });
    if (res?.error) {
      setError("Authentication failed. Please try again.");
      setStep("credentials");
      return;
    }
    const session = await getSession();
    const role = (session?.user as { role?: string })?.role;
    router.push(role === "SUPER_ADMIN" ? "/god" : res?.url || "/home");
    router.refresh();
  }

  return (
    <div className={`${landing.page} ${styles.page} ${figtree.className}`}>
      <SkipToContent targetId="auth-form" label="Skip to sign in form" />
      <header className={landing.header}>
        <Link href="/" className={landing.brand} aria-label="Anaxi home">
          <Image src="/anaxi-logo.png" alt="" width={32} height={32} priority />
          <span>Anaxi<span className={landing.brandDot}>.</span></span>
        </Link>
        <span className={landing.headerLabel}>Institutional intelligence</span>
      </header>
      <main className={styles.main}>
        <div id="auth-form" className={styles.panel}>
        {step === "credentials" ? (
          <>
            <h1 className={styles.title}>Welcome back<span>.</span></h1>
            <p className={styles.subtitle}>Sign in with your school email and password.</p>
            <div className={styles.card}>
              {microsoftEnabled && (
                <div className="mb-5 space-y-3">
                  <Button type="button" variant="secondary" disabled={loading} className={`${styles.button} ${styles.secondary}`}
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      try {
                        await signIn("azure-ad", { callbackUrl: "/home" });
                      } catch {
                        setError("Microsoft sign-in could not start. Please try again.");
                        setLoading(false);
                      }
                    }}>
                    {loading ? "Signing in…" : "Sign in with Microsoft"}
                  </Button>
                  <p className="text-center text-[13px] text-[var(--on-surface-variant)]">Or use your Anaxi password</p>
                </div>
              )}
              <form onSubmit={onCredentialsSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className={styles.label} htmlFor="login-email">School email</label>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@school.edu"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.field}
                  />
                </div>
                <div className="space-y-2">
                  <label className={styles.label} htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.field}
                  />
                </div>

                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" disabled={loading} className={styles.button}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>

                <div className="flex justify-center pt-1">
                  <a
                    href="/login/forgot-password"
                    className={styles.forgot}
                  >
                    Forgot password?
                  </a>
                </div>
              </form>
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Choose school<span>.</span></h1>
            <p className={styles.subtitle}>Your account is linked to more than one organisation. Pick the one you want to open.</p>
            <div className={styles.card}>
              <div className="flex flex-col gap-3">
                {schools.map((school) => (
                  <Button
                    key={school.id}
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    className={`${styles.button} ${styles.school}`}
                    onClick={() => onSchoolSelect(school.id)}
                  >
                    {school.name}
                  </Button>
                ))}

                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  className={`${styles.button} ${styles.secondary}`}
                  disabled={loading}
                  onClick={() => {
                    setStep("credentials");
                    setError(null);
                  }}
                >
                  ← Back
                </Button>
              </div>
            </div>
          </>
        )}
        <p className={styles.hint}>If you belong to more than one school, you’ll choose which one to open after signing in.</p>
        </div>
      </main>
      <footer className={landing.footer}>
        <p>Anaxi — institutional intelligence for schools</p>
        <a href="mailto:hi@anaxi.io">hi@anaxi.io <span aria-hidden="true">↗</span></a>
      </footer>
    </div>
  );
}
