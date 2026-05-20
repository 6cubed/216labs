import type { Metadata } from "next";
import { ClientErrorReporter } from "@216labs/errors/react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
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
  title: "Shannon Airport — satellite & flight context",
  description:
    "Public satellite imagery layers and live ADS-B context for Shannon Airport (EINN), Ireland.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <Ga4Script />
        <ClientErrorReporter appId="shannonairport" />
        {children}
      </body>
    </html>
  );
}
