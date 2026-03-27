import "./globals.css";

export const metadata = {
  title: "216Labs Groundtruth",
  description:
    "Image dataset labeling app with separate requester and labeller workflows.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
