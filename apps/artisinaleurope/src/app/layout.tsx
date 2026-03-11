import type { Metadata } from "next";
import Link from "next/link";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Artisanal Europe — 50 Essential European Experiences",
  description:
    "The definitive guide to the most authentic, essential, and irreplaceable things to do across 50 European cities. Ranked, researched, and worth the journey.",
  openGraph: {
    title: "Artisanal Europe — 50 Essential European Experiences",
    description:
      "From a bespoke Milanese suit to pints at the Willie Clancy festival. The 50 most essential European experiences, ranked.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="antialiased">
        <nav className="sticky top-0 z-50 bg-[#0f1729]/95 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-serif text-lg font-semibold text-white tracking-wide hover:text-amber-300 transition-colors"
            >
              Artisanal Europe
            </Link>
            <span className="text-white/40 text-sm font-light tracking-widest uppercase hidden sm:block">
              50 Essential Experiences
            </span>
          </div>
        </nav>

        <main>{children}</main>
        <footer className="bg-[#0f1729] text-white/60 py-10 mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
            <p className="font-serif italic text-white/40 text-base mb-2">
              &ldquo;Travel is the only thing you buy that makes you richer.&rdquo;
            </p>
            <p className="text-white/30">
              Artisanal Europe &mdash; celebrating authentic experience across the continent
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
