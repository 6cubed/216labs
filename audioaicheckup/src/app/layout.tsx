import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audio AI Checkup — Benchmark multimodal LLMs on audio",
  description:
    "Record audio and test how well GPT-4o, Gemini 2.0 Flash, and Gemini 1.5 Pro can answer questions about it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
