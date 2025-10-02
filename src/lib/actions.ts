"use server";

import type { Employee, Settings, Notification, Coordinator } from '@/types';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// --- Credentials - In a real production app, use environment variables ---
const SPREADSHEET_ID = '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';
const SHEET_NAME_EMPLOYEES = 'Employees';
const SHEET_NAME_SETTINGS = 'Settings';
const SHEET_NAME_NOTIFICATIONS = 'Powiadomienia';


const serviceAccountAuth = new JWT({
  email: "sheets-database-manager@hr-housing-hub-a2udq.iam.gserviceaccount.com",
  key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/Pogjqll3W46c\n3e/ktFVweN2TVq7bPcloNPlbGdIeN72MrjXsdpP8FdMDFywI+hWCQG0ouNnIiFJm\n67Rody5ul43LT0smTsliGkepNeUi6i4JLQL14sZGKvRyOa/Bs8JpIJ0Mb86VZTGY\n7gmgZjYDvkr7yv1UtURZBvzY6USMOCCZR6zvt9THswXgh3PVEhHFjiMHWxuLx/IV\nSaAxR53/kmv3Du17GtiYta2BaQMtYyUf2B8QRcY4aklxLMA8K7RKxTbgR/76b642\n7sFP4SmmTnjXo6YlIUvnAcY+WjLeF0OzKlAjNUX2hVptQP56oS1rd1vRBTLv0X16\nmX748CSVAgMBAAECggEABWlhE9VJs9Fw7ypuk+OweT7KUlWFHCoa7Wp2VegcpINC\nR11UpEzUsjDx6Cf7NIPTIPzuudTFQOHupv/rentI4pNCTWsAfuSC2VZSCc0/HyZO\nSC8wYsHYh3rGsQbF3O7XxP7JwuTVDTAwX5n4xsOtqpxzZb2gPonklbpXZFHxgSA2\n3w9clizXzHNdTNKCA/ooXFwn1snP4cRf2qWnwipbFqUFaUU9HSiSb6Ro9vbXKfNS\nJZsJmGI4txg+3w0EqHtAgryYv1RW7RdjNG2KjWwOBFeIDGPiR25ITQxuceqIzhzQ\nmPbV7SSEkLQRJiRjNlCNT+tom/KtZYn06jbBGm8O3wKBgQD2yMGgL15gwcqEcjdh\nAIyZR8UQm/wtgoZwU46G8wGOOBCv9dew+qUIMbAa8y1BKvmksjCMMf0vp9hn3SLw\nyT/XALTQ7jNMoPAj8ORaxvuU0J4ClRMEKu8nVkQkSLUSWECVWT+Uv1it+my6pkF0\nodEeQ/DlyAfMXk7pP2hRCa6FjwKBgQDGYtEOQ8aUWoF9vzt1ZQcvHoilyaIQZdja\nlY5RGzHw/upul3RWDcpIeExfop8hfqcOI6NnmlKmz2J33aFaLoic5N0vxivaQOIh\ndKpBrrSnWMEKzf9RzNckCVufkJnG6bIjyXbt6qsB+I7PGNo30lt292MMlyJZN6oi\ndefncBjJmwKBgCFwMkwyHuedWoN3tmk+Wc6rGtiVSiYgeXbe24ENjDhpAFnXRdKF\nI7dohCQirw8Vc54NRua4H0ZFx9zK6eEWY8AOKHHm1KydYex8x3RFYfFYExDmgh0e\ndCkwVytTbrV9n8KcxTCyfKGWPQVNYbEb++nN6uY3pFbcsHSKUugoF62hAoGAM8vj\nF11cwKksu/8s8AazrHrFZLvTY4Kj7tYzdTure2ejH8LNbhZlpSw7jJCyCZW+2jM1\n27vwLnthEzi7gwc5RfV/RpTwKCjeoauLNGD/692BcWe9bMcVuOP0lyGy9LtZdnyI\nX6/wfDBAYRP1DbQPi20l4EipgC/HbP3p0YR0BFcCgYEAil55HwxqHwKZO5tGgSFB\numU1tM3b6rpOvfIer9dUPqZN7+Pef9GaWQs2NvPIlSn0bEZnjevLk0QOnACLOwfk\nBDv783BdHhTbwPMH+TjKu4n2GwrHRF6T5bNgeGqVe8jvD+mzXe/KQO402s6r5Ue1\n9JhV9GM9wVmbgjsXlOfVxCg=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

const parseDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  // Handle both ISO string and YYYY-MM-DD formats
  const date = new Date(dateStr);
   if (!isNaN(date.getTime())) {
    // The date is valid. If it's a UTC string, the time will be midnight.
    // If it's just 'YYYY-MM-DD', JS treats it as UTC midnight.
    // To avoid timezone shifts when displaying, we can adjust it.
    // By adding the timezone offset, we bring it to local midnight.
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date;
  }
  return null;
};


// Helper to serialize employee data for the sheet
const serializeEmployee = (employee: Partial<Employee>): Record<string, string | number | boolean> => {
    const serialized: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(employee)) {
        if (value instanceof Date) {
            // Format date as YYYY-MM-DD
            serialized[key] = value.toISOString().split('T')[0];
        } else if (value !== null && value !== undefined) {
            serialized[key] = value.toString();
        } else {
            serialized[key] = '';
        }
    }
    return serialized;
};

