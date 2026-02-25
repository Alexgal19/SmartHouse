import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import type { SessionData } from '@/types';
import ClientLayout from './client-layout';

export const maxDuration = 60;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    // Middleware handles redirecting to /login with callbackUrl.
    // This is a safety fallback in case middleware is bypassed.
    redirect('/login');
  }

  // Utwórz prosty, serializowalny obiekt z danych sesji
  const sessionData: SessionData = {
    isLoggedIn: session.isLoggedIn,
    uid: session.uid,
    name: session.name,
    isAdmin: session.isAdmin,
    isDriver: session.isDriver || false,
  };

  return <ClientLayout initialSession={sessionData}>{children}</ClientLayout>;
}
