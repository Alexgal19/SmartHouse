

"use server";

import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Employee, Settings, Notification, NotificationChange, Room, NonEmployee, DeductionReason, Address, Coordinator, NotificationType, AddressHistory, BOKStatus } from '../types';
import { format, isValid, parse, parseISO } from 'date-fns';

const SPREADSHEET_ID = '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';
const SHEET_NAME_EMPLOYEES = 'Employees';
const SHEET_NAME_NON_EMPLOYEES = 'NonEmployees';
const SHEET_NAME_NOTIFICATIONS = 'Powiadomienia';
const SHEET_NAME_ADDRESSES = 'Addresses';
const SHEET_NAME_ROOMS = 'Rooms';
const SHEET_NAME_NATIONALITIES = 'Nationalities';
const SHEET_NAME_DEPARTMENTS = 'Departments';
const SHEET_NAME_COORDINATORS = 'Coordinators';
const SHEET_NAME_GENDERS = 'Genders';
const SHEET_NAME_LOCALITIES = 'Localities';
const SHEET_NAME_PAYMENT_TYPES_NZ = 'PaymentTypesNZ';
const SHEET_NAME_ADDRESS_HISTORY = 'AddressHistory';
const SHEET_NAME_BOK_STATUSES = 'BOKStatuses';
const SHEET_NAME_ASSIGNMENT_HISTORY = 'AssignmentHistory';


