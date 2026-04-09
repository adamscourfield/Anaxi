import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div
      className="flex min-h-dvh flex-col font-sans"
      style={{ background: "var(--surface-bright)", color: "var(--on-surface)" }}
    >
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          {/* Same lockup pattern as /login nav: logo | rule | wordmark */}
          <h1 className="m-0 flex items-center gap-3 font-normal">
            <Image
              src="/anaxi-logo.png"
              alt=""
              width={32}
              height={32}
              priority
              className="h-8 w-8 shrink-0 object-contain"
            />
            <div
              className="mx-2 h-4 w-px shrink-0"
              style={{ background: "var(--divider-subtle)" }}
              aria-hidden
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--on-surface-variant)" }}
            >
              Anaxi
            </span>
          </h1>

          <p
            className="mt-10 max-w-[280px] text-base leading-relaxed"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Institutional intelligence for schools.
          </p>

          <Link
            href="/login"
            className="mt-10 inline-flex min-h-12 w-full max-w-[240px] items-center justify-center rounded-[0.75rem] px-8 text-sm font-semibold tracking-[0.01em] text-white calm-transition hover:opacity-90 active:scale-[0.98]"
            style={{
              background:
                "linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)",
              color: "var(--on-primary)",
            }}
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
