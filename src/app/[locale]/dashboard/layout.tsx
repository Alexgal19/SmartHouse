
import MainLayout from '@/components/main-layout';
import { ReactNode } from 'react';
import { unstable_setRequestLocale } from 'next-intl/server';

export default function DashboardLayout({
    children,
    params: {locale}
  }: {
    children: ReactNode;
    params: {locale: string};
  }) {
    unstable_setRequestLocale(locale);
    
    return (
      <MainLayout>
        {children}
      </MainLayout>
    );
  }
