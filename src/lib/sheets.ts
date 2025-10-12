
"use server";

import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Employee, Settings, Notification, Coordinator, NotificationChange, HousingAddress, Room, Inspection, NonEmployee, DeductionReason } from '@/types';
import { format, isValid } from 'date-fns';

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
const SHEET_NAME_INSPECTIONS = 'Inspections';
const SHEET_NAME_INSPECTION_DETAILS = 'InspectionDetails';

// --- MOCK IMPLEMENTATION ---
const MOCK_MODE = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY;

const getMockSettings = (): Settings => ({
    id: 'global-settings',
    addresses: [],
    nationalities: ['Mock Nationality'],
    departments: ['Mock Department'],
    coordinators: [{ uid: 'mock-admin', name: 'Mock Admin', isAdmin: true, password: '123' }],
    genders: ['Mężczyzna', 'Kobieta'],
});

export async function getEmployeesFromSheet(): Promise<Employee[]> {
    if (MOCK_MODE) return [];
    // Real implementation is below but won't be reached if keys are missing
    const auth = getAuth();
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[SHEET_NAME_EMPLOYEES];
    if (!sheet) return [];
    const rows = await sheet.getRows();
    return rows.map(deserializeEmployee).filter((e): e is Employee => e !== null);
}

export async function getSettingsFromSheet(): Promise<Settings> {
    if (MOCK_MODE) return getMockSettings();
    // Real implementation
     try {
        const auth = getAuth();
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
        await doc.loadInfo();

        const getSheetData = async (title: string, headers: string[]) => {
            const sheet = doc.sheetsByTitle[title];
            if (!sheet) return [];
            return sheet.getRows();
        };

        const [
            addressRows,
            roomRows,
            nationalityRows,
            departmentRows,
            coordinatorRows,
            genderRows,
        ] = await Promise.all([
            getSheetData(SHEET_NAME_ADDRESSES, ['id', 'name']),
            getSheetData(SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity']),
            getSheetData(SHEET_NAME_NATIONALITIES, ['name']),
            getSheetData(SHEET_NAME_DEPARTMENTS, ['name']),
            getSheetData(SHEET_NAME_COORDINATORS, COORDINATOR_HEADERS),
            getSheetData(SHEET_NAME_GENDERS, ['name']),
        ]);
        
        const roomsByAddressId = new Map<string, Room[]>();
        roomRows.forEach(row => {
            const addressId = row.get('addressId');
            if (addressId && !roomsByAddressId.has(addressId)) {
                roomsByAddressId.set(addressId, []);
            }
            if (addressId) {
                roomsByAddressId.get(addressId)!.push({
                    id: row.get('id'),
                    name: row.get('name'),
                    capacity: Number(row.get('capacity')) || 0,
                });
            }
        });

        const addresses: HousingAddress[] = addressRows.map(row => ({
            id: row.get('id'),
            name: row.get('name'),
            rooms: roomsByAddressId.get(row.get('id')) || [],
        }));

        const coordinators: Coordinator[] = coordinatorRows.map(row => ({
            uid: row.get('uid'),
            name: row.get('name'),
            isAdmin: row.get('isAdmin') === 'TRUE',
            password: row.get('password'),
        }));

        return {
            id: 'global-settings',
            addresses,
            nationalities: nationalityRows.map(row => row.get('name')).filter(Boolean),
            departments: departmentRows.map(row => row.get('name')).filter(Boolean),
            coordinators,
            genders: genderRows.map(row => row.get('name')).filter(Boolean),
        };
    } catch (error: any) {
        console.error("Error fetching settings from sheet:", error);
        throw new Error(`Could not fetch settings. Original error: ${error.message}`);
    }
}


export async function getNonEmployeesFromSheet(): Promise<NonEmployee[]> {
  if (MOCK_MODE) return [];
  try {
    const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
    const rows = await sheet.getRows();
    return rows.map(deserializeNonEmployee).filter((e): e is NonEmployee => e !== null);
  } catch (error: any) {
    console.error("Error fetching non-employees from sheet:", error);
    throw new Error(`Could not fetch non-employees from sheet. Original error: ${error.message}`);
  }
}

export async function getNotificationsFromSheet(): Promise<Notification[]> {
    if (MOCK_MODE) return [];
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const rows = await sheet.getRows();
        return rows.map(deserializeNotification)
            .filter((n): n is Notification => n !== null)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error: any) {
        console.error("Error fetching notifications from sheet:", error);
        throw new Error(`Could not fetch notifications. Original error: ${error.message}`);
    }
}


