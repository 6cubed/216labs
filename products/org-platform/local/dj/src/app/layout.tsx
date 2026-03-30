export const metadata = {
  title: "DJ",
  description: "Two-track browser mixer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
          background: "#0b1020",
          color: "#eef3ff",
        }}
      >
        {children}
      </body>
    </html>
  );
}

