import { Inter } from 'next/font/google';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, unstable_setRequestLocale } from 'next-intl/server';
import { Toaster } from '@/components/ui/toaster';
import { ReactNode } from 'react';
import { locales } from '@/navigation';

const inter = Inter({ subsets: ['latin'] });

interface Props {
  children: ReactNode;
  params: {
    locale: string;
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ 
  children,
  params: {locale}
}: Props) {
  unstable_setRequestLocale(locale);
  const messages = await getMessages({locale});

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