export async function getInspectionsFromSheet(): Promise<Inspection[]> {
    if (MOCK_MODE) return [];
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id', 'addressId', 'addressName', 'date', 'coordinatorId', 'coordinatorName', 'standard']);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['id', 'inspectionId', 'addressName', 'date', 'coordinatorName', 'category', 'itemLabel', 'itemValue', 'uwagi', 'photoData']);
        
        const inspectionRows = await inspectionsSheet.getRows();
        const detailRows = await detailsSheet.getRows();

        const detailsByInspectionId = new Map<string, any[]>();
        detailRows.forEach(row => {
            const inspectionId = row.get('inspectionId');
            if (inspectionId) {
                if (!detailsByInspectionId.has(inspectionId)) {
                    detailsByInspectionId.set(inspectionId, []);
                }
                detailsByInspectionId.get(inspectionId)!.push(row);
            }
        });

        const inspections = inspectionRows.map(row => {
            const inspectionId = row.get('id');
            const details = detailsByInspectionId.get(inspectionId) || [];
            
            const categoriesMap = new Map<string, InspectionCategory>();

            details.forEach(detail => {
                const categoryName = detail.get('category');
                if (!categoriesMap.has(categoryName)) {
                    categoriesMap.set(categoryName, { name: categoryName, items: [], uwagi: '', photos: [] });
                }
                const category = categoriesMap.get(categoryName)!;

                const itemLabel = detail.get('itemLabel');
                const uwagi = detail.get('uwagi');
                const photoData = detail.get('photoData');

                if (itemLabel && itemLabel !== 'Photo' && itemLabel !== 'Uwagi') {
                    // This logic is imperfect but better than nothing
                    let type: Inspection['categories'][0]['items'][0]['type'] = 'text';
                    let value: any = detail.get('itemValue');
                    
                    if (value === 'true' || value === 'false') {
                        type = 'yes_no';
                        value = value === 'true';
                    } else if (['Wysoki', 'Normalny', 'Niski', 'Bardzo czysto', 'Czysto', 'Brudno', 'Bardzo brudno'].includes(value)) {
                        type = 'select';
                    }

                    category.items.push({ label: itemLabel, value, type, options: [] }); // Options cannot be recovered here
                }
                if (uwagi) {
                    category.uwagi = uwagi;
                }
                if (photoData) {
                    if (!category.photos) category.photos = [];
                    category.photos.push(photoData);
                }
            });

            const inspectionDate = new Date(row.get('date'));
            return {
                id: inspectionId,
                addressId: row.get('addressId'),
                addressName: row.get('addressName'),
                date: isValid(inspectionDate) ? inspectionDate : new Date(),
                coordinatorId: row.get('coordinatorId'),
                coordinatorName: row.get('coordinatorName'),
                standard: row.get('standard') || null,
                categories: Array.from(categoriesMap.values()),
            };
        }).sort((a,b) => b.date.getTime() - a.date.getTime());

        return inspections;

    } catch (error: any) {
        console.error("Error fetching inspections from sheet:", error);
        throw new Error(`Could not fetch inspections. Original error: ${error.message}`);
    }
}


// --- ORIGINAL IMPLEMENTATION ---

const EMPLOYEE_HEADERS = [
    'id', 'fullName', 'coordinatorId', 'nationality', 'gender', 'address', 'roomNumber', 
    'zaklad', 'checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 
    'departureReportDate', 'comments', 'status', 'oldAddress',
    'depositReturned', 'depositReturnAmount', 'deductionRegulation', 'deductionNo4Months', 'deductionNo30Days', 'deductionReason'
];

const NON_EMPLOYEE_HEADERS = [
    'id', 'fullName', 'address', 'roomNumber', 'checkInDate', 'checkOutDate', 'comments'
];

const COORDINATOR_HEADERS = ['uid', 'name', 'isAdmin', 'password'];

let docInstance: GoogleSpreadsheet | null = null;
let authInstance: JWT | null = null;

