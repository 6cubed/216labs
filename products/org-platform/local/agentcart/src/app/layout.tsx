export const metadata = {
  title: "AgentCart",
  description: "Agentic commerce demo — JSON catalog, policies, and checkout API",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0c0f14",
          color: "#e8eaef",
          lineHeight: 1.55,
        }}
      >
        {children}
      </body>
    </html>
  );
}
