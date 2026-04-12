import { NextRequest, NextResponse } from 'next/server';
import { getEmployees, getNonEmployees, getBokResidents, getSettings } from '@/lib/sheets';
import { sendPushNotification } from '@/lib/actions';
import type { Employee, NonEmployee, BokResident, Coordinator } from '@/types';

// ─── Auth ──────────────────────────────────────────────────────────────────
function authorize(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ─── Date helpers ──────────────────────────────────────────────────────────
function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function daysDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ─── Notification helpers ──────────────────────────────────────────────────
interface Alert {
  coordinatorIds: string[]; // kto dostaje alert (koordynator + admini)
  title: string;
  body: string;
}

async function sendAlerts(alerts: Alert[], admins: Coordinator[]): Promise<void> {
  const adminUids = admins.map((a) => a.uid);

  for (const alert of alerts) {
    // zbierz unikalne UIDs: koordynatorzy + wszyscy admini
    const recipients = [...new Set([...alert.coordinatorIds, ...adminUids])];
    await Promise.allSettled(
      recipients.map((uid) => sendPushNotification(uid, alert.title, alert.body, '/dashboard'))
    );
  }
}

// ─── Alert 1: Wygasające umowy (Employees) ────────────────────────────────
function checkContractExpiry(employees: Employee[]): Alert[] {
  const t = today();
  const alerts: Alert[] = [];

  for (const emp of employees) {
    if (emp.status !== 'active') continue;
    const end = parseDate(emp.contractEndDate);
    if (!end) continue;

    const daysLeft = daysDiff(t, end);
    if (daysLeft < 0 || daysLeft > 30) continue;

    let urgency = '';
    if (daysLeft <= 7) urgency = '🔴 PILNE';
    else if (daysLeft <= 14) urgency = '🟠 Ważne';
    else urgency = '🟡 Informacja';

    alerts.push({
      coordinatorIds: emp.coordinatorId ? [emp.coordinatorId] : [],
      title: `${urgency}: Wygasająca umowa`,
      body: `${emp.fullName} — umowa kończy się za ${daysLeft} dni (${emp.contractEndDate}). Proszę o przedłużenie.`,
    });
  }

  return alerts;
}

// ─── Alert 4: Niespójny status BOK ────────────────────────────────────────
function checkBokStatusInconsistency(bokResidents: BokResident[]): Alert[] {
  const t = today();
  const alerts: Alert[] = [];

  for (const res of bokResidents) {
    if (res.status === 'dismissed') continue;
    const dismiss = parseDate(res.dismissDate);
    if (!dismiss) continue;
    if (dismiss > t) continue; // data w przyszłości — OK

    alerts.push({
      coordinatorIds: res.coordinatorId ? [res.coordinatorId] : [],
      title: `⚠️ Niespójny status BOK`,
      body: `${res.fullName} — data zwolnienia minęła (${res.dismissDate}), ale status to "${res.status}". Proszę zaktualizować.`,
    });
  }

  return alerts;
}

// ─── Alert 5: Przekroczona pojemność ──────────────────────────────────────
function checkCapacity(
  employees: Employee[],
  nonEmployees: NonEmployee[],
  bokResidents: BokResident[],
  addresses: { id: string; name: string; coordinatorIds: string[]; rooms: { id: string; name: string; capacity: number; isActive: boolean }[] }[]
): Alert[] {
  const alerts: Alert[] = [];

  // Zlicz aktywnych mieszkańców per adres + pokój
  type OccupancyKey = string; // `${addressName}|${roomNumber}`
  const occupancy = new Map<OccupancyKey, number>();

  const countPerson = (p: { status: string; address: string; roomNumber: string }) => {
    if (p.status !== 'active') return;
    const key = `${p.address}|${p.roomNumber}`;
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
  };

  employees.forEach(countPerson);
  nonEmployees.forEach(countPerson);
  bokResidents.forEach(countPerson);

  for (const addr of addresses) {
    if (!addr.rooms?.length) continue;

    for (const room of addr.rooms) {
      if (!room.isActive) continue;
      const key = `${addr.name}|${room.name}`;
      const current = occupancy.get(key) ?? 0;
      if (current <= room.capacity) continue;

      alerts.push({
        coordinatorIds: addr.coordinatorIds ?? [],
        title: `🏠 Przekroczona pojemność pokoju`,
        body: `${addr.name} / ${room.name}: ${current} osób przy pojemności ${room.capacity}. Proszę sprawdzić przydzielenia.`,
      });
    }
  }

  return alerts;
}

// ─── Alert 7: NZ bez danych płatności ─────────────────────────────────────
function checkMissingPaymentData(nonEmployees: NonEmployee[]): Alert[] {
  const alerts: Alert[] = [];

  for (const nz of nonEmployees) {
    if (nz.status !== 'active') continue;
    if (nz.paymentType && nz.paymentAmount != null) continue;

    const missing: string[] = [];
    if (!nz.paymentType) missing.push('typ płatności');
    if (nz.paymentAmount == null) missing.push('kwota');

    alerts.push({
      coordinatorIds: nz.coordinatorId ? [nz.coordinatorId] : [],
      title: `💳 Brakujące dane płatności NZ`,
      body: `${nz.fullName} — brak: ${missing.join(', ')}. Proszę uzupełnić dane płatności.`,
    });
  }

  return alerts;
}

// ─── Alert 8: Aktywny mieszkaniec bez daty zameldowania ───────────────────
function checkMissingCheckInDate(
  employees: Employee[],
  nonEmployees: NonEmployee[],
  bokResidents: BokResident[]
): Alert[] {
  const alerts: Alert[] = [];

  const check = (
    person: { fullName: string; coordinatorId: string; status: string; checkInDate: string | null },
    type: string
  ) => {
    if (person.status !== 'active') return;
    if (person.checkInDate) return;

    alerts.push({
      coordinatorIds: person.coordinatorId ? [person.coordinatorId] : [],
      title: `📅 Brak daty zameldowania`,
      body: `${person.fullName} (${type}) — status aktywny, ale brak daty zameldowania. Proszę uzupełnić.`,
    });
  };

  employees.forEach((e) => check(e, 'Pracownik'));
  nonEmployees.forEach((e) => check(e, 'NZ'));
  bokResidents.forEach((e) => check(e, 'BOK'));

  return alerts;
}

// ─── Route handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Alerts] Rozpoczynam sprawdzanie alertów...');

    const [employees, nonEmployees, bokResidents, settings] = await Promise.all([
      getEmployees(),
      getNonEmployees(),
      getBokResidents(),
      getSettings(),
    ]);

    const admins = settings.coordinators.filter((c) => c.isAdmin && c.pushSubscription);

    // Uruchom wszystkie sprawdzenia
    const allAlerts: Alert[] = [
      ...checkContractExpiry(employees),
      ...checkBokStatusInconsistency(bokResidents),
      ...checkCapacity(employees, nonEmployees, bokResidents, settings.addresses),
      ...checkMissingPaymentData(nonEmployees),
      ...checkMissingCheckInDate(employees, nonEmployees, bokResidents),
    ];

    console.log(`[Alerts] Znaleziono ${allAlerts.length} alertów`);

    if (allAlerts.length > 0) {
      await sendAlerts(allAlerts, admins);
    }

    // Podsumowanie per typ
    const summary = {
      contractExpiry: checkContractExpiry(employees).length,
      bokStatusInconsistency: checkBokStatusInconsistency(bokResidents).length,
      capacityExceeded: checkCapacity(employees, nonEmployees, bokResidents, settings.addresses).length,
      missingPaymentData: checkMissingPaymentData(nonEmployees).length,
      missingCheckInDate: checkMissingCheckInDate(employees, nonEmployees, bokResidents).length,
    };

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      totalAlerts: allAlerts.length,
      summary,
    });
  } catch (err) {
    console.error('[Alerts] Błąd:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
