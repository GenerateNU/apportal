import type { Metadata, Viewport } from 'next'
import { Geist_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import { getServerSession } from '@/lib/api/server-request-options'
import { Providers } from './providers'
import './globals.css'

const outfit = localFont({
  src: './fonts/Outfit-Variable.ttf',
  variable: '--font-outfit',
  weight: '100 900',
})

const spaceMono = localFont({
  src: [
    { path: './fonts/SpaceMono-Regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/SpaceMono-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-space-mono',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Generate Application Portal',
  description: 'Application portal for Generate NU',
  icons: {
    icon: '/GenerateNU Logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession()

  return (
    <html
      lang="en"
      className={`${outfit.variable} ${spaceMono.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers initialUser={session?.user ?? null}>{children}</Providers>
      </body>
    </html>
  )
}
