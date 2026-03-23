import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
