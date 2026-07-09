import type { Metadata } from "next";
import { Lexend, Anton } from "next/font/google";
import "./globals.css";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PawSet — Everything your pet needs, in one place",
  description:
    "Organise your pet's routines, vet details, and trusted people into a beautiful care guide you can share with sitters and family in one tap.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lexend.variable} ${anton.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <div className="page-frame" aria-hidden="true" />
      </body>
    </html>
  );
}
