import {
  isOwnAddressEntry,
  isAddressActive,
  isRoomActive,
  getActiveAddresses,
  getActiveRooms,
  getActiveAddressCapacity,
  getTotalActiveCapacity,
  isRoomActiveInAddress,
  getAddressesWithActiveRooms,
  countActiveAddressesInUse,
} from '../address-filters';

import type { Address, Room } from '@/types';

// --- helpers ---

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    name: 'Room 1',
    capacity: 2,
    isActive: true,
    isLocked: false,
    ...overrides,
  };
}

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 'a1',
    locality: 'Warsaw',
    name: 'Test Address',
    coordinatorIds: [],
    rooms: [],
    isActive: true,
    ...overrides,
  };
}

// --- tests ---

describe('isOwnAddressEntry', () => {
  it('returns false for empty string', () => {
    expect(isOwnAddressEntry('')).toBe(false);
  });

  it('returns true for "własne"', () => {
    expect(isOwnAddressEntry('własne')).toBe(true);
  });

  it('returns true for "własne mieszkanie"', () => {
    expect(isOwnAddressEntry('własne mieszkanie')).toBe(true);
  });

  it('returns true for "Własne Mieszkanie" (case insensitive)', () => {
    expect(isOwnAddressEntry('Własne Mieszkanie')).toBe(true);
  });

  it('returns true for "wlasne"', () => {
    expect(isOwnAddressEntry('wlasne')).toBe(true);
  });

  it('returns true for "wlasne mieszkanie"', () => {
    expect(isOwnAddressEntry('wlasne mieszkanie')).toBe(true);
  });

  it('returns true for "WŁASNE" (uppercase)', () => {
    expect(isOwnAddressEntry('WŁASNE')).toBe(true);
  });

  it('returns false for a regular address', () => {
    expect(isOwnAddressEntry('ul. Marszałkowska 1')).toBe(false);
  });

  it('returns false for "other address"', () => {
    expect(isOwnAddressEntry('other address')).toBe(false);
  });

  it('handles leading/trailing whitespace', () => {
    expect(isOwnAddressEntry('  własne  ')).toBe(true);
  });
});

describe('isAddressActive', () => {
  it('returns true when address.isActive is true', () => {
    expect(isAddressActive(makeAddress({ isActive: true }))).toBe(true);
  });

  it('returns false when address.isActive is false', () => {
    expect(isAddressActive(makeAddress({ isActive: false }))).toBe(false);
  });
});

describe('isRoomActive', () => {
  it('returns true for active, unlocked room with no parent', () => {
    const room = makeRoom({ isActive: true, isLocked: false });
    expect(isRoomActive(room)).toBe(true);
  });

  it('returns true for active, unlocked room with active parent', () => {
    const room = makeRoom({ isActive: true, isLocked: false });
    const addr = makeAddress({ isActive: true });
    expect(isRoomActive(room, addr)).toBe(true);
  });

  it('returns false for locked room', () => {
    const room = makeRoom({ isActive: true, isLocked: true });
    expect(isRoomActive(room)).toBe(false);
  });

  it('returns false for inactive room', () => {
    const room = makeRoom({ isActive: false, isLocked: false });
    expect(isRoomActive(room)).toBe(false);
  });

  it('returns false when parent address is inactive', () => {
    const room = makeRoom({ isActive: true, isLocked: false });
    const addr = makeAddress({ isActive: false });
    expect(isRoomActive(room, addr)).toBe(false);
  });

  it('returns true when isLocked is undefined (treated as not locked)', () => {
    const room = makeRoom({ isActive: true, isLocked: undefined });
    expect(isRoomActive(room)).toBe(true);
  });
});

describe('getActiveAddresses', () => {
  it('returns only active addresses', () => {
    const a1 = makeAddress({ id: 'a1', isActive: true });
    const a2 = makeAddress({ id: 'a2', isActive: false });
    const a3 = makeAddress({ id: 'a3', isActive: true });
    expect(getActiveAddresses([a1, a2, a3])).toEqual([a1, a3]);
  });

  it('returns empty array when all addresses are inactive', () => {
    const a1 = makeAddress({ isActive: false });
    expect(getActiveAddresses([a1])).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(getActiveAddresses([])).toEqual([]);
  });
});

describe('getActiveRooms', () => {
  it('returns empty array when address is inactive', () => {
    const addr = makeAddress({ isActive: false, rooms: [makeRoom()] });
    expect(getActiveRooms(addr)).toEqual([]);
  });

  it('returns only active, unlocked rooms for active address', () => {
    const r1 = makeRoom({ id: 'r1', isActive: true, isLocked: false });
    const r2 = makeRoom({ id: 'r2', isActive: false, isLocked: false });
    const r3 = makeRoom({ id: 'r3', isActive: true, isLocked: true });
    const addr = makeAddress({ isActive: true, rooms: [r1, r2, r3] });
    expect(getActiveRooms(addr)).toEqual([r1]);
  });

  it('returns empty array when address has no rooms', () => {
    const addr = makeAddress({ isActive: true, rooms: [] });
    expect(getActiveRooms(addr)).toEqual([]);
  });
});

describe('getActiveAddressCapacity', () => {
  it('returns sum of capacities of active rooms', () => {
    const r1 = makeRoom({ id: 'r1', capacity: 3, isActive: true, isLocked: false });
    const r2 = makeRoom({ id: 'r2', capacity: 2, isActive: true, isLocked: false });
    const r3 = makeRoom({ id: 'r3', capacity: 5, isActive: false, isLocked: false });
    const addr = makeAddress({ isActive: true, rooms: [r1, r2, r3] });
    expect(getActiveAddressCapacity(addr)).toBe(5);
  });

  it('returns 0 when address is inactive', () => {
    const r1 = makeRoom({ capacity: 4, isActive: true });
    const addr = makeAddress({ isActive: false, rooms: [r1] });
    expect(getActiveAddressCapacity(addr)).toBe(0);
  });

  it('returns 0 when there are no rooms', () => {
    const addr = makeAddress({ isActive: true, rooms: [] });
    expect(getActiveAddressCapacity(addr)).toBe(0);
  });
});

