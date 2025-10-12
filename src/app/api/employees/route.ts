
// src/app/api/employees/route.ts
import { NextResponse } from 'next/server';
import { getEmployeesFromSheet } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const employees = await getEmployeesFromSheet();
    return NextResponse.json(employees);
  } catch (error) {
    console.error('[API_EMPLOYEES_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new NextResponse(JSON.stringify({ message: errorMessage }), { status: 500 });
  }
}

    