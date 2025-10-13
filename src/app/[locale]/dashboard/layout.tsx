import { Inter } from 'next/font/google';
import '../globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Toaster } from '@/components/ui/toaster';
import { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'] });

interface Props {
  children: ReactNode;
  params: {
    locale: string;
  };
}

export default async function RootLayout({ 
  children,
  params: {locale}
}: Props) {
  const messages = await getMessages();

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
