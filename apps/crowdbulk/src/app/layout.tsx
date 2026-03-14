import './globals.css'

export const metadata = {
  title: 'CrowdBulk',
  description: 'Bulk inference powered by the crowd\'s in-browser LLMs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', color: '#e4e4e4', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
