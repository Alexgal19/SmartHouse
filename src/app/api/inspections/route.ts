
// src/app/api/inspections/route.ts
import { NextResponse } from 'next/server';
import { getInspectionsFromSheet } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const inspections = await getInspectionsFromSheet();
    return NextResponse.json(inspections);
  } catch (error) {
    console.error('[API_INSPECTIONS_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new NextResponse(JSON.stringify({ message: errorMessage }), { status: 500 });
  }
}

    