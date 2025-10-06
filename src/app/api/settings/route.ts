// src/app/api/settings/route.ts
import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/sheets'; // We will move logic to a new file

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // This fetch call will be internally cached by Next.js because getSettings will use fetch with revalidate
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[API_SETTINGS_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
