import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Ga4Script } from "@/components/Ga4Script";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "LLM Search — AI answers with live web sources",
  description:
    "Ask anything. Web search + citations, streaming answers, chat history, and related questions — a Perplexity-style research UI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-screen`}>
        <Ga4Script />
        {children}
      </body>
    </html>
  );
}
