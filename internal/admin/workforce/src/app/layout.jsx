import "./globals.css";

export const metadata = {
  title: "216Labs Workforce",
  description:
    "Admin app to create digital employees with unique Telegram bot tokens.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
