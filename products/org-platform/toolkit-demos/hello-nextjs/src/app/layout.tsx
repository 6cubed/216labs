import type { Metadata } from "next";
import { ClientErrorReporter } from "@216labs/errors/react";
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: "Hello Next.js — toolkit demo",
  description: "Minimal Next.js service in the production-grade vibes toolkit monorepo.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem", lineHeight: 1.5 }}>
        <Ga4Script />
        <ClientErrorReporter appId="hello-nextjs" />
        {children}
      </body>
    </html>
  );
}