// Helper to deserialize sheet row to Employee object
const deserializeEmployee = (row: any): Employee => {
    const checkInDate = parseDate(row.get('checkInDate'));
    if (!checkInDate) {
        throw new Error(`Invalid or missing checkInDate for employee row: ${row.get('id')}`);
    }

    return {
        id: row.get('id'),
        fullName: row.get('fullName'),
        coordinatorId: row.get('coordinatorId'),
        nationality: row.get('nationality'),
        gender: row.get('gender') as 'Mężczyzna' | 'Kobieta',
        address: row.get('address'),
        roomNumber: row.get('roomNumber'),
        zaklad: row.get('zaklad'),
        checkInDate: checkInDate,
        checkOutDate: parseDate(row.get('checkOutDate')),
        contractStartDate: parseDate(row.get('contractStartDate')),
        contractEndDate: parseDate(row.get('contractEndDate')),
        departureReportDate: parseDate(row.get('departureReportDate')),
        comments: row.get('comments'),
        status: row.get('status') as 'active' | 'dismissed',
        oldAddress: row.get('oldAddress') || null,
    };
};

const deserializeNotification = (row: any): Notification => {
    const createdAtString = row.get('createdAt');
    const createdAt = new Date(createdAtString);
    if (isNaN(createdAt.getTime())) {
        console.error(`Invalid date string for notification: ${createdAtString}`);
    }
    return {
        id: row.get('id'),
        message: row.get('message'),
        employeeId: row.get('employeeId'),
        employeeName: row.get('employeeName'),
        coordinatorId: row.get('coordinatorId'),
        coordinatorName: row.get('coordinatorName'),
        createdAt: createdAt,
        isRead: row.get('isRead') === 'TRUE',
    };
};

const serializeNotification = (notification: Notification): Record<string, string> => {
    return {
        id: notification.id,
        message: notification.message,
        employeeId: notification.employeeId,
        employeeName: notification.employeeName,
        coordinatorId: notification.coordinatorId,
        coordinatorName: notification.coordinatorName,
        createdAt: notification.createdAt.toISOString(),
        isRead: String(notification.isRead).toUpperCase(),
    };
};

export async function getEmployees(): Promise<Employee[]> {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[SHEET_NAME_EMPLOYEES];
    if (!sheet) {
        console.error(`Sheet "${SHEET_NAME_EMPLOYEES}" not found.`);
        return [];
    }
    const rows = await sheet.getRows();
    return rows.map(deserializeEmployee);
  } catch (error) {
    console.error("Error fetching employees from Google Sheets:", error);
    throw new Error("Could not fetch employees.");
  }
}

export async function getSettings(): Promise<Settings> {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[SHEET_NAME_SETTINGS];
     if (!sheet) {
      throw new Error(`Sheet "${SHEET_NAME_SETTINGS}" not found.`);
    }

    const rows = await sheet.getRows();
    if (rows.length === 0 || !rows[0].get('settingsData')) {
      const defaultSettings: Settings = {
        id: 'global-settings',
        addresses: [],
        nationalities: [],
        departments: [],
        coordinators: [],
        genders: ['Mężczyzna', 'Kobieta'],
      };
      // Ensure headers are set
      await sheet.setHeaderRow(['settingsData']);
      await sheet.addRow({ settingsData: JSON.stringify(defaultSettings) });
      return defaultSettings;
    }

    const settingsRow = rows[0];
    const settingsData = settingsRow.get('settingsData');

    if (!settingsData) {
      throw new Error("Settings data not found in the sheet.");
    }
    
    return JSON.parse(settingsData);
  } catch (error) {
    console.error("Error fetching settings from Google Sheets:", error);
    // Fallback to mock settings in case of error
    const mockSettings: Settings = {
        id: 'global-settings',
        addresses: [
          { id: 'addr-1', name: 'ul. Słoneczna 1, Warszawa', capacity: 10 },
          { id: 'addr-2', name: 'ul. Leśna 2, Kraków', capacity: 8 },
        ],
        nationalities: ['Polska', 'Ukraina', 'Białoruś'],
        departments: ['Produkcja A', 'Logistyka'],
        coordinators: [
          { uid: 'coord-1', name: 'Marek Mostowiak' },
          { uid: 'coord-2', name: 'Ewa Malinowska' },
        ],
        genders: ['Mężczyzna', 'Kobieta'],
    };
    return mockSettings;
  }
}


