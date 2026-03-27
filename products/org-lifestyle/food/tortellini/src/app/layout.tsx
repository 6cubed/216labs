import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Tortellini Studio",
  description: "A warm, folded-corner UI inspired by creamy tomato sauce, parmesan, and parsley.",
  openGraph: {
    title: "Tortellini Studio",
    description: "Comfort-food palette for the web — inspired by a plate of tortellini.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={nunito.className}>{children}</body>
    </html>
  );
}
