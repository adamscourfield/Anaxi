"use client";

import { FormEvent, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { AuthFlowMain, AuthNav, AuthShell } from "@/components/auth-shell";

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
    const role = (session?.user as { role?: string })?.role;
    router.push(role === "SUPER_ADMIN" ? "/god" : res?.url || "/home");
    router.refresh();
  }

  return (
    <AuthShell variant="dark">
      <AuthNav />
      <AuthFlowMain maxWidth="sm">
        <div className="flex flex-col items-center">
          <div className="mb-5">
            <Image
              src="/anaxi-logo.png"
              alt="Anaxi"
              width={72}
              height={72}
              priority
              className="object-contain opacity-[0.92] brightness-0 invert"
            />
          </div>

          <p className="mb-12 text-[10px] font-semibold uppercase tracking-[0.32em] text-white/28">Anaxi</p>

          <div className="w-full">
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
                  className="field field--dark px-4 py-3.5 text-[14px]"
                />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field field--dark px-4 py-3.5 text-[14px]"
                />

                {error ? <p className="text-center text-[12px] text-[var(--coral)]">{error}</p> : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="calm-transition mt-1 w-full rounded-xl bg-white/94 py-3.5 text-[13px] font-semibold tracking-[0.02em] text-[#0a0c16] active:scale-[0.98] disabled:opacity-40"
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                <a
                  href="/login/forgot-password"
                  className="calm-transition mt-1 text-center text-[12px] text-white/25 hover:opacity-60"
                >
                  Forgot password?
                </a>
              </form>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="mb-1 text-center text-[11px] font-medium uppercase tracking-widest text-white/28">
                  Select school
                </p>

                {schools.map((school) => (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => onSchoolSelect(school.id)}
                    disabled={loading}
                    className="calm-transition w-full rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3.5 text-left text-[13px] font-medium text-white/88 active:scale-[0.98] hover:bg-white/[0.1] disabled:opacity-40"
                  >
                    {school.name}
                  </button>
                ))}

                {error ? <p className="text-center text-[12px] text-[var(--coral)]">{error}</p> : null}

                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setError(null);
                  }}
                  className="calm-transition mt-1 text-center text-[12px] text-white/25 hover:opacity-60"
                >
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>
      </AuthFlowMain>
    </AuthShell>
  );
}
