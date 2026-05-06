"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
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

type State = "idle" | "loading" | "sent" | "error";

export default function ForgotPasswordPage() {
  const [state, setState] = useState<State>("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const email = String(new FormData(e.currentTarget).get("email") || "");
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
    <AuthShell variant="light">
      <AuthNav />
      <AuthFlowMain>
        <AuthPageHeader
          title="Reset password"
          subtitle="Enter your email and we'll send you a link to set a new password."
        />

        <AuthCard>
          {state === "sent" ? (
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
              <p className="text-[15px] font-semibold text-text">Check your email</p>
              <p className="text-[13px] leading-relaxed text-muted">
                If an account exists for that address, we&apos;ve sent a password reset link. It expires in 1
                hour.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <AuthFieldLabel htmlFor="email">Email</AuthFieldLabel>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@school.edu"
                  className="field"
                  required
                  autoComplete="email"
                />
              </div>

              {state === "error" ? (
                <div
                  className="rounded-md border border-[var(--coral-border)] px-4 py-3"
                  style={{ background: "var(--pill-error-bg)" }}
                >
                  <p className="text-[13px] text-[var(--pill-error-text)]">
                    Something went wrong. Please try again.
                  </p>
                </div>
              ) : null}

              <Button type="submit" disabled={state === "loading"} className="w-full">
                {state === "loading" ? "Sending…" : "Send reset link"}
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

        {state === "sent" ? (
          <div className="mt-8 flex justify-center">
            <Link
              href="/login"
              className="calm-transition text-[13px] text-muted hover:opacity-70"
            >
              Return to sign in
            </Link>
          </div>
        ) : (
          <AuthBackLink href="/login" />
        )}
      </AuthFlowMain>
    </AuthShell>
  );
}
