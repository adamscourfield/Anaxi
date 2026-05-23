import "./globals.css";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Inter, Space_Mono } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";
import { motionRootCssProperties } from "@/lib/motion/tokens";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

/** Inline font stacks so `var(--font-*)` always resolves (layer / hydration safe). */
const rootFontVars = {
  "--font-space-mono": spaceMono.style.fontFamily,
  "--font-inter": inter.style.fontFamily,
  "--font-space-grotesk": spaceMono.style.fontFamily,
  "--font-jetbrains-mono": inter.style.fontFamily,
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
      className={`${inter.variable} ${spaceMono.variable} ${inter.className}`}
      style={rootFontVars}
    >
      <body className="antialiased bg-[var(--surface-bright)] text-[var(--on-surface)]">
          <SessionProvider>{children}</SessionProvider>
        </body>
    </html>
  );
}
