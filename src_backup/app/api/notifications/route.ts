// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import { getNotifications } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const notifications = await getNotifications();
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('[API_NOTIFICATIONS_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
