import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/** Ręczne uruchomienie alertów z UI — tylko dla adminów */
export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sw-house.pl';
  const res = await fetch(`${baseUrl}/api/alerts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
