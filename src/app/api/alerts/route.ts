import { NextRequest, NextResponse } from 'next/server';
import { getEmployees, getNonEmployees, getBokResidents, getSettings } from '@/lib/sheets';
import { sendPushNotification } from '@/lib/actions';
import { alertToday, parseAlertDate, daysDiff, extractAlertDetails } from '@/lib/alert-utils';
import type { Employee, NonEmployee, BokResident, Coordinator } from '@/types';

// ─── Auth ──────────────────────────────────────────────────────────────────
function authorize(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ─── Notification helpers ──────────────────────────────────────────────────
interface Alert {
  coordinatorIds: string[];
  title: string;
  body: string;
  link: string;
}

async function sendAlerts(alerts: Alert[], admins: Coordinator[]): Promise<void> {
  const adminUids = admins.map((a) => a.uid);
  for (const alert of alerts) {
    const recipients = [...new Set([...alert.coordinatorIds, ...adminUids])];
    await Promise.allSettled(
      recipients.map((uid) => sendPushNotification(uid, alert.title, alert.body, alert.link))
    );
  }
}

// ─── Alert 1: Wygasające umowy — zbiorcze per koordynator ─────────────────
const CONTRACT_EXPIRY_THRESHOLDS: Record<number, { urgency: string; label: string }> = {
  30: { urgency: '🟡', label: '1 miesiąc'  },
  21: { urgency: '🟡', label: '3 tygodnie' },
  14: { urgency: '🟠', label: '2 tygodnie' },
   7: { urgency: '🟠', label: '1 tydzień'  },
   2: { urgency: '🔴', label: '2 dni'      },
};

function checkContractExpiry(employees: Employee[]): Alert[] {
  const t = alertToday();

  type Group = {
    expired: { name: string; date: string; id: string }[];
    urgent:  { name: string; daysLeft: number; date: string; id: string }[];
    warning: { name: string; daysLeft: number; date: string; id: string }[];
    info:    { name: string; daysLeft: number; date: string; id: string }[];
  };
  const byCoordinator = new Map<string, Group>();
  const getGroup = (coordId: string): Group => {
    if (!byCoordinator.has(coordId)) byCoordinator.set(coordId, { expired: [], urgent: [], warning: [], info: [] });
    return byCoordinator.get(coordId)!;
  };

  for (const emp of employees) {
    if (emp.status !== 'active') continue;
    const end = parseAlertDate(emp.contractEndDate);
    if (!end) continue;
    const daysLeft = daysDiff(t, end);
    const coordId = emp.coordinatorId ?? '__none__';

    if (daysLeft < 0) {
      getGroup(coordId).expired.push({ name: emp.fullName, date: emp.contractEndDate!, id: emp.id });
    } else {
      const threshold = CONTRACT_EXPIRY_THRESHOLDS[daysLeft];
      if (!threshold) continue;
      const entry = { name: emp.fullName, daysLeft, date: emp.contractEndDate!, id: emp.id };
      if (daysLeft <= 7)       getGroup(coordId).urgent.push(entry);
      else if (daysLeft <= 14) getGroup(coordId).warning.push(entry);
      else                     getGroup(coordId).info.push(entry);
    }
  }

  const alerts: Alert[] = [];
  for (const [coordId, group] of byCoordinator) {
    const lines: string[] = [];
    if (group.expired.length > 0) lines.push(`⛔ Przeterminowane: ${group.expired.map(e => `${e.name} (${e.date})`).join(', ')}`);
    if (group.urgent.length > 0)  lines.push(`🔴 ${group.urgent.map(e => `${e.name} — ${e.daysLeft} dni`).join(', ')}`);
    if (group.warning.length > 0) lines.push(`🟠 ${group.warning.map(e => `${e.name} — ${e.daysLeft} dni`).join(', ')}`);
    if (group.info.length > 0)    lines.push(`🟡 ${group.info.map(e => `${e.name} — ${e.daysLeft} dni`).join(', ')}`);
    if (lines.length === 0) continue;

    const totalCount = group.expired.length + group.urgent.length + group.warning.length + group.info.length;
    const hasExpired = group.expired.length > 0;
    const hasUrgent  = group.urgent.length > 0;
    const topPerson  = group.expired[0] ?? group.urgent[0] ?? group.warning[0] ?? group.info[0];

    alerts.push({
      coordinatorIds: coordId === '__none__' ? [] : [coordId],
      title: hasExpired
        ? `⛔ ${group.expired.length} przeterminowana(-ych) umowa(-ów)`
        : hasUrgent ? `🔴 Wygasające umowy — ${totalCount} osób` : `🟡 Wygasające umowy — ${totalCount} osób`,
      body: lines.join('\n'),
      link: `/dashboard?view=employees&edit=${topPerson.id}`,
    });
  }
  return alerts;
}

// ─── Alert 4: Niespójny status BOK ────────────────────────────────────────
function checkBokStatusInconsistency(bokResidents: BokResident[]): Alert[] {
  const t = alertToday();
  return bokResidents
    .filter(res => {
      if (res.status === 'dismissed') return false;
      const dismiss = parseAlertDate(res.dismissDate);
      return !!dismiss && dismiss <= t;
    })
    .map(res => ({
      coordinatorIds: res.coordinatorId ? [res.coordinatorId] : [],
      title: `⚠️ Niespójny status BOK`,
      body: `${res.fullName} — data zwolnienia minęła (${res.dismissDate}), ale status to "${res.status}". Proszę zaktualizować.`,
      link: `/dashboard?view=employees&tab=bok-residents&edit=${res.id}`,
    }));
}

// ─── Alert 5: Przekroczona pojemność ──────────────────────────────────────
type AddressForAlert = {
  id: string; name: string; coordinatorIds: string[];
  rooms: { id: string; name: string; capacity: number; isActive: boolean }[];
};

function checkCapacity(
  employees: Employee[], nonEmployees: NonEmployee[], bokResidents: BokResident[], addresses: AddressForAlert[]
): Alert[] {
  const occupancy = new Map<string, number>();
  const countPerson = (p: { status: string; address: string; roomNumber: string }) => {
    if (p.status !== 'active') return;
    const key = `${p.address}|${p.roomNumber}`;
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
  };
  employees.forEach(countPerson);
  nonEmployees.forEach(countPerson);
  bokResidents.forEach(countPerson);

  const alerts: Alert[] = [];
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
        body: `${addr.name} / ${room.name}: ${current} osób przy pojemności ${room.capacity}.`,
        link: `/dashboard?view=housing&address=${addr.id}`,
      });
    }
  }
  return alerts;
}

