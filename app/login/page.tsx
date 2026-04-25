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
    const role = (session?.user as any)?.role;
    router.push(role === "SUPER_ADMIN" ? "/god" : res?.url || "/home");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-[320px] flex flex-col items-center">

        {/* Logo — the hero */}
        <div className="mb-5" style={{ animation: "fadeUp 0.6s ease both" }}>
          <Image
            src="/anaxi-logo.png"
            alt="Anaxi"
            width={72}
            height={72}
            priority
            className="object-contain"
            style={{ filter: "brightness(0) invert(1)", opacity: 0.92 }}
          />
        </div>

        {/* Wordmark */}
        <p
          className="mb-12 text-[10px] font-semibold tracking-[0.32em] uppercase"
          style={{ color: "rgba(255,255,255,0.28)", animation: "fadeUp 0.6s 0.05s ease both" }}
        >
          Anaxi
        </p>

        {/* Form */}
        <div
          className="w-full"
          style={{ animation: "fadeUp 0.6s 0.1s ease both" }}
        >
          {step === "credentials" ? (
            <form onSubmit={onCredentialsSubmit} className="flex flex-col gap-2.5">
              <input
                type="email"
                placeholder="Email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl text-[14px] outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.90)",
                  caretColor: "white",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.22)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.09)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
              />
              <input
                type="password"
                placeholder="Password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl text-[14px] outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.90)",
                  caretColor: "white",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.22)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.09)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
              />

              {error && (
                <p className="text-center text-[12px]" style={{ color: "#fe9f9f" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 py-3.5 rounded-xl text-[13px] font-semibold tracking-[0.02em] transition-all duration-150 disabled:opacity-40 active:scale-[0.98]"
                style={{
                  background: "rgba(255,255,255,0.94)",
                  color: "#0a0c16",
                }}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>

              <a
                href="/login/forgot-password"
                className="mt-1 text-center text-[12px] transition-opacity duration-150 hover:opacity-60"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                Forgot password?
              </a>
            </form>
          ) : (
            <div className="flex flex-col gap-2">
              <p
                className="text-center text-[11px] font-medium tracking-widest uppercase mb-1"
                style={{ color: "rgba(255,255,255,0.28)" }}
              >
                Select school
              </p>

              {schools.map((school) => (
                <button
                  key={school.id}
                  onClick={() => onSchoolSelect(school.id)}
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-xl text-left text-[13px] font-medium transition-all duration-150 disabled:opacity-40 hover:opacity-80 active:scale-[0.98]"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.88)",
                  }}
                >
                  {school.name}
                </button>
              ))}

              {error && (
                <p className="text-center text-[12px]" style={{ color: "#fe9f9f" }}>
                  {error}
                </p>
              )}

              <button
                onClick={() => { setStep("credentials"); setError(null); }}
                className="mt-1 text-center text-[12px] transition-opacity duration-150 hover:opacity-60"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder {
          color: rgba(255,255,255,0.28);
        }
      `}</style>
    </div>
  );
}
