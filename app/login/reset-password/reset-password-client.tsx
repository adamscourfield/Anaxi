"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AuthBackLink,
  AuthCard,
  AuthFieldLabel,
  AuthFlowMain,
  AuthNav,
  AuthPageHeader,
  AuthShell,
} from "@/components/auth-shell";
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
    <AuthShell variant="light">
      <AuthNav />
      <AuthFlowMain>
        <AuthPageHeader
          title="New password"
          subtitle="Choose a strong password for your Anaxi account."
        />

        <AuthCard>
          {missingToken ? (
            <div className="space-y-3 py-2 text-center">
              <p className="text-[15px] font-semibold text-text">Invalid link</p>
              <p className="text-[13px] text-muted">
                This password reset link is missing a token.{" "}
                <Link href="/login/forgot-password" className="link-muted-accent underline-offset-2 hover:opacity-70">
                  Request a new one.
                </Link>
              </p>
            </div>
          ) : state === "success" ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-[var(--surface-container-low)]">
                <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6" aria-hidden>
                  <path
                    d="M3.5 10 7.5 14l9-8"
                    stroke="var(--on-surface)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[15px] font-semibold text-text">Password updated</p>
              <p className="text-[13px] text-muted">Redirecting you to sign in…</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <AuthFieldLabel htmlFor="password">New password</AuthFieldLabel>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  className="field"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <AuthFieldLabel htmlFor="confirm">Confirm password</AuthFieldLabel>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  placeholder="Repeat your new password"
                  className="field"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {state === "error" && errorMsg ? (
                <div
                  className="rounded-md border border-[var(--coral-border)] px-4 py-3"
                  style={{ background: "var(--pill-error-bg)" }}
                >
                  <p className="text-[13px] text-[var(--pill-error-text)]">{errorMsg}</p>
                </div>
              ) : null}

              <Button type="submit" disabled={state === "loading"} className="w-full">
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
        </AuthCard>

        <AuthBackLink href="/login" />
      </AuthFlowMain>
    </AuthShell>
  );
}
