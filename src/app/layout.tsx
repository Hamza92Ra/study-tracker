import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: { default: 'Study Ledger', template: '%s · Study Ledger' },
  description: 'A thoughtful public record of learning and progress.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    title: 'Study Ledger',
    description: 'A thoughtful public record of learning and progress.',
  },
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
    <body>{children}<Toaster position="bottom-right" richColors /></body>
  </html>
}
