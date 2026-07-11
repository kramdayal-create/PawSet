import type { Metadata } from "next";
import { Manrope, Fredoka, Caveat } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PawSet — Everything your pet needs, in one place",
  description:
    "Keep everything about them — their routine, their health, and the people who love them — in one place, ready to share the moment you're away.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${fredoka.variable} ${caveat.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
