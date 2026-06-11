import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';

/** Ręczne uruchomienie alertów z UI — tylko dla adminów */
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting
  const identifier = session.uid ? `u:${session.uid}` : 'ip:unknown';
  const rate = checkRateLimit('/api/alerts/run', identifier);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.', retryAfterMs: rate.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rate.retryAfterMs / 1000)) } }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sw-house.pl';
  const res = await fetch(`${baseUrl}/api/alerts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET?.trim()}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
