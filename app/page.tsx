import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div
      className="h-dvh min-h-0 flex flex-col items-center justify-center gap-8 px-6 overflow-hidden"
      style={{ background: "var(--surface-bright)", color: "var(--on-surface)" }}
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <Image
          src="/anaxi-logo.png"
          alt=""
          width={72}
          height={72}
          priority
          className="h-[72px] w-[72px] object-contain"
        />
        <h1 className="font-newsreader text-3xl font-semibold tracking-tight text-[var(--on-surface)]">
          Anaxi
        </h1>
        <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed">
          Sign in to your school dashboard.
        </p>
      </div>
      <Link
        href="/login"
        className="inline-flex items-center justify-center min-h-12 px-10 rounded-xl bg-[var(--primary-container)] text-white text-base font-semibold hover:opacity-90 transition-opacity"
      >
        Sign in
      </Link>
    </div>
  );
}
