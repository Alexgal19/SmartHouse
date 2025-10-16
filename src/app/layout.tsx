import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'] });


export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body className={inter.className}>
          {children}
          <Toaster />
      </body>
    </html>
  );
}
