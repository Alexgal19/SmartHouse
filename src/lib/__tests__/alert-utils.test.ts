import {
  alertToday,
  parseAlertDate,
  daysDiff,
  extractAlertDetails,
} from '../alert-utils';
import type { Employee, NonEmployee, BokResident } from '@/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    firstName: 'Jan',
    lastName: 'Kowalski',
    fullName: 'Jan Kowalski',
    coordinatorId: 'coord1',
    nationality: 'PL',
    gender: 'M',
    address: 'Adres 1',
    roomNumber: '101',
    zaklad: null,
    checkInDate: null,
    checkOutDate: null,
    contractStartDate: null,
    contractEndDate: null,
    status: 'active',
    depositReturned: null,
    depositReturnAmount: null,
    deductionRegulation: null,
    deductionNo4Months: null,
    deductionNo30Days: null,
    deductionReason: undefined,
    ...overrides,
  } as Employee;
}

function makeNonEmployee(overrides: Partial<NonEmployee> = {}): NonEmployee {
  return {
    id: 'ne1',
    firstName: 'Anna',
    lastName: 'Nowak',
    fullName: 'Anna Nowak',
    coordinatorId: 'coord1',
    nationality: 'PL',
    gender: 'F',
    address: 'Adres 1',
    roomNumber: '102',
    checkInDate: null,
    checkOutDate: null,
    status: 'active',
    paymentType: 'przelew',
    paymentAmount: 500,
    ...overrides,
  } as NonEmployee;
}

