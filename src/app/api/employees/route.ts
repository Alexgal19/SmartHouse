// src/app/api/employees/route.ts
import { NextResponse } from 'next/server';
import { getEmployees } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const employees = await getEmployees();
    return NextResponse.json(employees);
  } catch (error) {
    console.error('[API_EMPLOYEES_ERROR]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
