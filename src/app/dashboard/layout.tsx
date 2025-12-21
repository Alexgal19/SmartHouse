import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import type { SessionData } from '@/types';
import ClientLayout from './client-layout';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect('/login');
  }

  // Utwórz prosty, serializowalny obiekt z danych sesji
  const sessionData: SessionData = {
    isLoggedIn: session.isLoggedIn,
    uid: session.uid,
    name: session.name,
    isAdmin: session.isAdmin,
  };

  return <ClientLayout initialSession={sessionData}>{children}</ClientLayout>;
}
