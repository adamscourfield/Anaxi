import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div
      className="flex min-h-dvh flex-col font-sans"
      style={{ background: "var(--surface-bright)", color: "var(--on-surface)" }}
    >
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-16 sm:px-8">
        <div className="flex w-full max-w-4xl flex-col items-center text-center">
          {/* Login-style lockup at hero scale: logo | rule | wordmark */}
          <h1 className="m-0 flex items-center gap-4 sm:gap-6 md:gap-8 font-normal">
            <Image
              src="/anaxi-logo.png"
              alt=""
              width={160}
              height={160}
              priority
              className="h-[4.5rem] w-[4.5rem] shrink-0 object-contain sm:h-[6rem] sm:w-[6rem] md:h-[7.5rem] md:w-[7.5rem] lg:h-[8.5rem] lg:w-[8.5rem]"
            />
            <div
              className="mx-1 h-[2.25rem] w-px shrink-0 sm:mx-2 sm:h-[3.25rem] md:h-16 md:mx-3 lg:h-[4.25rem]"
              style={{ background: "var(--divider-subtle)" }}
              aria-hidden
            />
            <span
              className="text-2xl font-semibold uppercase tracking-[0.12em] sm:text-3xl sm:tracking-[0.13em] md:text-4xl md:tracking-[0.14em] lg:text-5xl lg:tracking-[0.14em]"
              style={{ color: "var(--on-surface-variant)" }}
            >
              Anaxi
            </span>
          </h1>

          <p
            className="mt-12 max-w-md text-lg leading-relaxed sm:mt-14 sm:text-xl md:mt-16"
            style={{ color: "var(--on-surface-variant)" }}
          >
            Institutional intelligence for schools.
          </p>

          <Link
            href="/login"
            className="mt-12 inline-flex min-h-[3.25rem] w-full max-w-[280px] items-center justify-center rounded-[0.75rem] px-10 text-base font-semibold tracking-[0.01em] text-white calm-transition hover:opacity-90 active:scale-[0.98] sm:mt-14 sm:min-h-14 sm:max-w-[300px] sm:text-[15px]"
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
