
// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import { getNotificationsFromSheet } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const notifications = await getNotificationsFromSheet();
    return NextResponse.json(notifications);
  } catch (error) {
    console.error('[API_NOTIFICATIONS_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new NextResponse(JSON.stringify({ message: errorMessage }), { status: 500 });
  }
}

    