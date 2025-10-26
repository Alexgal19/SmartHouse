import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/app/globals.css'
import { Toaster } from '@/components/ui/toaster'


const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SmartHouse',
  description: 'Zarządzanie pracownikami i inspekcjami',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
