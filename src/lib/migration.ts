
"use server";

import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Settings, HousingAddress, Room } from '@/types';

// --- Credentials are the same as in actions.ts ---
const SPREADSHEET_ID = '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';
const OLD_SHEET_NAME_SETTINGS = 'Settings';
const NEW_SHEET_NAME_ADDRESSES = 'Addresses';
const NEW_SHEET_NAME_ROOMS = 'Rooms';

const serviceAccountAuth = new JWT({
  email: "sheets-database-manager@hr-housing-hub-a2udq.iam.gserviceaccount.com",
  key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/Pogjqll3W46c\n3e/ktFVweN2TVq7bPcloNPlbGdIeN72MrjXsdpP8FdMDFywI+hWCQG0ouNnIiFJm\n67Rody5ul43LT0smTsliGkepNeUi6i4JLQL14sZGKvRyOa/Bs8JpIJ0Mb86VZTGY\n7gmgZjYDvkr7yv1UtURZBvzY6USMOCCZR6zvt9THswXgh3PVEhHFjiMHWxuLx/IV\nSaAxR53/kmv3Du17GtiYta2BaQMtYyUf2B8QRcY4aklxLMA8K7RKxTbgR/76b642\n7sFP4SmmTnjXo6YlIUvnAcY+WjLeF0OzKlAjNUX2hVptQP56oS1rd1vRBTLv0X16\nmX748CSVAgMBAAECggEABWlhE9VJs9Fw7ypuk+OweT7KUlWFHCoa7Wp2VegcpINC\nR11UpEzUsjDx6Cf7NIPTIPzuudTFQOHupv/rentI4pNCTWsAfuSC2VZSCc0/HyZO\nSC8wYsHYh3rGsQbF3O7XxP7JwuTVDTAwX5n4xsOtqpxzZb2gPonklbpXZFHxgSA2\n3w9clizXzHNdTNKCA/ooXFwn1snP4cRf2qWnwipbFqUFaUU9HSiSb6Ro9vbXKfNS\nJZsJmGI4txg+3w0EqHtAgryYv1RW7RdjNG2KjWwOBFeIDGPiR25ITQxuceqIzhzQ\nmPbV7SSEkLQRJiRjNlCNT+tom/KtZYn06jbBGm8O3wKBgQD2yMGgL15gwcqEcjdh\nAIyZR8UQm/wtgoZwU46G8wGOOBCv9dew+qUIMbAa8y1BKvmksjCMMf0vp9hn3SLw\nyT/XALTQ7jNMoPAj8ORaxvuU0J4ClRMEKu8nVkQkSLUSWECVWT+Uv1it+my6pkF0\nodEeQ/DlyAfMXk7pP2hRCa6FjwKBgQDGYtEOQ8aUWoF9vzt1ZQcvHoilyaIQZdja\nlY5RGzHw/upul3RWDcpIeExfop8hfqcOI6NnmlKmz2J33aFaLoic5N0vxivaQOIh\ndKpBrrSnWMEKzf9RzNckCVufkJnG6bIjyXbt6qsB+I7PGNo30lt292MMlyJZN6oi\ndefncBjJmwKBgCFwMkwyHuedWoN3tmk+Wc6rGtiVSiYgeXbe24ENjDhpAFnXRdKF\nI7dohCQirw8Vc54NRua4H0ZFx9zK6eEWY8AOKHHm1KydYex8x3RFYfFYExDmgh0e\ndCkwVytTbrV9n8KcxTCyfKGWPQVNYbEb++nN6uY3pFbcsHSKUugoF62hAoGAM8vj\nF11cwKksu/8s8AazrHrFZLvTY4Kj7tYzdTure2ejH8LNbhZlpSw7jJCyCZW+2jM1\n27vwLnthEzi7gwc5RfV/RpTwKCjeoauLNGD/692BcWe9bMcVuOP0lyGy9LtZdnyI\nX6/wfDBAYRP1DbQPi20l4EipgC/HbP3p0YR0BFcCgYEAil55HwxqHwKZO5tGgSFB\numU1tM3b6rpOvfIer9dUPqZN7+Pef9GaWQs2NvPIlSn0bEZnjevLk0QOnACLOwfk\nBDv783BdHhTbwPMH+TjKu4n2GwrHRF6T5bNgeGqVe8jvD+mzXe/KQO402s6r5Ue1\n9JhV9GM9wVmbgjsXlOfVxCg=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

async function getSheet(title: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        sheet = await doc.addSheet({ title, headerValues: headers });
    } else {
        await sheet.setHeaderRow(headers);
    }
    return sheet;
}

export async function runMigration() {
    console.log("Starting migration...");
    try {
        await doc.loadInfo();
        const oldSettingsSheet = doc.sheetsByTitle[OLD_SHEET_NAME_SETTINGS];

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
        const oldAddresses: (HousingAddress & { capacity?: number })[] = settingsData.addresses || [];

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
