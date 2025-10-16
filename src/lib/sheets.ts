
"use server";

import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet, GoogleSpreadsheetRow } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Employee, Settings, Notification, Coordinator, NotificationChange, HousingAddress, Room, Inspection, NonEmployee, DeductionReason, InspectionCategory, InspectionCategoryItem, EquipmentItem } from '@/types';
import { format, isValid, parseISO } from 'date-fns';

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
const SHEET_NAME_EQUIPMENT = 'Equipment';

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
    const auth = getAuth();
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    try {
        await doc.loadInfo();
        return doc;
    } catch (error: any) {
        console.error("Failed to load Google Sheet document:", error);
        throw new Error(`Could not connect to Google Sheets. Original error: ${error.message}`);
    }
}

export async function getSheet(title: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
    try {
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
    } catch(error: any) {
        console.error(`Failed to get or create sheet "${title}":`, error);
        throw new Error(`Failed to access sheet "${title}". Original error: ${error.message}`);
    }
}

const safeFormat = (dateValue: any): string | null => {
    if (dateValue === null || dateValue === undefined || dateValue === '') {
        return null;
    }
    if (dateValue instanceof Date) {
        return isValid(dateValue) ? format(dateValue, 'yyyy-MM-dd') : null;
    }
    if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        return isValid(date) ? format(date, 'yyyy-MM-dd') : null;
    }
    if (typeof dateValue === 'string') {
        const isoDate = parseISO(dateValue);
        if (isValid(isoDate)) {
            return format(isoDate, 'yyyy-MM-dd');
        }
    }
    return null;
};


const deserializeEmployee = (row: GoogleSpreadsheetRow<any>): Employee | null => {
    const plainObject = row.toObject();
    
    const id = plainObject.id;
    if (!id) return null;

    const checkInDate = safeFormat(plainObject.checkInDate);
    if (!checkInDate) return null;

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
    const depositReturned = validDepositValues.includes(plainObject.depositReturned) ? plainObject.depositReturned as Employee['depositReturned'] : null;

    const newEmployee: Employee = {
        id: id,
        fullName: plainObject.fullName || '',
        coordinatorId: plainObject.coordinatorId || '',
        nationality: plainObject.nationality || '',
        gender: plainObject.gender || '',
        address: plainObject.address || '',
        roomNumber: plainObject.roomNumber || '',
        zaklad: plainObject.zaklad || '',
        checkInDate: checkInDate,
        checkOutDate: safeFormat(plainObject.checkOutDate),
        contractStartDate: safeFormat(plainObject.contractStartDate),
        contractEndDate: safeFormat(plainObject.contractEndDate),
        departureReportDate: safeFormat(plainObject.departureReportDate),
        comments: plainObject.comments || '',
        status: plainObject.status as 'active' | 'dismissed' || 'active',
        oldAddress: plainObject.oldAddress || undefined,
        depositReturned: depositReturned,
        depositReturnAmount: plainObject.depositReturnAmount ? parseFloat(plainObject.depositReturnAmount) : null,
        deductionRegulation: plainObject.deductionRegulation ? parseFloat(plainObject.deductionRegulation) : null,
        deductionNo4Months: plainObject.deductionNo4Months ? parseFloat(plainObject.deductionNo4Months) : null,
        deductionNo30Days: plainObject.deductionNo30Days ? parseFloat(plainObject.deductionNo30Days) : null,
        deductionReason: deductionReason,
    };
    
    return newEmployee;
};

const deserializeNonEmployee = (row: GoogleSpreadsheetRow<any>): NonEmployee | null => {
    const plainObject = row.toObject();

    const id = plainObject.id;
    const fullName = plainObject.fullName;
    
    if (!id || !fullName) return null;
    
    const checkInDate = safeFormat(plainObject.checkInDate);
    if (!checkInDate) return null;
    
    const newNonEmployee: NonEmployee = {
        id: id,
        fullName: fullName,
        address: plainObject.address || '',
        roomNumber: plainObject.roomNumber || '',
        checkInDate: checkInDate,
        checkOutDate: safeFormat(plainObject.checkOutDate),
        comments: plainObject.comments || '',
    };
    return newNonEmployee;
};

