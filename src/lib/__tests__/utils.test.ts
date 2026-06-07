import { cn, batchPromises, isAdminRelevantNotification, filterNotifications } from '../utils';
import type { Notification } from '@/types';

// Helper to create a minimal Notification object
function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    message: 'Dodał nowego pracownika Jan Kowalski',
    entityId: 'e1',
    entityFirstName: 'Jan',
    entityLastName: 'Kowalski',
    actorName: 'Koordynator',
    recipientId: 'coord1',
    createdAt: '2024-01-15T12:00:00Z',
    isRead: false,
    type: 'info',
    changes: [],
    ...overrides,
  };
}

// ─── cn ────────────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles conditional classes (false is ignored)', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('returns empty string for no input', () => {
    expect(cn()).toBe('');
  });

  it('handles undefined and null gracefully', () => {
    expect(cn(undefined, null as unknown as string, 'x')).toBe('x');
  });
});

// ─── batchPromises ─────────────────────────────────────────────────────────────

describe('batchPromises', () => {
  it('does not call fn for empty array', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    await batchPromises([], 2, fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls fn for every item', async () => {
    const items = [1, 2, 3, 4, 5];
    const fn = jest.fn().mockResolvedValue(undefined);
    await batchPromises(items, 10, fn);
    expect(fn).toHaveBeenCalledTimes(5);
    items.forEach(item => expect(fn).toHaveBeenCalledWith(item));
  });

  it('respects batchSize — processes items in correct batches', async () => {
    const order: number[] = [];
    const items = [1, 2, 3, 4, 5];
    const fn = jest.fn(async (item: number) => { order.push(item); });
    await batchPromises(items, 2, fn, 0);
    expect(fn).toHaveBeenCalledTimes(5);
    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  it('works with batchSize larger than items length', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    await batchPromises([1, 2], 10, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('works with batchSize of 1', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    await batchPromises([1, 2, 3], 1, fn, 0);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('delays between batches when delayMs > 0', async () => {
    jest.useFakeTimers();
    const fn = jest.fn().mockResolvedValue(undefined);
    const promise = batchPromises([1, 2, 3], 1, fn, 100);
    // Advance timers to allow all batches + delays to process
    await jest.runAllTimersAsync();
    await promise;
    expect(fn).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });
});

// ─── isAdminRelevantNotification ───────────────────────────────────────────────

describe('isAdminRelevantNotification', () => {
  const validPrefixes = [
    'Dodał nowego pracownika',
    'Dodał nowego mieszkańca',
    'Zmienił adres pracownika',
    'Zmienił adres mieszkańca',
    'Zwolnił pracownika',
    'Zwolnił mieszkańca',
    'Automatycznie zwolnił pracownika',
    'Automatycznie zwolnił mieszkańca',
  ];

  validPrefixes.forEach(prefix => {
    it(`returns true for prefix: "${prefix}"`, () => {
      expect(isAdminRelevantNotification(`${prefix} Jan Kowalski`)).toBe(true);
    });
  });

  it('returns false when message contains BOK', () => {
    expect(isAdminRelevantNotification('Dodał nowego pracownika BOK Jan Kowalski')).toBe(false);
  });

  it('returns false for BOK even with valid prefix', () => {
    expect(isAdminRelevantNotification('Zmienił adres mieszkańca BOK Test')).toBe(false);
  });

  it('returns false for unrecognised message', () => {
    expect(isAdminRelevantNotification('Inne zdarzenie')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAdminRelevantNotification('')).toBe(false);
  });

  it('returns false when BOK appears alone', () => {
    expect(isAdminRelevantNotification('BOK')).toBe(false);
  });
});

// ─── filterNotifications ───────────────────────────────────────────────────────

describe('filterNotifications', () => {
  const base = makeNotification();

  const notifications: Notification[] = [
    makeNotification({ id: 'n1', message: 'Dodał nowego pracownika Jan Kowalski', recipientId: 'coord1', isRead: false, entityFirstName: 'Jan', entityLastName: 'Kowalski', createdAt: '2024-01-15T08:00:00Z' }),
    makeNotification({ id: 'n2', message: 'Zwolnił pracownika Anna Nowak', recipientId: 'coord2', isRead: true, entityFirstName: 'Anna', entityLastName: 'Nowak', createdAt: '2024-01-15T20:00:00Z' }),
    makeNotification({ id: 'n3', message: 'Dodał nowego pracownika BOK Piotr BOK', recipientId: 'coord1', isRead: false, entityFirstName: 'Piotr', entityLastName: 'BOK', createdAt: '2024-01-15T10:00:00Z' }),
    makeNotification({ id: 'n4', message: 'Inne zdarzenie', recipientId: 'coord3', isRead: true, entityFirstName: 'Krzysztof', entityLastName: 'Wiśniewski', createdAt: '2024-01-16T12:00:00Z' }),
    makeNotification({ id: 'n5', message: 'Zmienił adres pracownika Jan Kowalski', recipientId: 'coord1', isRead: false, entityFirstName: 'Jan', entityLastName: 'Kowalski', createdAt: '2024-01-14T12:00:00Z' }),
  ];

  it('returns all notifications when no filters are applied', () => {
    const result = filterNotifications(notifications, {});
    expect(result).toHaveLength(notifications.length);
  });

  it('adminView=true keeps only admin-relevant and excludes BOK', () => {
    const result = filterNotifications(notifications, { adminView: true });
    const ids = result.map(n => n.id);
    expect(ids).toContain('n1');
    expect(ids).toContain('n2');
    expect(ids).toContain('n5');
    expect(ids).not.toContain('n3'); // BOK message
    expect(ids).not.toContain('n4'); // non-relevant prefix
  });

  it('selectedCoordinatorId filters by recipientId', () => {
    const result = filterNotifications(notifications, { selectedCoordinatorId: 'coord2' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n2');
  });

  it('selectedCoordinatorId="all" does not filter', () => {
    const result = filterNotifications(notifications, { selectedCoordinatorId: 'all' });
    expect(result).toHaveLength(notifications.length);
  });

  it('readStatusFilter="read" returns only read notifications', () => {
    const result = filterNotifications(notifications, { readStatusFilter: 'read' });
    expect(result.every(n => n.isRead)).toBe(true);
    expect(result.map(n => n.id)).toContain('n2');
    expect(result.map(n => n.id)).toContain('n4');
  });

  it('readStatusFilter="unread" returns only unread notifications', () => {
    const result = filterNotifications(notifications, { readStatusFilter: 'unread' });
    expect(result.every(n => !n.isRead)).toBe(true);
    expect(result.map(n => n.id)).toContain('n1');
    expect(result.map(n => n.id)).toContain('n3');
    expect(result.map(n => n.id)).toContain('n5');
  });

  it('readStatusFilter="all" returns all notifications', () => {
    const result = filterNotifications(notifications, { readStatusFilter: 'all' });
    expect(result).toHaveLength(notifications.length);
  });

  it('readStatusFilter=undefined returns all notifications', () => {
    const result = filterNotifications(notifications, { readStatusFilter: undefined });
    expect(result).toHaveLength(notifications.length);
  });

  it('employeeNameFilter matches by firstName + lastName (case-insensitive)', () => {
    const result = filterNotifications(notifications, { employeeNameFilter: 'jan kowalski' });
    const ids = result.map(n => n.id);
    expect(ids).toContain('n1');
    expect(ids).toContain('n5');
    expect(ids).not.toContain('n2');
  });

  it('employeeNameFilter partial match works', () => {
    const result = filterNotifications(notifications, { employeeNameFilter: 'anna' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n2');
  });

  it('employeeNameFilter excludes notifications with no entity name', () => {
    const noName = makeNotification({ id: 'noname', entityFirstName: '', entityLastName: '' });
    const result = filterNotifications([...notifications, noName], { employeeNameFilter: '' });
    // empty filter string is falsy → no name filtering
    expect(result).toHaveLength(notifications.length + 1);
  });

  it('selectedDate filters to only that day (2024-01-15)', () => {
    const result = filterNotifications(notifications, { selectedDate: new Date('2024-01-15T00:00:00Z') });
    const ids = result.map(n => n.id);
    expect(ids).toContain('n1'); // 2024-01-15T08:00
    expect(ids).toContain('n2'); // 2024-01-15T20:00
    expect(ids).toContain('n3'); // 2024-01-15T10:00
    expect(ids).not.toContain('n4'); // 2024-01-16
    expect(ids).not.toContain('n5'); // 2024-01-14
  });

  it('selectedDate filters to 2024-01-16 — only n4', () => {
    const result = filterNotifications(notifications, { selectedDate: new Date('2024-01-16T00:00:00Z') });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n4');
  });

  it('multiple filters combined', () => {
    // adminView + recipientId=coord1 + unread + selectedDate=2024-01-15
    const result = filterNotifications(notifications, {
      adminView: true,
      selectedCoordinatorId: 'coord1',
      readStatusFilter: 'unread',
      selectedDate: new Date('2024-01-15T00:00:00Z'),
    });
    // n1: coord1, unread, admin-relevant, 2024-01-15 ✓
    // n3: coord1, unread, BOK → excluded by adminView
    // n5: coord1, unread, admin-relevant, 2024-01-14 → excluded by date
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1');
  });

  it('does not mutate the original array', () => {
    const original = [...notifications];
    filterNotifications(notifications, { adminView: true, readStatusFilter: 'read' });
    expect(notifications).toHaveLength(original.length);
  });
});
