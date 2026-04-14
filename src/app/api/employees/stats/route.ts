import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEmployees } from '@/lib/sheets';

/** Statystyki pracowników (aktywni / zwolnieni) — tylko dla adminów */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const employees = await getEmployees();
    const active = employees.filter(e => e.status === 'active').length;
    const dismissed = employees.filter(e => e.status === 'dismissed').length;

    return NextResponse.json({ active, dismissed, total: employees.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
