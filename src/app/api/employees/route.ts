
// src/app/api/employees/route.ts
import { NextResponse } from 'next/server';
import { getEmployeesFromSheet } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const employees = await getEmployeesFromSheet({ all: true });
    return NextResponse.json(employees);
  } catch (error) {
    console.error('[API_EMPLOYEES_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

    