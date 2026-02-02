
"use server";

import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Employee, Settings, Notification, NotificationChange, Room, NonEmployee, DeductionReason, Address, Coordinator, NotificationType, AddressHistory, BokResident } from '../types';
import { format, isValid, parse, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

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
const SHEET_NAME_STATUSES = 'Statuses';
const SHEET_NAME_ADDRESS_HISTORY = 'AddressHistory';
const SHEET_NAME_BOK_RESIDENTS = 'BokResidents';
const SHEET_NAME_BOK_ROLES = 'BokRoles';
const SHEET_NAME_BOK_RETURN_OPTIONS = 'BokReturnOptions';

// Cache for the Google Spreadsheet document (reduces loadInfo calls)
let cachedDoc: GoogleSpreadsheet | null = null;
let docLoadTime = 0;
const DOC_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for settings (reduces calls to dictionary sheets)
let settingsCache: { data: Settings, timestamp: number } | null = null;
const SETTINGS_CACHE_TTL = 60 * 1000; // 1 minute

// Cache for other data
let employeesCache: { data: Employee[], timestamp: number } | null = null;
let nonEmployeesCache: { data: NonEmployee[], timestamp: number } | null = null;
let bokResidentsCache: { data: BokResident[], timestamp: number } | null = null;
let addressHistoryCache: { data: AddressHistory[], timestamp: number } | null = null;
const DATA_CACHE_TTL = 60 * 1000; // 1 minute

export async function invalidateEmployeesCache() { employeesCache = null; }
export async function invalidateNonEmployeesCache() { nonEmployeesCache = null; }
export async function invalidateBokResidentsCache() { bokResidentsCache = null; }
export async function invalidateAddressHistoryCache() { addressHistoryCache = null; }
export async function invalidateSettingsCache() { settingsCache = null; }

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
    if (cachedDoc && (Date.now() - docLoadTime < DOC_TTL)) {
        return cachedDoc;
    }
    try {
        const auth = getAuth();
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
        await doc.loadInfo();
        cachedDoc = doc;
        docLoadTime = Date.now();
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
                    // This is a safer way to add headers without resizing the entire sheet,
                    // which can fail on very large sheets that are close to the cell limit.
                    // It loads only the header row, writes the new header values, and saves them.
                    const lastCol = XLSX.utils.encode_col(currentHeaders.length + missingHeaders.length - 1);
                    await sheet.loadCells(`A1:${lastCol}1`);

                    missingHeaders.forEach((header, index) => {
                        const cell = sheet.getCell(0, currentHeaders.length + index);
                        cell.value = header;
                    });

                    await sheet.saveUpdatedCells();
                    
                    // Manually update the headerValues on the sheet object to avoid another network call
                    // This is safe because we just added them.
                    sheet.headerValues.push(...missingHeaders);
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
        coordinatorName: (row.coordinatorName as string) || '',
        department: (row.department as string) || '',
        address: (row.address as string) || '',
        checkInDate: safeFormat(row.checkInDate),
        checkOutDate: safeFormat(row.checkOutDate),
    }
};

const deserializeBokResident = (row: Record<string, unknown>): BokResident | null => {
    const plainObject = row;
    const id = plainObject.id;
    if (!id || (!plainObject.lastName && !plainObject.fullName)) {
        return null;
    }

    const { firstName, lastName } = (plainObject.lastName && plainObject.firstName)
        ? { firstName: plainObject.firstName as string, lastName: plainObject.lastName as string}
        : splitFullName(plainObject.fullName as string);

    if (!lastName) {
        console.warn(`[Data Deserialization] Skipping BOK resident record with ID "${id}" due to missing last name.`);
        return null;
    }
    
    const checkInDate = safeFormat(plainObject.checkInDate);
    if (!checkInDate) {
        console.warn(`[Data Deserialization] BOK resident "${lastName}, ${firstName}" (ID: ${id}) has an invalid or missing check-in date.`);
    }

    return {
        id: id as string,
        role: (plainObject.role || '') as string,
        firstName,
        lastName,
        fullName: `${lastName} ${firstName}`.trim(),
        coordinatorId: (plainObject.coordinatorId || '') as string,
        nationality: (plainObject.nationality || '') as string,
        address: (plainObject.address || '') as string,
        roomNumber: (plainObject.roomNumber || '') as string,
        zaklad: (plainObject.zaklad || '') as string,
        gender: (plainObject.gender || '') as string,
        checkInDate: checkInDate,
        checkOutDate: safeFormat(plainObject.checkOutDate),
        returnStatus: (plainObject.returnStatus || '') as string,
        status: (plainObject.status || '') as string,
        comments: (plainObject.comments || '') as string,
    };
};