// ─── Alert 7: NZ bez danych płatności ─────────────────────────────────────
function checkMissingPaymentData(nonEmployees: NonEmployee[]): Alert[] {
  return nonEmployees
    .filter(nz => nz.status === 'active' && (!nz.paymentType || nz.paymentAmount == null))
    .map(nz => {
      const missing: string[] = [];
      if (!nz.paymentType) missing.push('typ płatności');
      if (nz.paymentAmount == null) missing.push('kwota');
      return {
        coordinatorIds: nz.coordinatorId ? [nz.coordinatorId] : [],
        title: `💳 Brakujące dane płatności NZ`,
        body: `${nz.fullName} — brak: ${missing.join(', ')}.`,
        link: `/dashboard?view=employees&tab=non-employees&edit=${nz.id}`,
      };
    });
}

// ─── Alert 9: Zdublowane osoby wśród aktywnych ────────────────────────────
// Weryfikacja zdublowanych osób:
// - Porównujemy wyłącznie Pracownicy ↔ NZ (BOK to oddzielna struktura)
// - Dopasowanie tylko identyczne: trim + uppercase, każda różnica znaku = różne osoby
function checkDuplicatePersons(
  employees: Employee[],
  nonEmployees: NonEmployee[]
): Alert[] {
  type PersonForDupe = {
    id: string;
    fullName: string;
    normalizedName: string;
    coordinatorId: string | null;
    type: 'Pracownik' | 'NZ';
    link: string;
  };

  const allActive: PersonForDupe[] = [
    ...employees.filter(e => e.status === 'active').map(e => ({
      id: e.id,
      fullName: e.fullName,
      normalizedName: e.fullName.trim().toUpperCase().replace(/\s+/g, ' '),
      coordinatorId: e.coordinatorId ?? null,
      type: 'Pracownik' as const,
      link: `/dashboard?view=employees&edit=${e.id}`,
    })),
    ...nonEmployees.filter(nz => nz.status === 'active').map(nz => ({
      id: nz.id,
      fullName: nz.fullName,
      normalizedName: nz.fullName.trim().toUpperCase().replace(/\s+/g, ' '),
      coordinatorId: nz.coordinatorId ?? null,
      type: 'NZ' as const,
      link: `/dashboard?view=employees&tab=non-employees&edit=${nz.id}`,
    })),
  ];

  const nameGroups = new Map<string, PersonForDupe[]>();
  for (const p of allActive) {
    if (!nameGroups.has(p.normalizedName)) nameGroups.set(p.normalizedName, []);
    nameGroups.get(p.normalizedName)!.push(p);
  }

  // Grupuj duplikaty per koordynator — każdy koordynator dostaje swój alert
  const byCoordinator = new Map<string, { name: string; types: string; link: string }[]>();

  for (const group of nameGroups.values()) {
    if (group.length < 2) continue;
    const types = group.map(p => p.type).join(', ');
    const involvedCoordIds = [...new Set(group.map(p => p.coordinatorId ?? '__none__'))];

    for (const coordId of involvedCoordIds) {
      if (!byCoordinator.has(coordId)) byCoordinator.set(coordId, []);
      byCoordinator.get(coordId)!.push({
        name: group[0].fullName,
        types,
        link: group.find(p => (p.coordinatorId ?? '__none__') === coordId)?.link ?? group[0].link,
      });
    }
  }

  const alerts: Alert[] = [];
  for (const [coordId, dupes] of byCoordinator) {
    const lines = dupes.map(d => `${d.name} — ${d.types}`);
    alerts.push({
      coordinatorIds: coordId === '__none__' ? [] : [coordId],
      title: `👥 Zdublowane osoby — ${dupes.length}`,
      body: lines.join('\n'),
      link: dupes[0].link,
    });
  }
  return alerts;
}

