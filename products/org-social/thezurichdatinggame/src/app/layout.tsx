import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Ga4Script } from "@/components/ga4/Ga4Script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Zurich Dating Game",
  description:
    "Zurich's first AI-powered dating event. Sign up before April 1st and let our AI matchmaker find your perfect first date.",
  openGraph: {
    title: "The Zurich Dating Game",
    description:
      "Zurich's first AI-powered dating event. Sign up before April 1st.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Ga4Script />
        {children}
      </body>
    </html>
  );
}
