
// src/app/api/settings/route.ts
import { NextResponse } from 'next/server';
import { getSettingsFromSheet } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getSettingsFromSheet();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[API_SETTINGS_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new NextResponse(JSON.stringify({ message: errorMessage }), { status: 500 });
  }
}

    