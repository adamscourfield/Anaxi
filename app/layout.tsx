import "./globals.css";
import { Inter } from "next/font/google";
import { SessionProvider } from "@/components/session-provider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${inter.className}`}>
      <body className="bg-[var(--surface-bright)] text-[var(--on-surface)]">
          <SessionProvider>{children}</SessionProvider>
        </body>
    </html>
  );
}