const deserializeNotification = (row: GoogleSpreadsheetRow<any>): Notification | null => {
    const plainObject = row.toObject();

    const id = plainObject.id;
    if (!id) return null;
    
    const createdAtString = plainObject.createdAt;
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
        id: id,
        message: plainObject.message || '',
        employeeId: plainObject.employeeId || '',
        employeeName: plainObject.employeeName || '',
        coordinatorId: plainObject.coordinatorId || '',
        coordinatorName: plainObject.coordinatorName || '',
        createdAt: createdAt,
        isRead: plainObject.isRead === 'TRUE',
        changes: changes,
    };
    return newNotification;
};

const deserializeEquipmentItem = (row: GoogleSpreadsheetRow<any>): EquipmentItem | null => {
    const plainObject = row.toObject();
    const id = plainObject.id;
    if (!id) return null;

    return {
        id,
        inventoryNumber: plainObject.inventoryNumber || '',
        name: plainObject.name || '',
        quantity: Number(plainObject.quantity) || 0,
        description: plainObject.description || '',
        addressId: plainObject.addressId || '',
        addressName: plainObject.addressName || '',
    };
};

export async function getEmployeesFromSheet(coordinatorId?: string): Promise<Employee[]> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, ['id']);
        const rows = await sheet.getRows({ limit: 2000 });
        
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
    const rows = await sheet.getRows({ limit: 1000 });
    return rows.map(deserializeNonEmployee).filter((e): e is NonEmployee => e !== null);
  } catch (error: any) {
    console.error("Error fetching non-employees from sheet:", error.message, error.stack);
    throw new Error(`Could not fetch non-employees from sheet. Original error: ${error.message}`);
  }
}

export async function getEquipmentFromSheet(): Promise<EquipmentItem[]> {
  try {
    const sheet = await getSheet(SHEET_NAME_EQUIPMENT, ['id', 'inventoryNumber', 'name', 'quantity', 'description', 'addressId', 'addressName']);
    const rows = await sheet.getRows({ limit: 2000 });
    return rows.map(deserializeEquipmentItem).filter((item): item is EquipmentItem => item !== null);
  } catch (error: any) {
    console.error("Error fetching equipment from sheet:", error.message, error.stack);
    throw new Error(`Could not fetch equipment from sheet. Original error: ${error.message}`);
  }
}

export async function getSettingsFromSheet(): Promise<Settings> {
     try {
        const doc = await getDoc();

        const getSheetData = async (title: string) => {
            const sheet = doc.sheetsByTitle[title];
            if (!sheet) return [];
            try {
                const rows = await sheet.getRows({ limit: 500 });
                return rows.map(r => r.toObject());
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

        const addresses: HousingAddress[] = addressRows.map(rowObj => {
            return {
                id: rowObj.id,
                name: rowObj.name,
                coordinatorId: rowObj.coordinatorId || null,
                rooms: roomsByAddressId.get(rowObj.id) || [],
            }
        });

        const coordinators: Coordinator[] = coordinatorRows.map(rowObj => {
             return {
                uid: rowObj.uid,
                name: rowObj.name,
                isAdmin: rowObj.isAdmin === 'TRUE',
                password: rowObj.password,
            }
        });

        return {
            id: 'global-settings',
            addresses,
            nationalities: nationalityRows.map(row => row.name).filter(Boolean),
            departments: departmentRows.map(row => row.name).filter(Boolean),
            coordinators,
            genders: genderRows.map(row => row.name).filter(Boolean),
        };
    } catch (error: any) {
        console.error("Error fetching settings from sheet:", error.message, error.stack);
        throw new Error(`Could not fetch settings. Original error: ${error.message}`);
    }
}


export async function getNotificationsFromSheet(): Promise<Notification[]> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id']);
        const rows = await sheet.getRows({ limit: 200 });
        return rows.map(deserializeNotification)
            .filter((n): n is Notification => n !== null)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error: any) {
        console.error("Error fetching notifications from sheet:", error.message, error.stack);
        throw new Error(`Could not fetch notifications. Original error: ${error.message}`);
    }
}


