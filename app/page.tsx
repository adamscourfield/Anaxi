import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6 py-16"
      style={{ background: "var(--surface-bright)", color: "var(--on-surface)" }}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Image
          src="/anaxi-logo.png"
          alt=""
          width={64}
          height={64}
          priority
          className="h-16 w-16 object-contain"
        />

        <h1 className="mt-8 font-newsreader text-4xl font-semibold tracking-tight sm:text-5xl">
          Anaxi
        </h1>

        <p
          className="mt-4 text-base leading-relaxed sm:text-lg"
          style={{ color: "var(--on-surface-variant)" }}
        >
          Institutional intelligence for schools.
        </p>

        <Link
          href="/login"
          className="mt-10 inline-flex min-h-12 w-full max-w-[220px] items-center justify-center rounded-xl px-8 text-base font-semibold text-white calm-transition hover:opacity-90"
          style={{ background: "var(--primary-container)" }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
