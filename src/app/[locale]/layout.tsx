
import { Inter } from 'next/font/google';
import './globals.css';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import '../../i18n'; 
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ 
  children,
  params: {locale}
}: { 
  children: React.ReactNode;
  params: {locale: string};
}) {
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

    