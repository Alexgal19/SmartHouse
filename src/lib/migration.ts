
"use server";
import { getSheet } from '@/lib/sheets';
import type { HousingAddress, Room } from '@/types';

const OLD_SHEET_NAME_SETTINGS = 'Settings';
const NEW_SHEET_NAME_ADDRESSES = 'Addresses';
const NEW_SHEET_NAME_ROOMS = 'Rooms';


export async function runMigration() {
    console.log("Starting migration...");
    try {
        const oldSettingsSheet = await getSheet(OLD_SHEET_NAME_SETTINGS, ['settingsData']);

        if (!oldSettingsSheet) {
            console.log("Old 'Settings' sheet not found. No migration needed.");
            return { success: true, message: "No old settings sheet found." };
        }

        const rows = await oldSettingsSheet.getRows();
        if (rows.length === 0 || !rows[0].get('settingsData')) {
            console.log("Old 'Settings' sheet is empty. No migration needed.");
            return { success: true, message: "Old settings sheet is empty." };
        }

        const settingsData = JSON.parse(rows[0].get('settingsData'));
        const oldAddresses: (HousingAddress & { capacity?: number, rooms?: Room[] })[] = settingsData.addresses || [];

        if (oldAddresses.length === 0) {
            console.log("No addresses found in old settings. No migration needed.");
            return { success: true, message: "No addresses to migrate." };
        }

        console.log(`Found ${oldAddresses.length} addresses to migrate.`);

        const newAddresses: { id: string; name: string }[] = [];
        const newRooms: (Room & { addressId: string })[] = [];

        oldAddresses.forEach(address => {
            const addressId = address.id || `addr-${Date.now()}-${Math.random()}`;
            newAddresses.push({ id: addressId, name: address.name });

            if (address.rooms && address.rooms.length > 0) {
                 address.rooms.forEach(room => {
                    const roomId = room.id || `room-${Date.now()}-${Math.random()}`;
                    newRooms.push({
                        id: roomId,
                        addressId: addressId,
                        name: room.name,
                        capacity: room.capacity || 0,
                    });
                });
            } else if (address.capacity) {
                // Handle old structure where capacity was on address
                 newRooms.push({
                    id: `room-${Date.now()}-${Math.random()}`,
                    addressId: addressId,
                    name: 'Default Room',
                    capacity: address.capacity,
                });
            }
        });

        // Get or create new sheets
        const addressesSheet = await getSheet(NEW_SHEET_NAME_ADDRESSES, ['id', 'name']);
        const roomsSheet = await getSheet(NEW_SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity']);

        // Clear existing data to prevent duplicates
        await addressesSheet.clearRows();
        await roomsSheet.clearRows();

        // Add new data
        if (newAddresses.length > 0) {
            await addressesSheet.addRows(newAddresses);
        }
        if (newRooms.length > 0) {
            await roomsSheet.addRows(newRooms);
        }

        console.log("Migration successful!");
        return { success: true, message: `Migrated ${newAddresses.length} addresses and ${newRooms.length} rooms.` };

    } catch (error) {
        console.error("Migration failed:", error);
        if (error instanceof Error) {
            return { success: false, message: `Migration failed: ${error.message}` };
        }
        return { success: false, message: "An unknown error occurred during migration." };
    }
}

