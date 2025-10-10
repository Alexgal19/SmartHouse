// src/app/api/inspections/route.ts
import { NextResponse } from 'next/server';
import { getInspections } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const inspections = await getInspections();
    return NextResponse.json(inspections);
  } catch (error) {
    console.error('[API_INSPECTIONS_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

    