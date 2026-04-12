import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { sendPushNotification } from '@/lib/actions';
import { getSettings } from '@/lib/sheets';

// ─── Config ────────────────────────────────────────────────────────────────
const SPREADSHEET_ID = '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';

const SNAPSHOT_SHEET_NAME = 'DataGuardSnapshots';
const SNAPSHOT_HEADERS = ['sheetName', 'rowCount', 'checkedAt'];

/** Arkusze krytyczne dla danych biznesowych */
const CRITICAL_SHEETS = [
  'Employees',
  'NonEmployees',
  'Addresses',
  'Rooms',
  'AddressHistory',
  'BokResidents',
  'ControlCards',
  'Coordinators',
];

/** Alert gdy liczba wierszy spada o więcej niż X wierszy LUB X% */
const MIN_DROP_ROWS = 3;
const MIN_DROP_PERCENT = 5;

// ─── Types ─────────────────────────────────────────────────────────────────
interface SheetSnapshot {
  rowCount: number;
  checkedAt: string;
}

interface Snapshot {
  [sheetName: string]: SheetSnapshot;
}

interface AnomalyReport {
  sheet: string;
  prevCount: number;
  currCount: number;
  dropped: number;
  droppedPercent: number;
}

// ─── Auth ──────────────────────────────────────────────────────────────────
function getAuth(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Missing Google service account credentials');
  return new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

// ─── Google Sheets helpers ─────────────────────────────────────────────────
async function getDoc(): Promise<GoogleSpreadsheet> {
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
  await doc.loadInfo();
  return doc;
}

/** Pobierz lub stwórz arkusz DataGuardSnapshots */
async function getSnapshotSheet(doc: GoogleSpreadsheet): Promise<GoogleSpreadsheetWorksheet> {
  let sheet = doc.sheetsByTitle[SNAPSHOT_SHEET_NAME];
  if (!sheet) {
    sheet = await doc.addSheet({ title: SNAPSHOT_SHEET_NAME, headerValues: SNAPSHOT_HEADERS });
  } else {
    await sheet.loadHeaderRow();
  }
  return sheet;
}

// ─── Row counts ────────────────────────────────────────────────────────────
async function fetchRowCounts(doc: GoogleSpreadsheet): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const name of CRITICAL_SHEETS) {
    const sheet = doc.sheetsByTitle[name];
    if (!sheet) {
      counts[name] = -1; // arkusz zniknął — poważny problem
      continue;
    }
    const rows = await sheet.getRows();
    counts[name] = rows.length;
  }
  return counts;
}

// ─── Snapshot storage w Google Sheets ─────────────────────────────────────
async function loadSnapshot(doc: GoogleSpreadsheet): Promise<Snapshot | null> {
  const sheet = await getSnapshotSheet(doc);
  const rows = await sheet.getRows();
  if (rows.length === 0) return null;

  const snapshot: Snapshot = {};
  for (const row of rows) {
    const name = row.get('sheetName') as string;
    const count = parseInt(row.get('rowCount') as string, 10);
    const checkedAt = row.get('checkedAt') as string;
    if (name) {
      snapshot[name] = { rowCount: isNaN(count) ? 0 : count, checkedAt };
    }
  }
  return Object.keys(snapshot).length > 0 ? snapshot : null;
}

async function saveSnapshot(doc: GoogleSpreadsheet, counts: Record<string, number>): Promise<void> {
  const sheet = await getSnapshotSheet(doc);
  const now = new Date().toISOString();

  const existingRows = await sheet.getRows();

  for (const [name, count] of Object.entries(counts)) {
    const existing = existingRows.find((r) => r.get('sheetName') === name);
    if (existing) {
      existing.set('rowCount', String(count));
      existing.set('checkedAt', now);
      await existing.save();
    } else {
      await sheet.addRow({ sheetName: name, rowCount: String(count), checkedAt: now });
    }
  }
}

// ─── Anomaly detection ─────────────────────────────────────────────────────
function detectAnomalies(prev: Snapshot, curr: Record<string, number>): AnomalyReport[] {
  const anomalies: AnomalyReport[] = [];

  for (const [name, currCount] of Object.entries(curr)) {
    const prevEntry = prev[name];
    if (!prevEntry) continue; // brak punktu odniesienia dla tego arkusza

    const prevCount = prevEntry.rowCount;

    if (currCount < 0) {
      // Arkusz zniknął całkowicie!
      anomalies.push({ sheet: name, prevCount, currCount: 0, dropped: prevCount, droppedPercent: 100 });
      continue;
    }

    const dropped = prevCount - currCount;
    if (dropped <= 0) continue; // wzrost lub bez zmian — OK

    const droppedPercent = prevCount > 0 ? Math.round((dropped / prevCount) * 100) : 0;

    if (dropped >= MIN_DROP_ROWS || droppedPercent >= MIN_DROP_PERCENT) {
      anomalies.push({ sheet: name, prevCount, currCount, dropped, droppedPercent });
    }
  }

  return anomalies;
}

// ─── Push notifications ────────────────────────────────────────────────────
async function notifyAdmins(anomalies: AnomalyReport[]): Promise<void> {
  const settings = await getSettings();
  const admins = settings.coordinators.filter((c) => c.isAdmin && c.pushSubscription);

  if (admins.length === 0) {
    console.warn('[DataGuard] Brak adminów z aktywnym push — powiadomienie nie zostanie wysłane');
    return;
  }

  const lines = anomalies.map(
    (a) => `• ${a.sheet}: ${a.prevCount} → ${a.currCount} wierszy (-${a.dropped}, -${a.droppedPercent}%)`
  );

  const title = `⚠️ SmartHouse: Wykryto utratę danych!`;
  const body = `Zmiana w ${anomalies.length} arkuszu/-ach:\n${lines.join('\n')}`;

  await Promise.allSettled(
    admins.map((a) => sendPushNotification(a.uid, title, body, '/dashboard'))
  );

  console.log(`[DataGuard] Powiadomiono ${admins.length} admina(-ów)`);
}

// ─── Route handlers ────────────────────────────────────────────────────────
function authorize(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[DataGuard] Rozpoczynam sprawdzanie danych...');

    const doc = await getDoc();
    const [currentCounts, prevSnapshot] = await Promise.all([
      fetchRowCounts(doc),
      loadSnapshot(doc),
    ]);

    console.log('[DataGuard] Aktualne liczby wierszy:', currentCounts);

    let anomalies: AnomalyReport[] = [];

    if (prevSnapshot) {
      anomalies = detectAnomalies(prevSnapshot, currentCounts);
      if (anomalies.length > 0) {
        console.warn('[DataGuard] ANOMALIE WYKRYTE:', anomalies);
        await notifyAdmins(anomalies);
      } else {
        console.log('[DataGuard] Brak anomalii. Wszystko OK.');
      }
    } else {
      console.log('[DataGuard] Brak poprzedniego snapshotu — inicjalizuję arkusz.');
    }

    await saveSnapshot(doc, currentCounts);

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      sheets: currentCounts,
      anomalies,
      firstRun: !prevSnapshot,
    });
  } catch (err) {
    console.error('[DataGuard] Błąd:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/** GET — podgląd ostatniego snapshotu */
export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const doc = await getDoc();
    const snapshot = await loadSnapshot(doc);
    return NextResponse.json({ snapshot });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
