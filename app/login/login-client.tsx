"use client";

import { FormEvent, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  AuthCard,
  AuthFieldLabel,
  AuthFlowMain,
  AuthNav,
  AuthPageHeader,
  AuthShell,
} from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { SkipToContent } from "@/components/skip-to-content";

type School = { id: string; name: string };
type Step = "credentials" | "selectSchool";

export function LoginClient() {
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
    <AuthShell variant="light">
      <SkipToContent targetId="auth-form" label="Skip to sign in form" />
      <AuthNav />
      <AuthFlowMain maxWidth="md">
        <div className="mb-8 flex flex-col items-center sm:mb-10 sm:items-start">
          <Image
            src="/anaxi-logo.png"
            alt="Anaxi"
            width={56}
            height={56}
            priority
            className="h-14 w-14 object-contain sm:h-12 sm:w-12"
          />
        </div>

        {step === "credentials" ? (
          <>
            <AuthPageHeader
              title="Sign in"
              subtitle="Use your school email and password. If you belong to more than one school, you will choose which one to open."
              align="start"
            />
            <AuthCard>
              <form onSubmit={onCredentialsSubmit} className="space-y-5">
                <div className="space-y-2">
                  <AuthFieldLabel htmlFor="login-email">Email</AuthFieldLabel>
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@school.edu"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field"
                  />
                </div>
                <div className="space-y-2">
                  <AuthFieldLabel htmlFor="login-password">Password</AuthFieldLabel>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field"
                  />
                </div>

                {error ? (
                  <p className="text-center text-[13px] text-[var(--pill-error-text)]" role="alert">
                    {error}
                  </p>
                ) : null}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Signing in…" : "Sign in"}
                </Button>

                <div className="flex justify-center pt-1">
                  <a
                    href="/login/forgot-password"
                    className="link-muted-accent calm-transition text-[13px]"
                  >
                    Forgot password?
                  </a>
                </div>
              </form>
            </AuthCard>
          </>
        ) : (
          <>
            <AuthPageHeader
              title="Choose school"
              subtitle="Your account is linked to more than one organisation. Pick the one you want to open."
              align="start"
            />
            <AuthCard>
              <div className="flex flex-col gap-3">
                {schools.map((school) => (
                  <Button
                    key={school.id}
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    className="h-auto w-full justify-start py-3.5 text-left font-medium"
                    onClick={() => onSchoolSelect(school.id)}
                  >
                    {school.name}
                  </Button>
                ))}

                {error ? (
                  <p className="text-center text-[13px] text-[var(--pill-error-text)]" role="alert">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={loading}
                  onClick={() => {
                    setStep("credentials");
                    setError(null);
                  }}
                >
                  ← Back
                </Button>
              </div>
            </AuthCard>
          </>
        )}
      </AuthFlowMain>
    </AuthShell>
  );
}
