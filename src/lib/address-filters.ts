/**
 * Utility functions for filtering blocked/inactive addresses and rooms
 * 
 * An address or room is considered "blocked" if:
 * - Address: isActive = false
 * - Room: isActive = false OR isLocked = true OR parent address is blocked
 */

import type { Address, Room } from '@/types';

/**
 * Check if an address is a personal/own apartment
 */
export function isOwnAddressEntry(addressName: string): boolean {
  if (!addressName) return false;
  const lowerName = addressName.toLowerCase().trim();
  // Check for various spellings of "własne mieszkanie"
  return lowerName.startsWith('własne') ||
    lowerName.startsWith('wlasne') ||
    lowerName.includes('wlasne mieszkanie') ||
    lowerName.includes('własne mieszkanie');
}

/**
 * Check if an address is active (not blocked)
 */
export function isAddressActive(address: Address): boolean {
  return address.isActive;
}

/**
 * Check if a room is active (not blocked)
 * A room is active only if it's not locked, is active itself, and its parent address is active
 */
export function isRoomActive(room: Room, parentAddress?: Address): boolean {
  const roomNotLocked = !room.isLocked;
  const roomIsActive = room.isActive;
  const addressIsActive = parentAddress ? parentAddress.isActive : true;

  return roomNotLocked && roomIsActive && addressIsActive;
}

/**
 * Get only active addresses
 */
export function getActiveAddresses(addresses: Address[]): Address[] {
  return addresses.filter(isAddressActive);
}

/**
 * Get only active rooms from an address
 */
export function getActiveRooms(address: Address): Room[] {
  if (!isAddressActive(address)) {
    return [];
  }
  return address.rooms.filter(room => isRoomActive(room, address));
}

/**
 * Get total capacity of active rooms in an address
 */
export function getActiveAddressCapacity(address: Address): number {
  return getActiveRooms(address).reduce((sum, room) => sum + room.capacity, 0);
}

/**
 * Get total capacity of all active rooms across all addresses
 */
export function getTotalActiveCapacity(addresses: Address[]): number {
  return getActiveAddresses(addresses).reduce((sum, address) => {
    return sum + getActiveAddressCapacity(address);
  }, 0);
}

/**
 * Check if a specific room in an address is active
 */
export function isRoomActiveInAddress(address: Address, roomName: string): boolean {
  if (!isAddressActive(address)) {
    return false;
  }
  const room = address.rooms.find(r => r.name === roomName);
  if (!room) {
    return false;
  }
  return isRoomActive(room, address);
}

/**
 * Filter addresses to only include those with at least one active room
 */
export function getAddressesWithActiveRooms(addresses: Address[]): Address[] {
  return addresses.filter(address => {
    return isAddressActive(address) && getActiveRooms(address).length > 0;
  });
}

/**
 * Get count of unique active addresses being used by occupants
 * Only counts addresses that are active and have active rooms
 */
export function countActiveAddressesInUse(
  occupants: Array<{ address: string }>,
  allAddresses: Address[]
): number {
  const activeAddressNames = new Set(
    getActiveAddresses(allAddresses).map(addr => addr.name)
  );

  const uniqueAddressesUsed = new Set(
    occupants
      .map(o => o.address)
      .filter(Boolean)
      .filter(addr => activeAddressNames.has(addr) && !isOwnAddressEntry(addr))
  );

  return uniqueAddressesUsed.size;
}