export async function getInspectionsFromSheet(coordinatorId?: string): Promise<Inspection[]> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id']);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['id']);
        
        let inspectionRowsRaw = await inspectionsSheet.getRows({ limit: 1000 });
        if (coordinatorId) {
            inspectionRowsRaw = inspectionRowsRaw.filter(row => row.get('coordinatorId') === coordinatorId);
        }
        
        const inspectionRows = inspectionRowsRaw.map(r => r.toObject());
        const detailRows = (await detailsSheet.getRows({ limit: 5000 })).map(r => r.toObject());

        const detailsByInspectionId = new Map<string, any[]>();
        detailRows.forEach(row => {
            const inspectionId = row.inspectionId;
            if (inspectionId) {
                if (!detailsByInspectionId.has(inspectionId)) {
                    detailsByInspectionId.set(inspectionId, []);
                }
                detailsByInspectionId.get(inspectionId)!.push(row);
            }
        });

        const inspections = inspectionRows.map(row => {
            const inspectionId = row.id;
            const details = detailsByInspectionId.get(inspectionId) || [];
            
            const categoriesMap = new Map<string, InspectionCategory>();

            details.forEach(detail => {
                const categoryName = detail.category;
                if (!categoriesMap.has(categoryName)) {
                    categoriesMap.set(categoryName, { name: categoryName, items: [], uwagi: '', photos: [] });
                }
                const category = categoriesMap.get(categoryName)!;

                const itemLabel = detail.itemLabel;
                const uwagi = detail.uwagi;
                const photoData = detail.photoData;

                if (itemLabel && itemLabel !== 'Photo' && itemLabel !== 'Uwagi') {
                    let type: InspectionCategoryItem['type'] = 'text';
                    let rawValue = detail.itemValue;
                    let value: any = rawValue;
                    
                    if (rawValue?.toLowerCase() === 'true' || rawValue?.toLowerCase() === 'false') {
                        type = 'yes_no';
                        value = rawValue.toLowerCase() === 'true';
                    } else if (['Wysoki', 'Normalny', 'Niski', 'Bardzo czysto', 'Czysto', 'Brudno', 'Bardzo brudno'].includes(rawValue)) {
                        type = 'select';
                    } else if (rawValue && !isNaN(parseFloat(rawValue)) && isFinite(rawValue)) {
                        const num = parseFloat(rawValue);
                        if (num >= 1 && num <= 5 && Number.isInteger(num)) {
                            type = 'rating';
                            value = num;
                        } else {
                            type = 'number';
                            value = num;
                        }
                    } else if (typeof rawValue === 'string' && rawValue.startsWith('[') && rawValue.endsWith(']')) {
                        try {
                            value = JSON.parse(rawValue);
                            type = 'checkbox_group';
                        } catch {
                            // keep as text
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

            const inspectionDate = row.date;
            return {
                id: inspectionId,
                addressId: row.addressId,
                addressName: row.addressName,
                date: inspectionDate ? new Date(inspectionDate).toISOString() : new Date().toISOString(),
                coordinatorId: row.coordinatorId,
                coordinatorName: row.coordinatorName,
                standard: row.standard || null,
                categories: [...categoriesMap.values()],
            };
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return inspections;

    } catch (error: any) {
        console.error("Error fetching inspections from sheet:", error.message, error.stack);
        throw new Error(`Could not fetch inspections. Original error: ${error.message}`);
    }
}

    
