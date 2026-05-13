import "./globals.css";
import type { CSSProperties } from "react";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
});

/** Inline font stacks so `var(--font-*)` always resolves (layer / hydration safe). */
const rootFontVars = {
  "--font-inter": inter.style.fontFamily,
  "--font-space-grotesk": spaceGrotesk.style.fontFamily,
  "--font-jetbrains-mono": jetbrainsMono.style.fontFamily,
} as CSSProperties;

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
