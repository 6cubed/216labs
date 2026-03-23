import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Múinteoir — Irish Language Tutor",
  description:
    "Learn Irish (Gaeilge) through AI-powered conversation and structured lessons.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ga">
      <body className="min-h-screen font-sans">
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-brand-50 via-surface-50 to-emerald-50/40" />
        <div className="fixed top-0 left-1/4 w-96 h-96 -z-10 bg-brand-200/20 rounded-full blur-3xl" />
        <div className="fixed bottom-1/4 right-1/4 w-80 h-80 -z-10 bg-gold-300/10 rounded-full blur-3xl" />
        {children}
      </body>
    </html>
  );
}
