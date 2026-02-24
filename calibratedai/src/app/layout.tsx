import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "CalibratedAI — Do Models Know What They Don't Know?",
  description:
    "Real-time AI calibration benchmark: 10 models tested on 100 Polymarket prediction events, ranked by Brier Score, ECE, and bias.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${mono.variable} font-sans bg-[#070c18] text-slate-100 min-h-screen antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