function getAuth(): JWT {
    if (!authInstance) {
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const key = process.env.GOOGLE_PRIVATE_KEY;

        if (!email) {
            throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL. Please add it to your .env.local file.');
        }
        if (!key) {
            throw new Error('Missing GOOGLE_PRIVATE_KEY. Please add it to your .env.local file.');
        }

        authInstance = new JWT({
          email: email,
          key: key.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
    }
    return authInstance;
}

async function getDoc(): Promise<GoogleSpreadsheet> {
    if (!docInstance) {
        const auth = getAuth();
        docInstance = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
        await docInstance.loadInfo();
    }
    return docInstance;
}

export async function getSheet(title: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
    if (MOCK_MODE) {
        // This will throw but it's fine because we return early in calling functions.
        return {} as GoogleSpreadsheetWorksheet;
    }
    const doc = await getDoc();
    let sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        sheet = await doc.addSheet({ title, headerValues: headers });
    } else {
        await sheet.loadHeaderRow();
        const currentHeaders = sheet.headerValues;
        const missingHeaders = headers.filter(h => !currentHeaders.includes(h));
        if(missingHeaders.length > 0) {
            await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
        }
    }
    return sheet;
}

const deserializeEmployee = (row: any): Employee | null => {
    const id = row.get('id');
    const fullName = row.get('fullName');
    
    if (!id && !fullName) return null;
    
    const checkInDate = row.get('checkInDate') ? format(new Date(row.get('checkInDate')), 'yyyy-MM-dd') : '';

    const deductionReasonRaw = row.get('deductionReason');
    let deductionReason: DeductionReason[] | undefined = undefined;
    if (deductionReasonRaw && typeof deductionReasonRaw === 'string') {
        try {
            const parsed = JSON.parse(deductionReasonRaw);
            if(Array.isArray(parsed)) {
                deductionReason = parsed;
            }
        } catch(e) {
            console.warn(`Could not parse deductionReason for employee ${id}:`, e);
        }
    }

    return {
        id: id,
        fullName: fullName,
        coordinatorId: row.get('coordinatorId'),
        nationality: row.get('nationality'),
        gender: row.get('gender') as string,
        address: row.get('address'),
        roomNumber: row.get('roomNumber'),
        zaklad: row.get('zaklad'),
        checkInDate: checkInDate,
        checkOutDate: row.get('checkOutDate') ? format(new Date(row.get('checkOutDate')), 'yyyy-MM-dd') : null,
        contractStartDate: row.get('contractStartDate') ? format(new Date(row.get('contractStartDate')), 'yyyy-MM-dd') : null,
        contractEndDate: row.get('contractEndDate') ? format(new Date(row.get('contractEndDate')), 'yyyy-MM-dd') : null,
        departureReportDate: row.get('departureReportDate') ? format(new Date(row.get('departureReportDate')), 'yyyy-MM-dd') : null,
        comments: row.get('comments'),
        status: row.get('status') as 'active' | 'dismissed',
        oldAddress: row.get('oldAddress') || undefined,
        depositReturned: row.get('depositReturned') as Employee['depositReturned'] || null,
        depositReturnAmount: row.get('depositReturnAmount') ? parseFloat(row.get('depositReturnAmount')) : null,
        deductionRegulation: row.get('deductionRegulation') ? parseFloat(row.get('deductionRegulation')) : null,
        deductionNo4Months: row.get('deductionNo4Months') ? parseFloat(row.get('deductionNo4Months')) : null,
        deductionNo30Days: row.get('deductionNo30Days') ? parseFloat(row.get('deductionNo30Days')) : null,
        deductionReason: deductionReason,
    };
};

const deserializeNonEmployee = (row: any): NonEmployee | null => {
    const id = row.get('id');
    const fullName = row.get('fullName');
    
    if (!id && !fullName) return null;
    
    const checkInDate = row.get('checkInDate') ? format(new Date(row.get('checkInDate')), 'yyyy-MM-dd') : null;
    if (!checkInDate) return null;

    return {
        id: id,
        fullName: fullName,
        address: row.get('address'),
        roomNumber: row.get('roomNumber'),
        checkInDate: checkInDate,
        checkOutDate: row.get('checkOutDate') ? format(new Date(row.get('checkOutDate')), 'yyyy-MM-dd') : null,
        comments: row.get('comments'),
    };
};

const deserializeNotification = (row: any): Notification => {
    const createdAtString = row.get('createdAt');
    const createdAt = createdAtString ? new Date(createdAtString) : new Date(0);
    
    const changesString = row.get('changes');
    return {
        id: row.get('id'),
        message: row.get('message'),
        employeeId: row.get('employeeId'),
        employeeName: row.get('employeeName'),
        coordinatorId: row.get('coordinatorId'),
        coordinatorName: row.get('coordinatorName'),
        createdAt: createdAt,
        isRead: row.get('isRead') === 'TRUE',
        changes: changesString ? JSON.parse(changesString) : [],
    };
};
