import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SPREADSHEET_ID = '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';
const SNAPSHOT_SHEET_NAME = 'DataGuardSnapshots';

function getAuth(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Missing Google credentials');
  return new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

/** Odczyt snapshotu — dostępny dla zalogowanych adminów z UI */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const auth = getAuth();
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle[SNAPSHOT_SHEET_NAME];
    if (!sheet) {
      return NextResponse.json({ snapshot: null });
    }

    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();
    const snapshot: Record<string, { rowCount: number; checkedAt: string }> = {};
    for (const row of rows) {
      const name = row.get('sheetName') as string;
      const count = parseInt(row.get('rowCount') as string, 10);
      const checkedAt = row.get('checkedAt') as string;
      if (name) snapshot[name] = { rowCount: isNaN(count) ? 0 : count, checkedAt };
    }

    return NextResponse.json({ snapshot: Object.keys(snapshot).length > 0 ? snapshot : null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
