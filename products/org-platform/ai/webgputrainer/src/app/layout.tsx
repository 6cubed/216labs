import type { ReactNode } from "react";

export const metadata = {
  title: "WebGPU Trainer",
  description: "Kick off training runs on a mesh of WebGPU workers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui" }}>
        {children}
      </body>
    </html>
  );
}

