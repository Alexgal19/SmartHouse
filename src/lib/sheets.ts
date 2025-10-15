
"use server";

import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Employee, Settings, Notification, Coordinator, NotificationChange, HousingAddress, Room, Inspection, NonEmployee, DeductionReason, InspectionCategory, InspectionCategoryItem } from '@/types';
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


let docInstance: GoogleSpreadsheet | null = null;
let authInstance: JWT | null = null;

function getAuth(): JWT {
    if (authInstance) {
        return authInstance;
    }

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
    
    return authInstance;
}

async function getDoc(): Promise<GoogleSpreadsheet> {
    if (docInstance) {
        return docInstance;
    }
    const auth = getAuth();
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    try {
        await doc.loadInfo();
        docInstance = doc;
        return docInstance;
    } catch (error) {
        console.error("Failed to load Google Sheet document:", error);
        throw new Error("Could not connect to Google Sheets. Please check credentials and sheet ID.");
    }
}

export async function getSheet(title: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
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

const safeFormat = (dateStr: string | undefined | null): string | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (!isValid(date)) return null;
    try {
        return format(date, 'yyyy-MM-dd');
    } catch {
        return null;
    }
};

const deserializeEmployee = (row: any): Employee | null => {
    const id = row.get('id');
    if (!id) return null;

    const checkInDate = safeFormat(row.get('checkInDate'));
    if (!checkInDate) return null; // checkInDate is mandatory

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
    
    const depositReturnedRaw = row.get('depositReturned');
    const validDepositValues = ['Tak', 'Nie', 'Nie dotyczy'];
    const depositReturned = validDepositValues.includes(depositReturnedRaw) ? depositReturnedRaw as Employee['depositReturned'] : null;

    return {
        id: id,
        fullName: row.get('fullName') || '',
        coordinatorId: row.get('coordinatorId') || '',
        nationality: row.get('nationality') || '',
        gender: row.get('gender') || '',
        address: row.get('address') || '',
        roomNumber: row.get('roomNumber') || '',
        zaklad: row.get('zaklad') || '',
        checkInDate: checkInDate,
        checkOutDate: safeFormat(row.get('checkOutDate')),
        contractStartDate: safeFormat(row.get('contractStartDate')),
        contractEndDate: safeFormat(row.get('contractEndDate')),
        departureReportDate: safeFormat(row.get('departureReportDate')),
        comments: row.get('comments') || '',
        status: row.get('status') as 'active' | 'dismissed' || 'active',
        oldAddress: row.get('oldAddress') || undefined,
        depositReturned: depositReturned,
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
    
    const checkInDate = safeFormat(row.get('checkInDate'));
    if (!checkInDate) return null;

    return {
        id: id,
        fullName: fullName,
        address: row.get('address'),
        roomNumber: row.get('roomNumber'),
        checkInDate: checkInDate,
        checkOutDate: safeFormat(row.get('checkOutDate')),
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


export async function getEmployeesFromSheet(coordinatorId?: string): Promise<Employee[]> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, ['id']);
        const rows = await sheet.getRows({ offset: 0, limit: 5000 });
        
        const filteredRows = coordinatorId ? rows.filter(row => row.get('coordinatorId') === coordinatorId) : rows;

        return filteredRows.map(deserializeEmployee).filter((e): e is Employee => e !== null);

    } catch (error: any) {
        console.error("Error fetching employees from sheet:", error.message, error.stack);
        throw new Error(`Could not fetch employees from sheet. Original error: ${error.message}`);
    }
}

export async function getNonEmployeesFromSheet(): Promise<NonEmployee[]> {
  try {
    const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, ['id']);
    const rows = await sheet.getRows({ offset: 0, limit: 5000 });
    return rows.map(deserializeNonEmployee).filter((e): e is NonEmployee => e !== null);
  } catch (error: any) {
    console.error("Error fetching non-employees from sheet:", error.message, error.stack);
    throw new Error(`Could not fetch non-employees from sheet. Original error: ${error.message}`);
  }
}

export async function getSettingsFromSheet(): Promise<Settings> {
     try {
        const doc = await getDoc();

        const getSheetData = async (title: string) => {
            const sheet = doc.sheetsByTitle[title];
            if (!sheet) return [];
            try {
                return await sheet.getRows();
            } catch (e) {
                 console.warn(`Could not get rows from sheet: ${title}. It might be empty or missing.`);
                return [];
            }
        };

        const [
            addressRows,
            roomRows,
            nationalityRows,
            departmentRows,
            coordinatorRows,
            genderRows,
        ] = await Promise.all([
            getSheetData(SHEET_NAME_ADDRESSES),
            getSheetData(SHEET_NAME_ROOMS),
            getSheetData(SHEET_NAME_NATIONALITIES),
            getSheetData(SHEET_NAME_DEPARTMENTS),
            getSheetData(SHEET_NAME_COORDINATORS),
            getSheetData(SHEET_NAME_GENDERS),
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
            coordinatorId: row.get('coordinatorId') || null,
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
        console.error("Error fetching settings from sheet:", error.message, error.stack);
        throw new Error(`Could not fetch settings. Original error: ${error.message}`);
    }
}


export async function getNotificationsFromSheet(): Promise<Notification[]> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id']);
        const rows = await sheet.getRows();
        return rows.map(deserializeNotification)
            .filter((n): n is Notification => n !== null)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error: any) {
        console.error("Error fetching notifications from sheet:", error.message, error.stack);
        throw new Error(`Could not fetch notifications. Original error: ${error.message}`);
    }
}


export async function getInspectionsFromSheet(coordinatorId?: string): Promise<Inspection[]> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id']);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['id']);
        
        let inspectionRows = await inspectionsSheet.getRows();
        if (coordinatorId) {
            inspectionRows = inspectionRows.filter(row => row.get('coordinatorId') === coordinatorId);
        }

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
                    let type: InspectionCategoryItem['type'] = 'text';
                    let rawValue = detail.get('itemValue');
                    let value: any = rawValue;
                    
                    if (rawValue?.toLowerCase() === 'true' || rawValue?.toLowerCase() === 'false') {
                        type = 'yes_no';
                        value = rawValue.toLowerCase() === 'true';
                    } else if (['Wysoki', 'Normalny', 'Niski', 'Bardzo czysto', 'Czysto', 'Brudno', 'Bardzo brudno'].includes(rawValue)) {
                        type = 'select';
                    } else if (!isNaN(parseFloat(rawValue)) && isFinite(rawValue)) {
                        const num = parseFloat(rawValue);
                        if (num >= 1 && num <= 5 && Number.isInteger(num)) {
                            type = 'rating';
                            value = num;
                        } else {
                            type = 'number';
                            value = num;
                        }
                    }

                    category.items.push({ label: itemLabel, value, type, options: [] });
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
        console.error("Error fetching inspections from sheet:", error.message, error.stack);
        throw new Error(`Could not fetch inspections. Original error: ${error.message}`);
    }
}

    