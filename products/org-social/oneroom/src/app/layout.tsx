import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata: Metadata = {
  title: "OneRoom — AI Interior Designer",
  description:
    "Upload a photo of your room and let AI stage it beautifully — with shoppable links to every piece.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[40%] -right-[20%] h-[80%] w-[60%] rounded-full bg-brand-100/40 blur-3xl" />
          <div className="absolute -bottom-[30%] -left-[20%] h-[70%] w-[50%] rounded-full bg-brand-50/60 blur-3xl" />
        </div>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
