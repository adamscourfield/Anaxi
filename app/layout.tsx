import "./globals.css";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";
import { motionRootCssProperties } from "@/lib/motion/tokens";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${inter.className}`} style={motionRootCssProperties()}>
      <body className="antialiased bg-white text-[var(--on-surface)]">
          <SessionProvider>{children}</SessionProvider>
        </body>
    </html>
  );
}
