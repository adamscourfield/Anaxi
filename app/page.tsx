import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-white">
      {/* Logo — top-left */}
      <div className="absolute left-8 top-8 z-10 flex items-center gap-3">
        <Image
          src="/anaxi-logo.png"
          alt="Anaxi"
          width={36}
          height={36}
          priority
          className="h-9 w-9 object-contain"
        />
        <span className="text-sm font-semibold tracking-widest text-[#131b2e] uppercase">
          Anaxi
        </span>
      </div>

      {/* Left panel */}
      <div className="flex w-1/2 flex-col justify-center px-16 pb-10 pt-32">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#76777d]">
          Institutional Grade Software
        </p>

        <h1 className="text-[4.5rem] font-light leading-[1.05] tracking-[-0.03em] text-[#131b2e]">
          Anaxi
        </h1>

        <p className="mt-6 max-w-sm text-base font-normal leading-relaxed text-[#45464d]">
          The operational and pedagogical platform built for schools that demand precision.
        </p>

        <Link
          href="/login"
          className="mt-10 inline-flex w-fit items-center justify-center rounded-lg bg-[#131b2e] px-7 py-3 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-80 active:scale-[0.98]"
        >
          Sign in
        </Link>
      </div>

      {/* Right panel — full-height image */}
      <div className="relative h-full w-1/2">
        <Image
          src="/hero-image.png"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="50vw"
        />
        {/* Subtle left-edge fade into white */}
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent" />
      </div>
    </div>
  );
}
