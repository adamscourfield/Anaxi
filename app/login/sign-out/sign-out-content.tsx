"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, AuthFlowMain, AuthNav, AuthPageHeader, AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";

function safeAppPath(url: string): string {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return "/home";
}

export default function SignOutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const afterSignOut = searchParams.get("callbackUrl") || "/login";
  const cancelHref = safeAppPath(searchParams.get("returnTo") || "/home");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signOut({ callbackUrl: afterSignOut, redirect: true });
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell variant="light">
      <AuthNav />
      <AuthFlowMain>
        <AuthPageHeader
          title="Sign out"
          subtitle="You’re about to end your session on this device. You can sign back in anytime."
        />

        <AuthCard>
          <form onSubmit={onSubmit} className="space-y-5">
            {error ? (
              <div
                className="rounded-md border border-[var(--coral-border)] px-4 py-3"
                style={{ background: "var(--pill-error-bg)" }}
              >
                <p className="text-[13px] text-[var(--pill-error-text)]">{error}</p>
              </div>
            ) : null}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing out…" : "Sign out"}
              {!loading ? (
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                  <path
                    d="M6 14H3.5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 3.5 2H6M10.5 11.5 14 8l-3.5-3.5M14 8H5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => router.push(cancelHref)}
            >
              Stay signed in
            </Button>
          </form>
        </AuthCard>

        <div className="mt-8 flex justify-center">
          <Link
            href="/login"
            className="calm-transition flex items-center gap-1.5 text-[13px] text-muted hover:opacity-70"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
              <path
                d="M10 3.5 5.5 8l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to sign in
          </Link>
        </div>
      </AuthFlowMain>
    </AuthShell>
  );
}