function getAuth(): JWT {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY;

    if (!email) {
        throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL. Please add it to your .env.local file.');
    }
    if (!key) {
        throw new Error('Missing GOOGLE_PRIVATE_KEY. Please add it to your .env.local file.');
    }

    return new JWT({
      email: email,
      key: key.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

async function getDoc(): Promise<GoogleSpreadsheet> {
    try {
        const auth = getAuth();
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
        await doc.loadInfo();
        return doc;
    } catch (error: unknown) {
        console.error("Failed to load Google Sheet document:", error);
        throw new Error(`Could not connect to Google Sheets. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

export async function getSheet(title: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
    try {
        const doc = await getDoc();
        let sheet = doc.sheetsByTitle[title];
        if (!sheet) {
            if (!headers) {
                throw new Error(`Cannot create sheet "${title}" without headers.`);
            }
            sheet = await doc.addSheet({ title, headerValues: headers });
        } else {
            await sheet.loadHeaderRow();
            const currentHeaders = sheet.headerValues || [];
            if (headers) {
                const missingHeaders = headers.filter(h => !currentHeaders.includes(h));
                if (missingHeaders.length > 0) {
                    const newHeaders = [...currentHeaders, ...missingHeaders];
                    if (newHeaders.length > sheet.columnCount) {
                        await sheet.resize({
                            rowCount: sheet.rowCount,
                            columnCount: newHeaders.length
                        });
                    }
                    await sheet.setHeaderRow(newHeaders);
                }
            }
        }
        return sheet;
    } catch(error: unknown) {
        console.error(`Failed to get or create sheet "${title}":`, error);
        throw new Error(`Failed to access sheet "${title}". Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

const safeFormat = (dateValue: unknown): string | null => {
    if (dateValue === null || dateValue === undefined || dateValue === '') {
        return null;
    }

    if (dateValue instanceof Date) {
        if (isValid(dateValue)) {
            return format(dateValue, 'yyyy-MM-dd');
        }
    }

    if (typeof dateValue === 'number' && dateValue > 0) {
        // Excel's epoch starts on 1900-01-01, but it has a bug treating 1900 as a leap year.
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        if (isValid(date)) {
            return format(date, 'yyyy-MM-dd');
        }
    }

    const dateString = String(dateValue).trim();
    if (!dateString) return null;


    // Attempt to parse ISO string first (most reliable)
    let date = parseISO(dateString);
    if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
    }

    // Attempt to parse a specific format like dd-MM-yyyy or dd.MM.yyyy
    const formatsToTry = [
        'yyyy.MM.dd',
        'dd.MM.yyyy',
        'dd-MM-yyyy',
        'yyyy-MM-dd',
        'MM/dd/yyyy',
        'M/d/yyyy',
        'dd/MM/yy'
    ];
    for (const fmt of formatsToTry) {
        date = parse(dateString, fmt, new Date());
        if (isValid(date)) {
            return format(date, 'yyyy-MM-dd');
        }
    }

    // Try a more general Date constructor for other formats
    date = new Date(dateValue as string | number);
    if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
    }

    // If all else fails, return null
    return null;
};

const splitFullName = (fullName: string | null | undefined): { firstName: string, lastName: string } => {
    if (!fullName || typeof fullName !== 'string') {
        return { firstName: '', lastName: '' };
    }
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length === 1) {
        return { firstName: '', lastName: nameParts[0] };
    }
    const lastName = nameParts.shift() || '';
    const firstName = nameParts.join(' ');
    return { firstName, lastName };
}


const deserializeEmployee = (row: Record<string, unknown>): Employee | null => {
    const plainObject = row;
    
    const id = plainObject.id;
    if (!id || (!plainObject.lastName && !plainObject.fullName)) {
        return null;
    }

    const { firstName, lastName } = (plainObject.lastName && plainObject.firstName)
        ? { firstName: plainObject.firstName as string, lastName: plainObject.lastName as string}
        : splitFullName(plainObject.fullName as string);

    if (!lastName) {
        console.warn(`[Data Deserialization] Skipping employee record with ID "${id}" due to missing last name.`);
        return null;
    }

    const checkInDate = safeFormat(plainObject.checkInDate);
    if (!checkInDate) {
      // Don't skip, just warn and proceed with null.
        console.warn(`[Data Deserialization] Employee "${lastName}, ${firstName}" (ID: ${id}) has an invalid or missing check-in date: "${plainObject.checkInDate}". The record will be loaded, but this may affect functionality.`);
    }

    let deductionReason: DeductionReason[] | undefined = undefined;
    if (plainObject.deductionReason && typeof plainObject.deductionReason === 'string') {
        try {
            const parsed = JSON.parse(plainObject.deductionReason);
            if(Array.isArray(parsed)) deductionReason = parsed;
        } catch(e) {
            console.warn(`Could not parse deductionReason for employee ${id}:`, e);
        }
    }
    
    const validDepositValues = ['Tak', 'Nie', 'Nie dotyczy'];
    const depositReturned = validDepositValues.includes(plainObject.depositReturned as string) ? plainObject.depositReturned as Employee['depositReturned'] : null;

    const newEmployee: Employee = {
        id: id as string,
        firstName,
        lastName,
        fullName: `${lastName} ${firstName}`.trim(),
        coordinatorId: (plainObject.coordinatorId || '') as string,
        nationality: (plainObject.nationality || '') as string,
        gender: (plainObject.gender || '') as string,
        address: (plainObject.address || '') as string,
        ownAddress: (plainObject.ownAddress as string | null) || null,
        roomNumber: (plainObject.roomNumber || '') as string,
        zaklad: (plainObject.zaklad as string | null) || null,
        checkInDate: checkInDate,
        checkOutDate: safeFormat(plainObject.checkOutDate),
        contractStartDate: safeFormat(plainObject.contractStartDate),
        contractEndDate: safeFormat(plainObject.contractEndDate),
        departureReportDate: safeFormat(plainObject.departureReportDate),
        comments: (plainObject.comments || '') as string,
        status: plainObject.status as 'active' | 'dismissed' || 'active',
        depositReturned: depositReturned,
        depositReturnAmount: plainObject.depositReturnAmount ? parseFloat(plainObject.depositReturnAmount as string) : null,
        deductionRegulation: plainObject.deductionRegulation ? parseFloat(plainObject.deductionRegulation as string) : null,
        deductionNo4Months: plainObject.deductionNo4Months ? parseFloat(plainObject.deductionNo4Months as string) : null,
        deductionNo30Days: plainObject.deductionNo30Days ? parseFloat(plainObject.deductionNo30Days as string) : null,
        deductionReason: deductionReason,
        deductionEntryDate: safeFormat(plainObject.deductionEntryDate),
        bokStatus: (plainObject.bokStatus as string | null) || null,
        bokStatusDate: safeFormat(plainObject.bokStatusDate),
    };
    
    return newEmployee;
};

const deserializeNonEmployee = (row: Record<string, unknown>): NonEmployee | null => {
    const plainObject = row;
    const id = plainObject.id;
    if (!id || (!plainObject.lastName && !plainObject.fullName)) {
        return null;
    }

    const { firstName, lastName } = (plainObject.lastName && plainObject.firstName)
        ? { firstName: plainObject.firstName as string, lastName: plainObject.lastName as string}
        : splitFullName(plainObject.fullName as string);

    if (!lastName) {
        console.warn(`[Data Deserialization] Skipping non-employee record with ID "${id}" due to missing last name.`);
        return null;
    }
    
    const checkInDate = safeFormat(plainObject.checkInDate);
    if (!checkInDate) {
        // Don't skip, just warn and proceed with null.
        console.warn(`[Data Deserialization] Non-employee "${lastName}, ${firstName}" (ID: ${id}) has an invalid or missing check-in date: "${plainObject.checkInDate}". The record will be loaded, but this may affect functionality.`);
    }

    return {
        id: id as string,
        firstName,
        lastName,
        fullName: `${lastName} ${firstName}`.trim(),
        coordinatorId: (plainObject.coordinatorId || '') as string,
        nationality: (plainObject.nationality || '') as string,
        gender: (plainObject.gender || '') as string,
        address: (plainObject.address || '') as string,
        roomNumber: (plainObject.roomNumber || '') as string,
        checkInDate: checkInDate,
        checkOutDate: safeFormat(plainObject.checkOutDate),
        departureReportDate: safeFormat(plainObject.departureReportDate),
        comments: (plainObject.comments || '') as string,
        status: (plainObject.status as 'active' | 'dismissed') || 'active',
        paymentType: (plainObject.paymentType as string) || null,
        paymentAmount: plainObject.paymentAmount ? parseFloat(plainObject.paymentAmount as string) : null,
        bokStatus: (plainObject.bokStatus as string | null) || null,
        bokStatusDate: safeFormat(plainObject.bokStatusDate),
    };
};

const deserializeNotification = (row: Record<string, unknown>): Notification | null => {
    const plainObject = row;

    const id = plainObject.id;
    if (!id) return null;
    
    const createdAtString = plainObject.createdAt as string;
    const createdAt = createdAtString ? new Date(createdAtString).toISOString() : new Date(0).toISOString();
    
    let changes: NotificationChange[] = [];
    if (plainObject.changes && typeof plainObject.changes === 'string') {
        try {
            const parsed = JSON.parse(plainObject.changes);
            if (Array.isArray(parsed)) changes = parsed;
        } catch(e) {
             console.warn(`Could not parse changes for notification ${id}:`, e);
        }
    }

    const newNotification: Notification = {
        id: id as string,
        message: (plainObject.message || '') as string,
        entityId: (plainObject.entityId || '') as string,
        entityFirstName: (plainObject.entityFirstName || '') as string,
        entityLastName: (plainObject.entityLastName || '') as string,
        actorName: (plainObject.actorName || 'System') as string,
        recipientId: (plainObject.recipientId || '') as string,
        createdAt: createdAt,
        isRead: plainObject.isRead === 'TRUE',
        type: (plainObject.type as NotificationType) || 'info',
        changes: changes,
    };
    return newNotification;
};

const deserializeAddressHistory = (row: Record<string, unknown>): AddressHistory | null => {
    if (!row.id || !row.employeeId) return null;
    return {
        id: row.id as string,
        employeeId: row.employeeId as string,
        employeeFirstName: (row.employeeFirstName as string) || '',
        employeeLastName: (row.employeeLastName as string) || '',
        coordinatorName: (row.coordinatorName as string),
        department: (row.department as string),
        address: row.address as string,
        checkInDate: safeFormat(row.checkInDate),
        checkOutDate: safeFormat(row.checkOutDate),
    }
};

const getSheetData = async (doc: GoogleSpreadsheet, title: string): Promise<Record<string, string>[]> => {
    const sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        console.warn(`Sheet "${title}" not found. Returning empty array.`);
        return [];
    }

    try {
        const rows = await sheet.getRows();
        return rows.map(r => r.toObject());
    } catch (e) {
        console.warn(`Could not get rows from sheet: ${title}. It might be empty or missing headers. Returning empty array.`, e);
        return [];
    }
};


async function getSettingsFromSheet(doc: GoogleSpreadsheet): Promise<Settings> {
     try {
        const [
            addressRows,
            roomRows,
            nationalityRows,
            departmentRows,
            coordinatorRows,
            genderRows,
            localityRows,
            paymentTypesNZRows,
            bokStatusRows,
        ] = await Promise.all([
            getSheetData(doc, SHEET_NAME_ADDRESSES),
            getSheetData(doc, SHEET_NAME_ROOMS),
            getSheetData(doc, SHEET_NAME_NATIONALITIES),
            getSheetData(doc, SHEET_NAME_DEPARTMENTS),
            getSheetData(doc, SHEET_NAME_COORDINATORS),
            getSheetData(doc, SHEET_NAME_GENDERS),
            getSheetData(doc, SHEET_NAME_LOCALITIES),
            getSheetData(doc, SHEET_NAME_PAYMENT_TYPES_NZ),
            getSheetData(doc, SHEET_NAME_BOK_STATUSES),
        ]);
        
        const roomsByAddressId = new Map<string, Room[]>();
        roomRows.forEach(rowObj => {
            const addressId = rowObj.addressId;
            if (addressId) {
                if (!roomsByAddressId.has(addressId)) {
                    roomsByAddressId.set(addressId, []);
                }
                roomsByAddressId.get(addressId)!.push({
                    id: rowObj.id,
                    name: rowObj.name,
                    capacity: Number(rowObj.capacity) || 0,
                });
            }
        });

        const addresses: Address[] = addressRows.map(rowObj => {
            return {
                id: rowObj.id,
                name: rowObj.name,
                locality: rowObj.locality,
                coordinatorIds: (rowObj?.coordinatorIds || '').split(',').filter(Boolean),
                rooms: [...(roomsByAddressId.get(rowObj.id) || [])],
            }
        });

        const coordinators: Coordinator[] = coordinatorRows.map(rowObj => {
             return {
                uid: rowObj.uid,
                name: rowObj.name,
                isAdmin: rowObj.isAdmin === 'TRUE',
                departments: (rowObj?.departments || '').split(',').filter(Boolean),
                password: rowObj.password,
                visibilityMode: (rowObj.visibilityMode as 'department' | 'strict') || 'department',
                pushSubscription: (rowObj.pushSubscription as string | null) || null,
            }
        });
        
        const bokStatuses: BOKStatus[] = bokStatusRows.map((row) => ({
            id: row.id,
            name: row.name,
        }));

        return {
            id: 'global-settings',
            addresses,
            nationalities: nationalityRows.map(row => row.name).filter(Boolean),
            departments: departmentRows.map(row => row.name).filter(Boolean),
            coordinators,
            genders: genderRows.map(row => row.name).filter(Boolean),
            localities: localityRows.map(row => row.name).filter(Boolean),
            paymentTypesNZ: paymentTypesNZRows.map(row => row.name).filter(Boolean),
            bokStatuses,
        };
    } catch (error: unknown) {
        console.error("Error fetching settings from sheet:", error instanceof Error ? error.message : "Unknown error", error instanceof Error ? error.stack : "");
        throw new Error(`Could not fetch settings. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

export async function getOnlySettings(): Promise<Settings> {
    const doc = await getDoc();
    return await getSettingsFromSheet(doc);
}


async function getNotificationsFromSheet(doc: GoogleSpreadsheet, recipientId: string, isAdmin: boolean): Promise<Notification[]> {
    try {
        const allNotificationsRaw = await getSheetData(doc, SHEET_NAME_NOTIFICATIONS);

        const allNotifications = allNotificationsRaw
            .map(row => deserializeNotification(row))
            .filter((n): n is Notification => n !== null);

        const filtered = allNotifications.filter(n => {
            if (isAdmin) {
                 // Admins see their own notifications + all important ones
                 const isImportant = ['success', 'destructive', 'warning'].includes(n.type);
                 return isImportant || n.recipientId === recipientId;
            } else {
                // Regular users only see notifications addressed to them
                return n.recipientId === recipientId;
            }
        });
        
        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error: unknown) {
        console.error("Error fetching notifications from sheet:", error instanceof Error ? error.message : "Unknown error", error instanceof Error ? error.stack : "");
        throw new Error(`Could not fetch notifications. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

export async function getAllSheetsData(userId?: string, userIsAdmin?: boolean) {
    try {
        const doc = await getDoc();

        const [
            employeesSheet,
            nonEmployeesSheet,
            settings,
            notifications,
            addressHistorySheet,
        ] = await Promise.all([
            getSheetData(doc, SHEET_NAME_EMPLOYEES),
            getSheetData(doc, SHEET_NAME_NON_EMPLOYEES),
            getSettingsFromSheet(doc),
            userId ? getNotificationsFromSheet(doc, userId, userIsAdmin || false) : Promise.resolve([]),
            getSheetData(doc, SHEET_NAME_ADDRESS_HISTORY),
        ]);
        
        const employees = employeesSheet.map(row => deserializeEmployee(row)).filter((e): e is Employee => e !== null);
        const nonEmployees = nonEmployeesSheet.map(row => deserializeNonEmployee(row)).filter((e): e is NonEmployee => e !== null);
        
        const allPeopleMap = new Map([...employees, ...nonEmployees].map(p => [p.id, p]));

        const addressHistory = addressHistorySheet.map(row => {
            const historyEntry = deserializeAddressHistory(row);
            if (historyEntry && (!historyEntry.employeeFirstName || !historyEntry.employeeLastName)) {
                const person = allPeopleMap.get(historyEntry.employeeId);
                if (person) {
                    historyEntry.employeeFirstName = person.firstName;
                    historyEntry.employeeLastName = person.lastName;
                }
            }
            return historyEntry;
        }).filter((h): h is AddressHistory => h !== null);

        return { employees, settings, nonEmployees, notifications, addressHistory };

    } catch (error: unknown) {
        console.error("Error fetching all sheets data:", error);
        throw new Error(`Could not fetch all data from sheets. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

export async function addAddressHistoryEntry(data: Omit<AddressHistory, 'id'>) {
  const sheet = await getSheet(SHEET_NAME_ADDRESS_HISTORY, ['id', 'employeeId', 'employeeFirstName', 'employeeLastName', 'coordinatorName', 'department', 'address', 'checkInDate', 'checkOutDate']);
  await sheet.addRow({
    id: `hist-${Date.now()}`,
    ...data
  });
}

export async function updateAddressHistoryEntry(historyId: string, updates: Partial<AddressHistory>) {
    const sheet = await getSheet(SHEET_NAME_ADDRESS_HISTORY, ['id', 'employeeId', 'address', 'checkInDate', 'checkOutDate']);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('id') === historyId);
    if (row) {
        for (const key in updates) {
             row.set(key, (updates as any)[key]);
        }
        await row.save();
    }
}
export async function deleteAddressHistoryEntry(historyId: string) {
    const sheet = await getSheet(SHEET_NAME_ADDRESS_HISTORY, ['id']);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('id') === historyId);
    if (row) {
        await row.delete();
    } else {
        throw new Error('Address history entry not found');
    }
}

