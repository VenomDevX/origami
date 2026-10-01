import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Origami',
  description: 'Turn any website into Android, iOS, Windows, macOS and Linux apps.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
