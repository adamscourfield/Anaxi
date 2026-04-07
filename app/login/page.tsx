"use client";

import { FormEvent, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

type School = { id: string; name: string };
type Step = "credentials" | "selectSchool";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const switchTo = searchParams.get("switchTo") || "";
  const prefillEmail = searchParams.get("email") || "";

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onCredentialsSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // If switching tenants, we already know which one — sign in directly.
      if (switchTo) {
        await doSignIn(switchTo);
        return;
      }

      // Look up which schools this email/password belongs to.
      const res = await fetch("/api/auth/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      const tenants: School[] = data.tenants ?? [];

      if (tenants.length === 0) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      if (tenants.length === 1) {
        // Only one school — log straight in.
        await doSignIn(tenants[0].id);
        return;
      }

      // Multiple schools — let the user pick.
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
    const role = (session?.user as any)?.role;
    router.push(role === "SUPER_ADMIN" ? "/god" : res?.url || "/home");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--surface-bright)", color: "var(--on-surface)" }}
    >
      {/* Top navigation */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-8 h-20 glass-surface">
        <div className="flex items-center gap-3">
          <Image src="/anaxi-logo.png" alt="Anaxi" width={32} height={32} priority className="h-8 w-8 object-contain" />
          <div className="h-4 w-px mx-2" style={{ background: "var(--divider-subtle)" }} />
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--on-surface-variant)" }}>
            Anaxi
          </span>
        </div>
      </nav>

      <main className="flex-grow flex items-center justify-center px-6 py-24">
        <div className="w-full max-w-[440px] flex flex-col">

          {/* Header */}
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--on-surface)" }}>
              {step === "selectSchool" ? "Select your school" : "Sign In"}
            </h1>
            <p className="text-base leading-relaxed" style={{ color: "var(--on-surface-variant)" }}>
              {step === "selectSchool"
                ? "Your account is linked to multiple schools. Choose which one to sign into."
                : switchTo
                ? "Switching institution. Enter your credentials to continue."
                : "Access your institutional dashboard and intelligence tools."}
            </p>
          </div>

          {/* Card */}
          <div
            className="p-1 rounded-[1.5rem]"
            style={{
              background: "rgba(255,255,255,0.80)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 32px 64px -16px rgba(25,28,30,0.04)",
            }}
          >
            <div
              className="p-8 rounded-[1.375rem]"
              style={{
                background: "var(--surface-container-lowest)",
                border: "1px solid color-mix(in srgb, var(--outline-variant) 10%, transparent)",
              }}
            >
              {step === "credentials" ? (
                <form onSubmit={onCredentialsSubmit} className="space-y-5">
                  {/* Email */}
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="block text-[11px] font-bold tracking-widest uppercase ml-1"
                      style={{ color: "var(--on-surface-variant)" }}
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@school.edu"
                      className="field"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="block text-[11px] font-bold tracking-widest uppercase ml-1"
                      style={{ color: "var(--on-surface-variant)" }}
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      className="field"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {switchTo && <input type="hidden" name="tenantId" value={switchTo} />}

                  <div className="flex items-center justify-end">
                    <a
                      className="calm-transition text-[13px] hover:opacity-70"
                      style={{ color: "var(--on-surface-variant)" }}
                      href="/login/forgot-password"
                    >
                      Forgot password?
                    </a>
                  </div>

                  {error && (
                    <div
                      className="px-4 py-3 rounded-[0.75rem]"
                      style={{
                        background: "var(--pill-error-bg)",
                        border: "1px solid rgba(254,159,159,0.20)",
                      }}
                    >
                      <p className="text-[13px]" style={{ color: "var(--pill-error-text)" }}>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-[0.75rem] text-sm font-semibold tracking-[0.01em] calm-transition disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)",
                      color: "var(--on-primary)",
                    }}
                  >
                    {loading ? "Checking…" : "Continue"}
                    {!loading && (
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  {schools.map((school) => (
                    <button
                      key={school.id}
                      onClick={() => onSchoolSelect(school.id)}
                      disabled={loading}
                      className="w-full text-left px-5 py-4 rounded-[0.875rem] calm-transition disabled:opacity-40 hover:opacity-90 active:scale-[0.99]"
                      style={{
                        background: "var(--surface-container-low)",
                        border: "1px solid color-mix(in srgb, var(--outline-variant) 20%, transparent)",
                      }}
                    >
                      <p className="text-sm font-semibold" style={{ color: "var(--on-surface)" }}>
                        {school.name}
                      </p>
                      <p className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--on-surface-variant)" }}>
                        {school.id}
                      </p>
                    </button>
                  ))}

                  {error && (
                    <div
                      className="px-4 py-3 rounded-[0.75rem]"
                      style={{
                        background: "var(--pill-error-bg)",
                        border: "1px solid rgba(254,159,159,0.20)",
                      }}
                    >
                      <p className="text-[13px]" style={{ color: "var(--pill-error-text)" }}>{error}</p>
                    </div>
                  )}

                  <button
                    onClick={() => { setStep("credentials"); setError(null); }}
                    className="w-full py-2.5 text-sm calm-transition hover:opacity-70"
                    style={{ color: "var(--on-surface-variant)" }}
                  >
                    ← Back
                  </button>
                </div>
              )}

              {step === "credentials" && (
                <>
                  {/* Divider */}
                  <div className="my-6 flex items-center gap-3">
                    <div className="flex-1 h-px" style={{ background: "var(--surface-container-high)" }} />
                    <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "var(--outline)" }}>
                      Secure Gateway
                    </span>
                    <div className="flex-1 h-px" style={{ background: "var(--surface-container-high)" }} />
                  </div>

                  {/* SSO */}
                  <button
                    type="button"
                    className="w-full py-3 rounded-[0.75rem] text-sm font-medium calm-transition flex items-center justify-center gap-2 hover:opacity-80"
                    style={{
                      background: "var(--secondary-container)",
                      color: "var(--on-surface)",
                    }}
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3.5" y="7.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 7.5V6a3 3 0 0 1 6 0v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="10" cy="12" r="1.5" fill="currentColor" />
                    </svg>
                    Single Sign-On
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center gap-5">
            <a href="#" className="text-[12px] calm-transition hover:opacity-70" style={{ color: "var(--outline)" }}>Privacy</a>
            <a href="#" className="text-[12px] calm-transition hover:opacity-70" style={{ color: "var(--outline)" }}>Terms</a>
            <a href="#" className="text-[12px] calm-transition hover:opacity-70" style={{ color: "var(--outline)" }}>Support</a>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2 13 4v3.8c0 2.5-1.8 4.2-5 5-3.2-.8-5-3-5-5V4L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" style={{ color: "var(--outline)" }} />
            </svg>
            <span className="text-[11px]" style={{ color: "var(--outline)" }}>
              End-to-end encrypted session
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