// ─── Alert 8: Aktywny mieszkaniec bez daty zameldowania ───────────────────
function checkMissingCheckInDate(
  employees: Employee[], nonEmployees: NonEmployee[], bokResidents: BokResident[]
): Alert[] {
  const alerts: Alert[] = [];
  employees.forEach(e => {
    if (e.status !== 'active' || e.checkInDate) return;
    alerts.push({ coordinatorIds: e.coordinatorId ? [e.coordinatorId] : [], title: `📅 Brak daty zameldowania`, body: `${e.fullName} (Pracownik) — brak daty zameldowania.`, link: `/dashboard?view=employees&edit=${e.id}` });
  });
  nonEmployees.forEach(nz => {
    if (nz.status !== 'active' || nz.checkInDate) return;
    alerts.push({ coordinatorIds: nz.coordinatorId ? [nz.coordinatorId] : [], title: `📅 Brak daty zameldowania`, body: `${nz.fullName} (NZ) — brak daty zameldowania.`, link: `/dashboard?view=employees&tab=non-employees&edit=${nz.id}` });
  });
  bokResidents.forEach(bok => {
    if (bok.status === 'dismissed' || bok.checkInDate) return;
    alerts.push({ coordinatorIds: bok.coordinatorId ? [bok.coordinatorId] : [], title: `📅 Brak daty zameldowania`, body: `${bok.fullName} (BOK) — brak daty zameldowania.`, link: `/dashboard?view=employees&tab=bok-residents&edit=${bok.id}` });
  });
  return alerts;
}

// ─── Route handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [employees, nonEmployees, bokResidents, settings] = await Promise.all([
      getEmployees(), getNonEmployees(), getBokResidents(), getSettings(),
    ]);

    const admins = settings.coordinators.filter((c) => c.isAdmin && c.pushSubscription);

    const allAlerts: Alert[] = [
      ...checkContractExpiry(employees),
      ...checkBokStatusInconsistency(bokResidents),
      ...checkCapacity(employees, nonEmployees, bokResidents, settings.addresses),
      ...checkMissingPaymentData(nonEmployees),
      ...checkMissingCheckInDate(employees, nonEmployees, bokResidents),
      ...checkDuplicatePersons(employees, nonEmployees),
    ];

    if (allAlerts.length > 0) await sendAlerts(allAlerts, admins);

    const details = extractAlertDetails(employees, nonEmployees, bokResidents, settings.addresses);
    const summary = {
      contractExpiry:        details.contractExpiry.length,
      bokStatusInconsistency: details.bokStatusInconsistency.length,
      capacityExceeded:      details.capacityExceeded.length,
      missingPaymentData:    details.missingPaymentData.length,
      missingCheckInDate:    details.missingCheckInDate.length,
      duplicatePersons:      details.duplicatePersons.length,
    };

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      totalAlerts: Object.values(summary).reduce((s, n) => s + n, 0),
      summary,
      details,
    });
  } catch (err) {
    console.error('[Alerts] Błąd:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
