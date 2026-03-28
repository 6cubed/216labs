import type { Metadata } from "next";
import "./globals.css";
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: "216 Labs Ventures",
  description:
    "Venture capital arm of 216 Labs — backing teams that ship production-grade software and media.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Ga4Script />
        {children}</body>
    </html>
  );
}
