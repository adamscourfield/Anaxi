import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { RouteEnter } from "@/components/route-enter";

export function AuthShell({
  variant,
  children,
}: {
  variant: "light" | "dark";
  children: ReactNode;
}) {
  if (variant === "dark") {
    return (
      <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_50%_30%,#161c30_0%,#0a0c16_100%)] text-white">
        {children}
      </div>
    );
  }
  return (
    <div className="anx-workspace-main flex min-h-screen flex-col text-[var(--on-surface)]">
      {children}
    </div>
  );
}

export function AuthNav() {
  return (
    <nav className="fixed top-0 z-50 flex h-20 w-full items-center border-b border-[color-mix(in_srgb,var(--outline-variant)_30%,transparent)] bg-[var(--anx-frost-bg)] px-6 backdrop-blur-[14px] md:px-8">
      <div className="flex items-center gap-3">
        <Image src="/anaxi-logo.png" alt="Anaxi" width={32} height={32} priority className="h-8 w-8 object-contain" />
        <div className="mx-2 h-4 w-px bg-[var(--divider-subtle)]" />
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Anaxi
        </span>
      </div>
    </nav>
  );
}

export function AuthPageHeader({
  title,
  subtitle,
  variant = "light",
  align = "center",
}: {
  title: string;
  subtitle: string;
  variant?: "light" | "dark";
  align?: "center" | "start";
}) {
  const alignClass = align === "center" ? "text-center md:text-left" : "text-left";
  const titleClass =
    variant === "light"
      ? "font-display text-[28px] font-bold leading-tight tracking-[-0.03em] text-text"
      : "font-display text-[28px] font-bold leading-tight tracking-[-0.03em] text-white";

  return (
    <div className={`mb-10 space-y-1.5 ${alignClass}`}>
      <h1 className={titleClass}>{title}</h1>
      <p
        className={
          variant === "light"
            ? "max-w-lg text-pretty text-[13px] leading-relaxed text-muted"
            : "max-w-lg text-pretty text-[13px] leading-relaxed text-white/55"
        }
      >
        {subtitle}
      </p>
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-lg p-px shadow-none"
      style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div
        className="rounded-lg p-8 sm:p-9"
        style={{
          background: "var(--surface-container-lowest)",
          border: "1px solid color-mix(in srgb, var(--outline-variant) 12%, transparent)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function AuthFieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="ml-1 block text-[11px] font-bold uppercase tracking-widest text-muted"
    >
      {children}
    </label>
  );
}

export function AuthBackLink({ href = "/login" }: { href?: string }) {
  return (
    <div className="mt-8 flex justify-center">
      <Link
        href={href}
        className="link-muted-accent calm-transition flex items-center gap-1.5 text-[13px]"
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
  );
}

export function AuthFlowMain({
  children,
  maxWidth = "md",
}: {
  children: ReactNode;
  /** `sm` = login column; `md` = forms with labels */
  maxWidth?: "sm" | "md";
}) {
  const mw = maxWidth === "sm" ? "max-w-[320px]" : "max-w-[440px]";
  return (
    <main className="flex flex-grow flex-col items-center justify-center px-6 py-24 pt-28 md:pt-24">
      <div className={`flex w-full flex-col ${mw}`}>
        <RouteEnter>{children}</RouteEnter>
      </div>
    </main>
  );
}
