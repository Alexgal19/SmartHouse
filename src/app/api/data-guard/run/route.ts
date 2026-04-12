import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/** Ręczne uruchomienie Data Guard z UI — tylko dla adminów */
export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Wywołaj główny endpoint wewnętrznie
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sw-house.pl';
  const res = await fetch(`${baseUrl}/api/data-guard`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
