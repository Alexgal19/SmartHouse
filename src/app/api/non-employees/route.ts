
// src/app/api/non-employees/route.ts
import { NextResponse } from 'next/server';
import { getNonEmployeesFromSheet } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const nonEmployees = await getNonEmployeesFromSheet();
    return NextResponse.json(nonEmployees);
  } catch (error) {
    console.error('[API_NON_EMPLOYEES_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new NextResponse(JSON.stringify({ message: errorMessage }), { status: 500 });
  }
}
