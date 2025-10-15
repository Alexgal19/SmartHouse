import { Inter } from 'next/font/google';
import './globals.css';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import { Toaster } from '@/components/ui/toaster';
import { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'] });

interface Props {
  children: ReactNode;
  params: {
    locale: string;
  };
}

export default function RootLayout({ 
  children,
  params: {locale}
}: Props) {
  const messages = useMessages();

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
