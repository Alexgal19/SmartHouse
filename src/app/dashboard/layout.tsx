import { redirect } from 'next/navigation';

import MainLayout from '@/components/main-layout';
import { getSession } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    redirect('/login');
  }

  return <MainLayout initialSession={session}>{children}</MainLayout>;
}
