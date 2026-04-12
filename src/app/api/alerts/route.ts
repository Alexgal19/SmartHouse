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
  link: string; // deep link do konkretnego formularza
}

async function sendAlerts(alerts: Alert[], admins: Coordinator[]): Promise<void> {
  const adminUids = admins.map((a) => a.uid);

  for (const alert of alerts) {
    // zbierz unikalne UIDs: koordynatorzy + wszyscy admini
    const recipients = [...new Set([...alert.coordinatorIds, ...adminUids])];
    await Promise.allSettled(
      recipients.map((uid) => sendPushNotification(uid, alert.title, alert.body, alert.link))
    );
  }
}

// ─── Alert 1: Wygasające umowy (Employees) ────────────────────────────────
const CONTRACT_EXPIRY_THRESHOLDS: Record<number, { urgency: string; label: string }> = {
  30: { urgency: '🟡', label: '1 miesiąc'   },
  21: { urgency: '🟡', label: '3 tygodnie'  },
  14: { urgency: '🟠', label: '2 tygodnie'  },
   7: { urgency: '🟠', label: '1 tydzień'   },
   2: { urgency: '🔴', label: '2 dni'       },
};

function checkContractExpiry(employees: Employee[]): Alert[] {
  const t = today();
  const alerts: Alert[] = [];

  // Grupuj pracowników per koordynator
  type Group = {
    expired:  { name: string; date: string; id: string }[];
    urgent:   { name: string; daysLeft: number; date: string; id: string }[]; // <=7 dni
    warning:  { name: string; daysLeft: number; date: string; id: string }[]; // 8-14 dni
    info:     { name: string; daysLeft: number; date: string; id: string }[]; // 15-30 dni
  };
  const byCoordinator = new Map<string, Group>();

  const getGroup = (coordId: string): Group => {
    if (!byCoordinator.has(coordId)) {
      byCoordinator.set(coordId, { expired: [], urgent: [], warning: [], info: [] });
    }
    return byCoordinator.get(coordId)!;
  };

  for (const emp of employees) {
    if (emp.status !== 'active') continue;
    const end = parseDate(emp.contractEndDate);
    if (!end) continue;

    const daysLeft = daysDiff(t, end);
    const coordId = emp.coordinatorId ?? '__none__';

    if (daysLeft < 0) {
      // Umowa już przeterminowana — alert codziennie dopóki nie zaktualizowana
      getGroup(coordId).expired.push({ name: emp.fullName, date: emp.contractEndDate!, id: emp.id });
    } else {
      const threshold = CONTRACT_EXPIRY_THRESHOLDS[daysLeft];
      if (!threshold) continue; // nie pasuje do progu — pomijamy

      const entry = { name: emp.fullName, daysLeft, date: emp.contractEndDate!, id: emp.id };
      if (daysLeft <= 7)       getGroup(coordId).urgent.push(entry);
      else if (daysLeft <= 14) getGroup(coordId).warning.push(entry);
      else                     getGroup(coordId).info.push(entry);
    }
  }

  // Zbuduj jedno zbiorcze powiadomienie per koordynator
  for (const [coordId, group] of byCoordinator) {
    const lines: string[] = [];

    if (group.expired.length > 0) {
      lines.push(`⛔ Przeterminowane: ${group.expired.map(e => `${e.name} (${e.date})`).join(', ')}`);
    }
    if (group.urgent.length > 0) {
      lines.push(`🔴 ${group.urgent.map(e => `${e.name} — ${e.daysLeft} dni`).join(', ')}`);
    }
    if (group.warning.length > 0) {
      lines.push(`🟠 ${group.warning.map(e => `${e.name} — ${e.daysLeft} dni`).join(', ')}`);
    }
    if (group.info.length > 0) {
      lines.push(`🟡 ${group.info.map(e => `${e.name} — ${e.daysLeft} dni`).join(', ')}`);
    }

    if (lines.length === 0) continue;

    const totalCount = group.expired.length + group.urgent.length + group.warning.length + group.info.length;
    const hasExpired = group.expired.length > 0;
    const hasUrgent  = group.urgent.length > 0;

    // Link do pierwszej osoby z najwyższym priorytetem
    const topPerson = group.expired[0] ?? group.urgent[0] ?? group.warning[0] ?? group.info[0];

    alerts.push({
      coordinatorIds: coordId === '__none__' ? [] : [coordId],
      title: hasExpired
        ? `⛔ ${group.expired.length} przeterminowana(-ych) umowa(-ów)`
        : hasUrgent
          ? `🔴 Wygasające umowy — ${totalCount} osób`
          : `🟡 Wygasające umowy — ${totalCount} osób`,
      body: lines.join('\n'),
      link: `/dashboard?view=employees&edit=${topPerson.id}`,
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
      link: `/dashboard?view=employees&tab=bok-residents&edit=${res.id}`,
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
        link: `/dashboard?view=housing&address=${addr.id}`,
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
      link: `/dashboard?view=employees&tab=non-employees&edit=${nz.id}`,
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

  employees.forEach((e) => {
    if (e.status !== 'active' || e.checkInDate) return;
    alerts.push({
      coordinatorIds: e.coordinatorId ? [e.coordinatorId] : [],
      title: `📅 Brak daty zameldowania`,
      body: `${e.fullName} (Pracownik) — status aktywny, ale brak daty zameldowania. Proszę uzupełnić.`,
      link: `/dashboard?view=employees&edit=${e.id}`,
    });
  });

  nonEmployees.forEach((nz) => {
    if (nz.status !== 'active' || nz.checkInDate) return;
    alerts.push({
      coordinatorIds: nz.coordinatorId ? [nz.coordinatorId] : [],
      title: `📅 Brak daty zameldowania`,
      body: `${nz.fullName} (NZ) — status aktywny, ale brak daty zameldowania. Proszę uzupełnić.`,
      link: `/dashboard?view=employees&tab=non-employees&edit=${nz.id}`,
    });
  });

  bokResidents.forEach((bok) => {
    if (bok.status === 'dismissed' || bok.checkInDate) return;
    alerts.push({
      coordinatorIds: bok.coordinatorId ? [bok.coordinatorId] : [],
      title: `📅 Brak daty zameldowania`,
      body: `${bok.fullName} (BOK) — status aktywny, ale brak daty zameldowania. Proszę uzupełnić.`,
      link: `/dashboard?view=employees&tab=bok-residents&edit=${bok.id}`,
    });
  });

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
