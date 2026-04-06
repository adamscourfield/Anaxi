"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function safeAppPath(url: string): string {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return "/home";
}

export default function SignOutContent() {
  const searchParams = useSearchParams();
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
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--surface-bright)", color: "var(--on-surface)" }}
    >
      <nav className="fixed top-0 w-full z-50 flex items-center px-8 h-20 glass-surface">
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
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--on-surface)" }}>
              Sign out
            </h1>
            <p className="text-base leading-relaxed" style={{ color: "var(--on-surface-variant)" }}>
              You&apos;re about to end your session on this device. You can sign back in anytime.
            </p>
          </div>

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
              <form onSubmit={onSubmit} className="space-y-5">
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
                  {loading ? "Signing out…" : "Sign out"}
                  {!loading && (
                    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 14H3.5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 3.5 2H6M10.5 11.5 14 8l-3.5-3.5M14 8H5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <Link
                  href={cancelHref}
                  className="flex w-full items-center justify-center rounded-[0.75rem] py-3 text-sm font-medium calm-transition hover:opacity-80"
                  style={{
                    background: "var(--secondary-container)",
                    color: "var(--on-surface)",
                  }}
                >
                  Stay signed in
                </Link>
              </form>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <Link
              href="/login"
              className="text-[13px] calm-transition flex items-center gap-1.5 hover:opacity-70"
              style={{ color: "var(--on-surface-variant)" }}
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
