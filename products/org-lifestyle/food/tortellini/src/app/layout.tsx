import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Ga4Script } from "@/components/ga4/Ga4Script";

const nunito = Nunito({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Tortellini Studio",
  description:
    "Warm pasta-plate UI: tortellini and spaghetti gamberoni with swatches, hero photos, and a comfort dial.",
  openGraph: {
    title: "Tortellini Studio",
    description: "Two plates — tortellini & spaghetti gamberoni — translated into color and glow.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={nunito.className}>
        <Ga4Script />
        {children}</body>
    </html>
  );
}