function makeBokResident(overrides: Partial<BokResident> = {}): BokResident {
  return {
    id: 'bok1',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    fullName: 'Piotr Wiśniewski',
    nationality: 'PL',
    address: 'Adres 1',
    roomNumber: '103',
    gender: 'M',
    checkInDate: null,
    ...overrides,
  } as BokResident;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

const emptyAddresses: Parameters<typeof extractAlertDetails>[3] = [];

// ─── alertToday ─────────────────────────────────────────────────────────────

describe('alertToday', () => {
  it('returns today at midnight (00:00:00.000)', () => {
    const result = alertToday();
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('returns a Date instance', () => {
    expect(alertToday()).toBeInstanceOf(Date);
  });

  it('date matches today', () => {
    const today = new Date();
    const result = alertToday();
    expect(result.getFullYear()).toBe(today.getFullYear());
    expect(result.getMonth()).toBe(today.getMonth());
    expect(result.getDate()).toBe(today.getDate());
  });
});

// ─── parseAlertDate ──────────────────────────────────────────────────────────

describe('parseAlertDate', () => {
  it('returns null for null', () => {
    expect(parseAlertDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseAlertDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseAlertDate('')).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(parseAlertDate('not-a-date')).toBeNull();
  });

  it('returns a Date for a valid ISO date string', () => {
    const result = parseAlertDate('2025-01-15');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(0); // January
    expect(result!.getDate()).toBe(15);
  });

  it('returns a Date for a valid full ISO timestamp', () => {
    const result = parseAlertDate('2025-06-01T10:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result!.getTime())).toBe(false);
  });
});

// ─── daysDiff ────────────────────────────────────────────────────────────────

describe('daysDiff', () => {
  it('returns 0 for same date', () => {
    const d = new Date('2025-01-01');
    expect(daysDiff(d, d)).toBe(0);
  });

  it('returns positive value when b is after a', () => {
    const a = new Date('2025-01-01');
    const b = new Date('2025-01-11');
    expect(daysDiff(a, b)).toBe(10);
  });

  it('returns negative value when b is before a', () => {
    const a = new Date('2025-01-11');
    const b = new Date('2025-01-01');
    expect(daysDiff(a, b)).toBe(-10);
  });

  it('returns 1 for exactly 24 hours apart', () => {
    const a = new Date('2025-03-01T00:00:00.000Z');
    const b = new Date('2025-03-02T00:00:00.000Z');
    expect(daysDiff(a, b)).toBe(1);
  });
});

// ─── extractAlertDetails ─────────────────────────────────────────────────────

describe('extractAlertDetails', () => {
  // ── contractExpiry ────────────────────────────────────────────────────────
  describe('contractExpiry', () => {
    it('includes active employee with contract ending in 15 days', () => {
      const emp = makeEmployee({ contractEndDate: daysFromNow(15) });
      const { contractExpiry } = extractAlertDetails([emp], [], [], emptyAddresses);
      expect(contractExpiry.some(i => i.id === 'e1')).toBe(true);
    });

    it('excludes active employee with contract ending in 31+ days', () => {
      const emp = makeEmployee({ contractEndDate: daysFromNow(31) });
      const { contractExpiry } = extractAlertDetails([emp], [], [], emptyAddresses);
      expect(contractExpiry.some(i => i.id === 'e1')).toBe(false);
    });

    it('includes already expired contract (past date) and puts it first', () => {
      const expired = makeEmployee({ id: 'expired', fullName: 'Expired Person', contractEndDate: daysFromNow(-5) });
      const expiring = makeEmployee({ id: 'expiring', fullName: 'Expiring Person', contractEndDate: daysFromNow(10) });
      const { contractExpiry } = extractAlertDetails([expired, expiring], [], [], emptyAddresses);
      expect(contractExpiry[0].id).toBe('expired');
    });

    it('excludes dismissed employee', () => {
      const emp = makeEmployee({ status: 'dismissed', contractEndDate: daysFromNow(5) });
      const { contractExpiry } = extractAlertDetails([emp], [], [], emptyAddresses);
      expect(contractExpiry).toHaveLength(0);
    });

    it('excludes employee with no contractEndDate', () => {
      const emp = makeEmployee({ contractEndDate: null });
      const { contractExpiry } = extractAlertDetails([emp], [], [], emptyAddresses);
      expect(contractExpiry).toHaveLength(0);
    });

    it('extra text contains "przeterminowana" for expired contract', () => {
      const emp = makeEmployee({ contractEndDate: daysFromNow(-3) });
      const { contractExpiry } = extractAlertDetails([emp], [], [], emptyAddresses);
      expect(contractExpiry[0].extra).toContain('przeterminowana');
    });

    it('extra text contains "kończy się dziś" when contract ends today', () => {
      const emp = makeEmployee({ contractEndDate: daysFromNow(0) });
      const { contractExpiry } = extractAlertDetails([emp], [], [], emptyAddresses);
      expect(contractExpiry[0].extra).toContain('kończy się dziś');
    });

    it('link points to employees edit page', () => {
      const emp = makeEmployee({ contractEndDate: daysFromNow(5) });
      const { contractExpiry } = extractAlertDetails([emp], [], [], emptyAddresses);
      expect(contractExpiry[0].link).toContain('/dashboard/employees');
    });
  });

  // ── capacityExceeded ──────────────────────────────────────────────────────
  describe('capacityExceeded', () => {
    const address = {
      id: 'addr1',
      name: 'Adres 1',
      coordinatorIds: ['coord1'],
      rooms: [{ id: 'r1', name: '101', capacity: 2, isActive: true }],
    };

    it('generates alert when occupants exceed capacity', () => {
      const e1 = makeEmployee({ id: 'e1', address: 'Adres 1', roomNumber: '101' });
      const e2 = makeEmployee({ id: 'e2', address: 'Adres 1', roomNumber: '101', fullName: 'Marek X', coordinatorId: 'coord1' });
      const ne1 = makeNonEmployee({ id: 'ne1', address: 'Adres 1', roomNumber: '101' });
      const { capacityExceeded } = extractAlertDetails([e1, e2], [ne1], [], [address]);
      expect(capacityExceeded).toHaveLength(1);
      expect(capacityExceeded[0].extra).toContain('3/2');
    });

    it('no alert when occupants equal capacity', () => {
      const e1 = makeEmployee({ id: 'e1', address: 'Adres 1', roomNumber: '101' });
      const e2 = makeEmployee({ id: 'e2', address: 'Adres 1', roomNumber: '101', fullName: 'Marek X', coordinatorId: 'coord1' });
      const { capacityExceeded } = extractAlertDetails([e1, e2], [], [], [address]);
      expect(capacityExceeded).toHaveLength(0);
    });

    it('excludes inactive rooms from capacity check', () => {
      const inactiveAddress = {
        id: 'addr2',
        name: 'Adres 2',
        coordinatorIds: [],
        rooms: [{ id: 'r2', name: '201', capacity: 1, isActive: false }],
      };
      const e1 = makeEmployee({ id: 'e1', address: 'Adres 2', roomNumber: '201' });
      const e2 = makeEmployee({ id: 'e2', address: 'Adres 2', roomNumber: '201', fullName: 'Marek X', coordinatorId: 'coord1' });
      const { capacityExceeded } = extractAlertDetails([e1, e2], [], [], [inactiveAddress]);
      expect(capacityExceeded).toHaveLength(0);
    });

    it('dismissed employees do not count toward occupancy', () => {
      const e1 = makeEmployee({ id: 'e1', address: 'Adres 1', roomNumber: '101', status: 'dismissed' });
      const e2 = makeEmployee({ id: 'e2', address: 'Adres 1', roomNumber: '101', status: 'dismissed', fullName: 'X Y', coordinatorId: 'c' });
      const e3 = makeEmployee({ id: 'e3', address: 'Adres 1', roomNumber: '101', status: 'dismissed', fullName: 'A B', coordinatorId: 'c' });
      const { capacityExceeded } = extractAlertDetails([e1, e2, e3], [], [], [address]);
      expect(capacityExceeded).toHaveLength(0);
    });

    it('link points to housing page with address id', () => {
      const e1 = makeEmployee({ id: 'e1', address: 'Adres 1', roomNumber: '101' });
      const e2 = makeEmployee({ id: 'e2', address: 'Adres 1', roomNumber: '101', fullName: 'X Y', coordinatorId: 'c' });
      const ne1 = makeNonEmployee({ id: 'ne1', address: 'Adres 1', roomNumber: '101' });
      const { capacityExceeded } = extractAlertDetails([e1, e2], [ne1], [], [address]);
      expect(capacityExceeded[0].link).toContain('/dashboard/housing');
      expect(capacityExceeded[0].link).toContain('addr1');
    });
  });

  // ── missingPaymentData ────────────────────────────────────────────────────
  describe('missingPaymentData', () => {
    it('alerts when paymentType is null', () => {
      const ne = makeNonEmployee({ paymentType: null, paymentAmount: 500 });
      const { missingPaymentData } = extractAlertDetails([], [ne], [], emptyAddresses);
      expect(missingPaymentData).toHaveLength(1);
      expect(missingPaymentData[0].extra).toContain('typ');
    });

    it('alerts when paymentAmount is null', () => {
      const ne = makeNonEmployee({ paymentType: 'gotówka', paymentAmount: null });
      const { missingPaymentData } = extractAlertDetails([], [ne], [], emptyAddresses);
      expect(missingPaymentData).toHaveLength(1);
      expect(missingPaymentData[0].extra).toContain('kwota');
    });

    it('alerts when both paymentType and paymentAmount are null', () => {
      const ne = makeNonEmployee({ paymentType: null, paymentAmount: null });
      const { missingPaymentData } = extractAlertDetails([], [ne], [], emptyAddresses);
      expect(missingPaymentData).toHaveLength(1);
      expect(missingPaymentData[0].extra).toContain('typ');
      expect(missingPaymentData[0].extra).toContain('kwota');
    });

    it('no alert when both paymentType and paymentAmount are set', () => {
      const ne = makeNonEmployee({ paymentType: 'przelew', paymentAmount: 800 });
      const { missingPaymentData } = extractAlertDetails([], [ne], [], emptyAddresses);
      expect(missingPaymentData).toHaveLength(0);
    });

    it('excludes dismissed non-employees', () => {
      const ne = makeNonEmployee({ status: 'dismissed', paymentType: null, paymentAmount: null });
      const { missingPaymentData } = extractAlertDetails([], [ne], [], emptyAddresses);
      expect(missingPaymentData).toHaveLength(0);
    });

    it('link points to non-employees tab with edit param', () => {
      const ne = makeNonEmployee({ id: 'ne42', paymentType: null, paymentAmount: 100 });
      const { missingPaymentData } = extractAlertDetails([], [ne], [], emptyAddresses);
      expect(missingPaymentData[0].link).toContain('non-employees');
      expect(missingPaymentData[0].link).toContain('ne42');
    });
  });

  // ── duplicatePersons ──────────────────────────────────────────────────────
  describe('duplicatePersons', () => {
    it('detects two active employees with same name under the same coordinator', () => {
      const e1 = makeEmployee({ id: 'e1', fullName: 'Jan Kowalski', coordinatorId: 'coord1' });
      const e2 = makeEmployee({ id: 'e2', fullName: 'Jan Kowalski', coordinatorId: 'coord1' });
      const { duplicatePersons } = extractAlertDetails([e1, e2], [], [], emptyAddresses);
      expect(duplicatePersons).toHaveLength(1);
      expect(duplicatePersons[0].extra).toContain('2x');
    });

    it('does NOT detect duplicates when same name is under different coordinators', () => {
      const e1 = makeEmployee({ id: 'e1', fullName: 'Jan Kowalski', coordinatorId: 'coord1' });
      const e2 = makeEmployee({ id: 'e2', fullName: 'Jan Kowalski', coordinatorId: 'coord2' });
      const { duplicatePersons } = extractAlertDetails([e1, e2], [], [], emptyAddresses);
      expect(duplicatePersons).toHaveLength(0);
    });

    it('does not flag a single employee as duplicate', () => {
      const e1 = makeEmployee({ id: 'e1', fullName: 'Jan Kowalski', coordinatorId: 'coord1' });
      const { duplicatePersons } = extractAlertDetails([e1], [], [], emptyAddresses);
      expect(duplicatePersons).toHaveLength(0);
    });

    it('excludes dismissed employees from duplicate check', () => {
      const e1 = makeEmployee({ id: 'e1', fullName: 'Jan Kowalski', coordinatorId: 'coord1', status: 'dismissed' });
      const e2 = makeEmployee({ id: 'e2', fullName: 'Jan Kowalski', coordinatorId: 'coord1' });
      const { duplicatePersons } = extractAlertDetails([e1, e2], [], [], emptyAddresses);
      expect(duplicatePersons).toHaveLength(0);
    });

    it('is case-insensitive and collapses whitespace for name comparison', () => {
      const e1 = makeEmployee({ id: 'e1', fullName: 'jan  kowalski', coordinatorId: 'coord1' });
      const e2 = makeEmployee({ id: 'e2', fullName: 'JAN KOWALSKI', coordinatorId: 'coord1' });
      const { duplicatePersons } = extractAlertDetails([e1, e2], [], [], emptyAddresses);
      expect(duplicatePersons).toHaveLength(1);
    });

    it('includes coordinator name in extra when coordinators array is provided', () => {
      const e1 = makeEmployee({ id: 'e1', fullName: 'Jan Kowalski', coordinatorId: 'coord1' });
      const e2 = makeEmployee({ id: 'e2', fullName: 'Jan Kowalski', coordinatorId: 'coord1' });
      const { duplicatePersons } = extractAlertDetails(
        [e1, e2], [], [], emptyAddresses,
        [{ uid: 'coord1', name: 'Koordynator Testowy' }]
      );
      expect(duplicatePersons[0].extra).toContain('Koordynator Testowy');
    });

    it('uses fallback text when no coordinator name found', () => {
      const e1 = makeEmployee({ id: 'e1', fullName: 'Jan Kowalski', coordinatorId: 'coord99' });
      const e2 = makeEmployee({ id: 'e2', fullName: 'Jan Kowalski', coordinatorId: 'coord99' });
      const { duplicatePersons } = extractAlertDetails([e1, e2], [], [], emptyAddresses, []);
      expect(duplicatePersons[0].extra).toContain('koordynatora');
    });
  });
});
