import type { Metadata } from "next";
import "./globals.css";
import { Ga4Script } from "@/components/ga4/Ga4Script";

export const metadata: Metadata = {
  title: "LLM Internals — Dissect a tiny LLM in the browser",
  description:
    "Run a minimal transformer in the browser. Watch layer activations and replace the head for classifier softmax outputs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[var(--bg)] text-zinc-200">
        <Ga4Script />
        {children}
      </body>
    </html>
  );
}