const createNotification = async (
    actor: Coordinator,
    action: string,
    employee: { id: string, fullName: string }
) => {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_NOTIFICATIONS];
        if (!sheet) {
            await doc.addSheet({ title: SHEET_NAME_NOTIFICATIONS, headerValues: ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead'] });
        }
        const notificationSheet = doc.sheetsByTitle[SHEET_NAME_NOTIFICATIONS];


        const newNotification: Notification = {
            id: `notif-${Date.now()}`,
            message: `${actor.name} ${action} pracownika ${employee.fullName}.`,
            employeeId: employee.id,
            employeeName: employee.fullName,
            coordinatorId: actor.uid,
            coordinatorName: actor.name,
            createdAt: new Date(),
            isRead: false,
        };

        await notificationSheet.addRow(serializeNotification(newNotification));
    } catch (e) {
        console.error("Could not create notification:", e);
    }
};

export async function addEmployee(employeeData: Omit<Employee, 'id' | 'status'>, actor: Coordinator): Promise<Employee> {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_EMPLOYEES];
        if (!sheet) throw new Error(`Sheet "${SHEET_NAME_EMPLOYEES}" not found.`);

        const newEmployee: Employee = {
            ...employeeData,
            id: `emp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            status: 'active',
            checkOutDate: null,
            contractStartDate: employeeData.contractStartDate || null,
            contractEndDate: employeeData.contractEndDate || null,
            departureReportDate: employeeData.departureReportDate || null,
            comments: employeeData.comments || '',
            oldAddress: employeeData.oldAddress || null,
        };

        const serialized = serializeEmployee(newEmployee);
        const row = await sheet.addRow(serialized);
        const createdEmployee = deserializeEmployee(row);
        
        await createNotification(actor, 'dodał(a) nowego', createdEmployee);

        return createdEmployee;
    } catch (error) {
        console.error("Error adding employee to Google Sheets:", error);
        throw new Error("Could not add employee.");
    }
}

export async function updateEmployee(employeeId: string, employeeData: Partial<Omit<Employee, 'id'>>, actor: Coordinator): Promise<Employee> {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_EMPLOYEES];
        if (!sheet) throw new Error(`Sheet "${SHEET_NAME_EMPLOYEES}" not found.`);
        
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(row => row.get('id') === employeeId);

        if (rowIndex === -1) {
            throw new Error("Employee not found");
        }
        
        const rowToUpdate = rows[rowIndex];
        
        // Get current data, apply updates, then serialize for saving
        const currentData = deserializeEmployee(rowToUpdate);
        const updatedData = { ...currentData, ...employeeData };
        const serializedData = serializeEmployee(updatedData);

        for (const key of sheet.headerValues) {
            if (key in serializedData) {
                rowToUpdate.set(key, serializedData[key as keyof typeof serializedData]);
            }
        }
        
        await rowToUpdate.save();

        const savedRows = await sheet.getRows();
        const finalEmployee = deserializeEmployee(savedRows[rowIndex]);
        
        const action = employeeData.status === 'dismissed' ? 'zwolnił(a)' : (employeeData.status === 'active' ? 'przywrócił(a)' : 'zaktualizował(a) dane');
        await createNotification(actor, action, finalEmployee);

        return finalEmployee;

    } catch (error) {
        console.error("Error updating employee in Google Sheets:", error);
        throw new Error(`Could not update employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function updateSettings(newSettings: Partial<Settings>): Promise<Settings> {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_SETTINGS];
        if (!sheet) {
            throw new Error(`Sheet "${SHEET_NAME_SETTINGS}" not found or couldn't be created.`);
        }
        
        const rows = await sheet.getRows();
        const currentSettings = await getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings, id: 'global-settings' };

        const settingsJSON = JSON.stringify(updatedSettings);

        if (rows.length > 0) {
            const settingsRow = rows[0];
            settingsRow.set('settingsData', settingsJSON);
            await settingsRow.save();
        } else {
            await sheet.setHeaderRow(['settingsData']);
            await sheet.addRow({ settingsData: settingsJSON });
        }
        
        return updatedSettings;
    } catch (error) {
        console.error("Error updating settings in Google Sheets:", error);
        throw new Error("Could not update settings.");
    }
}


export async function getNotifications(): Promise<Notification[]> {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_NOTIFICATIONS];
        if (!sheet) {
            return [];
        }
        const rows = await sheet.getRows();
        return rows.map(deserializeNotification).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return [];
    }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_NOTIFICATIONS];
        if (!sheet) return;

        const rows = await sheet.getRows();
        const rowToUpdate = rows.find(row => row.get('id') === notificationId);

        if (rowToUpdate) {
            rowToUpdate.set('isRead', 'TRUE');
            await rowToUpdate.save();
        }
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}