const getSheetData = async (doc: GoogleSpreadsheet, title: string, retry = 0): Promise<Record<string, string>[]> => {
    const sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        console.warn(`Sheet "${title}" not found. Returning empty array.`);
        return [];
    }

    try {
        const rows = await sheet.getRows();
        return rows.map(r => r.toObject());
    } catch (e: unknown) {
        if (e instanceof Error && (e.message.includes('429') || e.message.includes('Quota exceeded')) && retry < 3) {
            const delay = 1000 * Math.pow(2, retry);
            console.warn(`Quota exceeded for ${title}. Retrying in ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay));
            return getSheetData(doc, title, retry + 1);
        }
        console.warn(`Could not get rows from sheet: ${title}. It might be empty or missing headers. Returning empty array.`, e);
        return [];
    }
};


async function getSettingsFromSheet(doc: GoogleSpreadsheet): Promise<Settings> {
     if (settingsCache && (Date.now() - settingsCache.timestamp < SETTINGS_CACHE_TTL)) {
         return settingsCache.data;
     }
     try {
        // Batch requests to avoid hitting rate limits (429)
        const [
            addressRows,
            roomRows,
            nationalityRows,
            departmentRows,
        ] = await Promise.all([
            getSheetData(doc, SHEET_NAME_ADDRESSES),
            getSheetData(doc, SHEET_NAME_ROOMS),
            getSheetData(doc, SHEET_NAME_NATIONALITIES),
            getSheetData(doc, SHEET_NAME_DEPARTMENTS),
        ]);

        const [
            coordinatorRows,
            genderRows,
            localityRows,
            paymentTypesNZRows,
        ] = await Promise.all([
            getSheetData(doc, SHEET_NAME_COORDINATORS),
            getSheetData(doc, SHEET_NAME_GENDERS),
            getSheetData(doc, SHEET_NAME_LOCALITIES),
            getSheetData(doc, SHEET_NAME_PAYMENT_TYPES_NZ),
        ]);

        const [
            statusRows,
            bokRoleRows,
            bokReturnOptionRows,
            bokStatusRows,
        ] = await Promise.all([
            getSheetData(doc, SHEET_NAME_STATUSES),
            getSheetData(doc, SHEET_NAME_BOK_ROLES),
            getSheetData(doc, SHEET_NAME_BOK_RETURN_OPTIONS),
            getSheetData(doc, SHEET_NAME_BOK_STATUSES),
        ]);
        
        const roomsByAddressId = new Map<string, Room[]>();
        roomRows.forEach(rowObj => {
            const addressId = rowObj.addressId;
            if (addressId) {
                if (!roomsByAddressId.has(addressId)) {
                    roomsByAddressId.set(addressId, []);
                }
                const isActiveRaw = rowObj.isActive !== undefined ? rowObj.isActive : rowObj['isactive'];
                let isActive = true;
                if (isActiveRaw !== undefined && isActiveRaw !== null && String(isActiveRaw).trim() !== '') {
                     isActive = String(isActiveRaw).toUpperCase() === 'TRUE';
                }

                roomsByAddressId.get(addressId)!.push({
                    id: rowObj.id,
                    name: rowObj.name,
                    capacity: Number(rowObj.capacity) || 0,
                    isActive: isActive,
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
        
        const settings: Settings = {
            id: 'global-settings',
            addresses,
            nationalities: nationalityRows.map(row => row.name).filter(Boolean),
            departments: departmentRows.map(row => row.name).filter(Boolean),
            coordinators,
            genders: genderRows.map(row => row.name).filter(Boolean),
            localities: localityRows.map(row => row.name).filter(Boolean),
            paymentTypesNZ: paymentTypesNZRows.map(row => row.name).filter(Boolean),
            statuses: statusRows.map(row => row.name).filter(Boolean),
            bokRoles: bokRoleRows.map(row => row.name).filter(Boolean),
            bokReturnOptions: bokReturnOptionRows.map(row => row.name).filter(Boolean),
            bokStatuses: bokStatusRows.map(row => row.name).filter(Boolean),
        };
        settingsCache = { data: settings, timestamp: Date.now() };
        return settings;
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

        // Settings (already cached internally in getSettingsFromSheet)
        const settingsPromise = getSettingsFromSheet(doc);

        // Notifications (not cached, user specific)
        const notificationsPromise = userId ? getNotificationsFromSheet(doc, userId, userIsAdmin || false) : Promise.resolve([]);

        // Employees
        let employeesPromise: Promise<Employee[]>;
        if (employeesCache && (Date.now() - employeesCache.timestamp < DATA_CACHE_TTL)) {
            employeesPromise = Promise.resolve(employeesCache.data);
        } else {
            employeesPromise = getSheetData(doc, SHEET_NAME_EMPLOYEES).then(rows => {
                 const data = rows.map(row => deserializeEmployee(row)).filter((e): e is Employee => e !== null);
                 employeesCache = { data, timestamp: Date.now() };
                 return data;
            });
        }

        // NonEmployees
        let nonEmployeesPromise: Promise<NonEmployee[]>;
        if (nonEmployeesCache && (Date.now() - nonEmployeesCache.timestamp < DATA_CACHE_TTL)) {
             nonEmployeesPromise = Promise.resolve(nonEmployeesCache.data);
        } else {
             nonEmployeesPromise = getSheetData(doc, SHEET_NAME_NON_EMPLOYEES).then(rows => {
                const data = rows.map(row => deserializeNonEmployee(row)).filter((e): e is NonEmployee => e !== null);
                nonEmployeesCache = { data, timestamp: Date.now() };
                return data;
             });
        }

        // BokResidents
        let bokResidentsPromise: Promise<BokResident[]>;
        if (bokResidentsCache && (Date.now() - bokResidentsCache.timestamp < DATA_CACHE_TTL)) {
            bokResidentsPromise = Promise.resolve(bokResidentsCache.data);
        } else {
            bokResidentsPromise = getSheetData(doc, SHEET_NAME_BOK_RESIDENTS).then(rows => {
                const data = rows.map(row => deserializeBokResident(row)).filter((e): e is BokResident => e !== null);
                bokResidentsCache = { data, timestamp: Date.now() };
                return data;
            });
        }

        // AddressHistory (needs raw rows first to be deserialized properly later? No, we can deserialize inside the promise)
        // Wait, addressHistory deserialization logic depends on `allPeopleMap` in the original code.
        // I need to fetch raw address history first, then combine.
        // Or I can cache the deserialized address history *after* mapping names?
        // If I cache address history with names, I need to make sure names are up to date.
        // Actually, the original code deserializes, then fills missing names from `allPeopleMap`.
        // If I cache AddressHistory, I should probably cache it "as is" or fully resolved.
        // If I cache fully resolved, I need to invalidate it when people change names (rare).
        // Let's cache the resolved version.
        
        // However, `allPeopleMap` is derived from the *current* fetch of employees/nonEmployees.
        // If I use cached employees, I should use those for the map.
        
        const [
            employees,
            nonEmployees,
            settings,
            notifications,
            bokResidents
        ] = await Promise.all([
            employeesPromise,
            nonEmployeesPromise,
            settingsPromise,
            notificationsPromise,
            bokResidentsPromise
        ]);

        // Address History - slightly more complex due to dependency on people
        let addressHistory: AddressHistory[];
        if (addressHistoryCache && (Date.now() - addressHistoryCache.timestamp < DATA_CACHE_TTL)) {
            addressHistory = addressHistoryCache.data;
        } else {
             // We need fresh address history rows
             const addressHistoryRows = await getSheetData(doc, SHEET_NAME_ADDRESS_HISTORY);
             const allPeopleMap = new Map([...employees, ...nonEmployees, ...bokResidents].map(p => [p.id, p]));
             
             addressHistory = addressHistoryRows.map(row => {
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
            
            addressHistoryCache = { data: addressHistory, timestamp: Date.now() };
        }

        return { employees, settings, nonEmployees, notifications, addressHistory, bokResidents };

    } catch (error: unknown) {
        console.error("Error fetching all sheets data:", error);
        throw new Error(`Could not fetch all data from sheets. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

export async function addAddressHistoryEntry(data: Omit<AddressHistory, 'id'>) {
  const sheet = await getSheet(SHEET_NAME_ADDRESS_HISTORY, ['id', 'employeeId', 'employeeFirstName', 'employeeLastName', 'coordinatorName', 'department', 'address', 'checkInDate', 'checkOutDate']);
  await sheet.addRow({
    id: `hist-${Date.now()}`,
    ...data,
    checkInDate: data.checkInDate || '',
    checkOutDate: data.checkOutDate || '',
  });
  await invalidateAddressHistoryCache();
}

export async function updateAddressHistoryEntry(historyId: string, updates: Partial<AddressHistory>) {
    const sheet = await getSheet(SHEET_NAME_ADDRESS_HISTORY, ['id', 'employeeId', 'address', 'checkInDate', 'checkOutDate']);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('id') === historyId);
    if (row) {
        const keys = Object.keys(updates) as Array<keyof AddressHistory>;
        for (const key of keys) {
            if (key === 'id') continue;
            const value = updates[key];
            if (value !== undefined) {
                row.set(key, value ?? '');
            }
        }
        await row.save();
        await invalidateAddressHistoryCache();
    }
}
export async function deleteAddressHistoryEntry(historyId: string) {
    const sheet = await getSheet(SHEET_NAME_ADDRESS_HISTORY, ['id']);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('id') === historyId);
    if (row) {
        await row.delete();
        await invalidateAddressHistoryCache();
    } else {
        throw new Error('Address history entry not found');
    }
}