describe('getTotalActiveCapacity', () => {
  it('sums capacities across multiple active addresses', () => {
    const r1 = makeRoom({ id: 'r1', capacity: 3, isActive: true, isLocked: false });
    const r2 = makeRoom({ id: 'r2', capacity: 2, isActive: true, isLocked: false });
    const a1 = makeAddress({ id: 'a1', isActive: true, rooms: [r1] });
    const a2 = makeAddress({ id: 'a2', isActive: true, rooms: [r2] });
    const a3 = makeAddress({ id: 'a3', isActive: false, rooms: [makeRoom({ capacity: 10 })] });
    expect(getTotalActiveCapacity([a1, a2, a3])).toBe(5);
  });

  it('returns 0 for empty list', () => {
    expect(getTotalActiveCapacity([])).toBe(0);
  });

  it('returns 0 when all addresses are inactive', () => {
    const addr = makeAddress({ isActive: false, rooms: [makeRoom({ capacity: 5 })] });
    expect(getTotalActiveCapacity([addr])).toBe(0);
  });
});

describe('isRoomActiveInAddress', () => {
  it('returns false when address is inactive', () => {
    const r = makeRoom({ name: 'Room A', isActive: true, isLocked: false });
    const addr = makeAddress({ isActive: false, rooms: [r] });
    expect(isRoomActiveInAddress(addr, 'Room A')).toBe(false);
  });

  it('returns false when room is not found', () => {
    const addr = makeAddress({ isActive: true, rooms: [] });
    expect(isRoomActiveInAddress(addr, 'Nonexistent')).toBe(false);
  });

  it('returns true for an active, unlocked room', () => {
    const r = makeRoom({ name: 'Room A', isActive: true, isLocked: false });
    const addr = makeAddress({ isActive: true, rooms: [r] });
    expect(isRoomActiveInAddress(addr, 'Room A')).toBe(true);
  });

  it('returns false for a locked room', () => {
    const r = makeRoom({ name: 'Room A', isActive: true, isLocked: true });
    const addr = makeAddress({ isActive: true, rooms: [r] });
    expect(isRoomActiveInAddress(addr, 'Room A')).toBe(false);
  });

  it('returns false for an inactive room', () => {
    const r = makeRoom({ name: 'Room A', isActive: false, isLocked: false });
    const addr = makeAddress({ isActive: true, rooms: [r] });
    expect(isRoomActiveInAddress(addr, 'Room A')).toBe(false);
  });
});

describe('getAddressesWithActiveRooms', () => {
  it('excludes inactive addresses', () => {
    const r = makeRoom({ isActive: true, isLocked: false });
    const addr = makeAddress({ isActive: false, rooms: [r] });
    expect(getAddressesWithActiveRooms([addr])).toEqual([]);
  });

  it('excludes active addresses with no active rooms', () => {
    const r = makeRoom({ isActive: false });
    const addr = makeAddress({ isActive: true, rooms: [r] });
    expect(getAddressesWithActiveRooms([addr])).toEqual([]);
  });

  it('includes active addresses with at least one active room', () => {
    const r = makeRoom({ isActive: true, isLocked: false });
    const addr = makeAddress({ isActive: true, rooms: [r] });
    expect(getAddressesWithActiveRooms([addr])).toEqual([addr]);
  });

  it('returns empty array for empty input', () => {
    expect(getAddressesWithActiveRooms([])).toEqual([]);
  });
});

describe('countActiveAddressesInUse', () => {
  it('counts unique active addresses used by occupants', () => {
    const a1 = makeAddress({ id: 'a1', name: 'Addr 1', isActive: true });
    const a2 = makeAddress({ id: 'a2', name: 'Addr 2', isActive: true });
    const occupants = [
      { address: 'Addr 1' },
      { address: 'Addr 1' }, // duplicate — should count once
      { address: 'Addr 2' },
    ];
    expect(countActiveAddressesInUse(occupants, [a1, a2])).toBe(2);
  });

  it('excludes occupants with własne mieszkanie address', () => {
    const a1 = makeAddress({ id: 'a1', name: 'Addr 1', isActive: true });
    const occupants = [
      { address: 'Addr 1' },
      { address: 'własne mieszkanie' },
    ];
    expect(countActiveAddressesInUse(occupants, [a1])).toBe(1);
  });

  it('excludes occupants linked to inactive addresses', () => {
    const a1 = makeAddress({ id: 'a1', name: 'Addr 1', isActive: false });
    const occupants = [{ address: 'Addr 1' }];
    expect(countActiveAddressesInUse(occupants, [a1])).toBe(0);
  });

  it('returns 0 for empty occupants list', () => {
    const a1 = makeAddress({ id: 'a1', name: 'Addr 1', isActive: true });
    expect(countActiveAddressesInUse([], [a1])).toBe(0);
  });

  it('returns 0 when all addresses are inactive', () => {
    const a1 = makeAddress({ id: 'a1', name: 'Addr 1', isActive: false });
    const occupants = [{ address: 'Addr 1' }];
    expect(countActiveAddressesInUse(occupants, [a1])).toBe(0);
  });

  it('ignores occupants with empty address string', () => {
    const a1 = makeAddress({ id: 'a1', name: 'Addr 1', isActive: true });
    const occupants = [{ address: '' }, { address: 'Addr 1' }];
    expect(countActiveAddressesInUse(occupants, [a1])).toBe(1);
  });
});
