
import { redirect } from 'next/navigation';
import LoginPage from './login/page';
import { getSession } from '@/lib/auth';

export default async function Home() {
  const session = await getSession();

  if (session.isLoggedIn) {
    redirect('/dashboard?view=dashboard');
  } 
  
  return <LoginPage />;
}
