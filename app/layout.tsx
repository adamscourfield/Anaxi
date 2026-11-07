import "./globals.css";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import localFont from "next/font/local";
import { SessionProvider } from "@/components/session-provider";
import { motionRootCssProperties } from "@/lib/motion/tokens";

const inter = localFont({ src: "./fonts/inter.woff2", weight: "300 700", variable: "--font-inter", display: "swap" });
const spaceGrotesk = localFont({ src: "./fonts/space-grotesk.woff2", weight: "400 700", variable: "--font-space-grotesk", display: "swap" });
const jetbrainsMono = localFont({ src: "./fonts/jetbrains-mono.woff2", weight: "400 700", variable: "--font-jetbrains-mono", display: "swap", adjustFontFallback: false, fallback: ["monospace"] });

/** Inline font stacks so `var(--font-*)` always resolves (layer / hydration safe). */
const rootFontVars = {
  "--font-inter": inter.style.fontFamily,
  "--font-space-grotesk": spaceGrotesk.style.fontFamily,
  "--font-jetbrains-mono": jetbrainsMono.style.fontFamily,
} as CSSProperties;

export const metadata: Metadata = {
  title: {
    default: "Anaxi — Institutional intelligence for schools",
    template: "%s · Anaxi",
  },
  description:
    "Observations, assessments, and leadership signals in one place—so your school can act with evidence.",
  openGraph: {
    title: "Anaxi — Institutional intelligence for schools",
    description:
      "Observations, assessments, and leadership signals in one place—so your school can act with evidence.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.className}`}
      style={rootFontVars}
    >
      <body className="antialiased bg-[var(--surface-bright)] text-[var(--on-surface)]">
          <SessionProvider>{children}</SessionProvider>
        </body>
    </html>
  );
}
