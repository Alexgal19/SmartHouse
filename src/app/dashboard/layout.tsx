import { getSession } from '@/lib/session';
import MainLayout from '@/components/main-layout';
import { ReactNode } from 'react';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
    children,
  }: {
    children: ReactNode;
  }) {
    const session = await getSession();

    if (!session.isLoggedIn) {
      redirect('/');
    }

    // Spread the session object to pass a plain object to the client component
    const plainSession = { ...session };
    
    return (
      <MainLayout initialSession={plainSession}>
        {children}
      </MainLayout>
    );
  }
