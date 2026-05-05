import type { Employee, NonEmployee, BokResident } from '@/types';

// ─── Date helpers ──────────────────────────────────────────────────────────
export function alertToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseAlertDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function daysDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ─── Detail types ──────────────────────────────────────────────────────────
export interface AlertDetailItem {
  id: string;
  name: string;
  link: string;
  extra: string;
  coordinatorId: string | null;
  coordinatorIds?: string[];
}

export interface AlertDetails {
  contractExpiry: AlertDetailItem[];
  bokStatusInconsistency: AlertDetailItem[];
  capacityExceeded: AlertDetailItem[];
  missingPaymentData: AlertDetailItem[];
  duplicatePersons: AlertDetailItem[];
}

type AddressForAlert = {
  id: string;
  name: string;
  coordinatorIds: string[];
  rooms: { id: string; name: string; capacity: number; isActive: boolean }[];
};

type CoordinatorForAlert = { uid: string; name: string };

// ─── Detail extraction (for display in panels) ────────────────────────────
export function extractAlertDetails(
  employees: Employee[],
  nonEmployees: NonEmployee[],
  bokResidents: BokResident[],
  addresses: AddressForAlert[],
  coordinators: CoordinatorForAlert[] = []
): AlertDetails {
  const t = alertToday();

  // Contract expiry: active employees with contract ending ≤30 days OR already expired
  const expired: AlertDetailItem[] = [];
  const expiring: AlertDetailItem[] = [];

  for (const e of employees) {
    if (e.status !== 'active' || !e.contractEndDate) continue;
    const end = parseAlertDate(e.contractEndDate);
    if (!end) continue;
    const daysLeft = daysDiff(t, end);
    if (daysLeft > 30) continue;

    const item: AlertDetailItem = {
      id: e.id,
      name: e.fullName,
      link: `/dashboard?view=employees&edit=${e.id}`,
      extra: daysLeft < 0
        ? `⛔ przeterminowana o ${Math.abs(daysLeft)} dni`
        : daysLeft === 0
          ? `⛔ kończy się dziś`
          : `za ${daysLeft} dni (${e.contractEndDate})`,
      coordinatorId: e.coordinatorId ?? null,
    };

    if (daysLeft < 0) expired.push(item);
    else expiring.push(item);
  }

  expiring.sort((a, b) => {
    const aD = parseInt(a.extra) || 99;
    const bD = parseInt(b.extra) || 99;
    return aD - bD;
  });

  const contractExpiry = [...expired, ...expiring];

  // BOK inconsistency
  const bokStatusInconsistency: AlertDetailItem[] = bokResidents
    .filter(res => {
      if (res.status === 'dismissed') return false;
      const dismiss = parseAlertDate(res.dismissDate);
      return !!dismiss && dismiss <= t;
    })
    .map(res => ({
      id: res.id,
      name: res.fullName,
      link: `/dashboard?view=employees&tab=bok-residents&edit=${res.id}`,
      extra: `data zwolnienia: ${res.dismissDate}`,
      coordinatorId: res.coordinatorId ?? null,
    }));

  // Capacity exceeded
  const occupancy = new Map<string, number>();
  const countPerson = (p: { status: string; address: string; roomNumber: string }) => {
    if (p.status !== 'active') return;
    const key = `${p.address}|${p.roomNumber}`;
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
  };
  employees.forEach(countPerson);
  nonEmployees.forEach(countPerson);
  bokResidents.forEach(countPerson);

  const capacityExceeded: AlertDetailItem[] = [];
  for (const addr of addresses) {
    if (!addr.rooms?.length) continue;
    for (const room of addr.rooms) {
      if (!room.isActive) continue;
      const key = `${addr.name}|${room.name}`;
      const current = occupancy.get(key) ?? 0;
      if (current <= room.capacity) continue;
      capacityExceeded.push({
        id: addr.id,
        name: `${addr.name} / ${room.name}`,
        link: `/dashboard?view=housing&address=${addr.id}`,
        extra: `${current}/${room.capacity} osób`,
        coordinatorId: null,
        coordinatorIds: addr.coordinatorIds ?? [],
      });
    }
  }

  // Missing payment (NZ)
  const missingPaymentData: AlertDetailItem[] = nonEmployees
    .filter(nz => nz.status === 'active' && (!nz.paymentType || nz.paymentAmount == null))
    .map(nz => {
      const missing: string[] = [];
      if (!nz.paymentType) missing.push('typ');
      if (nz.paymentAmount == null) missing.push('kwota');
      return {
        id: nz.id,
        name: nz.fullName,
        link: `/dashboard?view=employees&tab=non-employees&edit=${nz.id}`,
        extra: `brak: ${missing.join(', ')}`,
        coordinatorId: nz.coordinatorId ?? null,
      };
    });


  // Zdublowane osoby — duplikat = ta sama osoba dwa razy u TEGO SAMEGO koordynatora
  // Osoby o tym samym imieniu u różnych koordynatorów NIE są duplikatem
  type PersonForDupe = {
    id: string;
    fullName: string;
    normalizedName: string;
    coordinatorId: string;
    link: string;
  };

  // Grupuj aktywnych pracowników wg koordynatora, potem sprawdzaj duplikaty w każdej grupie
  const activeByCoordinator = new Map<string, PersonForDupe[]>();
  for (const e of employees) {
    if (e.status !== 'active') continue;
    const coordId = e.coordinatorId || '__none__';
    if (!activeByCoordinator.has(coordId)) activeByCoordinator.set(coordId, []);
    activeByCoordinator.get(coordId)!.push({
      id: e.id,
      fullName: e.fullName,
      normalizedName: e.fullName.trim().toUpperCase().replace(/\s+/g, ' '),
      coordinatorId: coordId,
      link: `/dashboard?view=employees&edit=${e.id}`,
    });
  }

  const getCoordName = (id: string) =>
    coordinators.find(c => c.uid === id)?.name ?? null;

  const duplicatePersons: AlertDetailItem[] = [];
  for (const [coordId, persons] of activeByCoordinator) {
    const nameGroups = new Map<string, PersonForDupe[]>();
    for (const p of persons) {
      if (!nameGroups.has(p.normalizedName)) nameGroups.set(p.normalizedName, []);
      nameGroups.get(p.normalizedName)!.push(p);
    }
    const coordName = coordId === '__none__' ? null : getCoordName(coordId);
    for (const group of nameGroups.values()) {
      if (group.length < 2) continue;
      const extra = coordName
        ? `${group.length}x — ${coordName}`
        : `${group.length}x u koordynatora`;
      duplicatePersons.push({
        id: group[0].id,
        name: group[0].fullName,
        link: group[0].link,
        extra,
        coordinatorId: coordId === '__none__' ? null : coordId,
        coordinatorIds: coordId === '__none__' ? [] : [coordId],
      });
    }
  }

  return { contractExpiry, bokStatusInconsistency, capacityExceeded, missingPaymentData, duplicatePersons };
}
