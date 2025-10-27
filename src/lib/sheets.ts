
"use server";

import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Employee, Settings, Notification, NotificationChange, Room, NonEmployee, DeductionReason, EquipmentItem, Address, Coordinator, Inspection, InspectionCategory, InspectionCategoryItem, InspectionTemplateCategory } from '@/types';
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
const SHEET_NAME_EQUIPMENT = 'Equipment';
const SHEET_NAME_INSPECTIONS = 'Inspections';
const SHEET_NAME_INSPECTION_DETAILS = 'InspectionDetails';
const SHEET_NAME_INSPECTION_TEMPLATE = 'InspectionTemplate';

let doc: GoogleSpreadsheet | null = null;
let docPromise: Promise<GoogleSpreadsheet> | null = null;

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
    if (doc) {
        return doc;
    }
    if (docPromise) {
        return docPromise;
    }
    docPromise = (async () => {
        try {
            const auth = getAuth();
            const newDoc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
            await newDoc.loadInfo();
            doc = newDoc;
            return doc;
        } catch (error: unknown) {
            console.error("Failed to load Google Sheet document:", error);
            docPromise = null; // Reset promise on error
            throw new Error(`Could not connect to Google Sheets. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    })();
    return docPromise;
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
    } catch(error: unknown) {
        console.error(`Failed to get or create sheet "${title}":`, error);
        throw new Error(`Failed to access sheet "${title}". Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

const safeFormat = (dateValue: unknown): string | null => {
    if (dateValue === null || dateValue === undefined || dateValue === '') {
        return null;
    }

    let date = parseISO(String(dateValue));
    if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
    }

    date = parse(String(dateValue), 'dd-MM-yyyy', new Date());
     if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
    }
    date = parse(String(dateValue), 'dd.MM.yyyy', new Date());
     if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
    }

    date = new Date(dateValue as string | number);
    if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
    }

    if (typeof dateValue === 'number' && dateValue > 0) {
        const excelEpoch = new Date(1899, 11, 30);
        date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        if (isValid(date)) {
            return format(date, 'yyyy-MM-dd');
        }
    }

    return null;
};


const deserializeEmployee = (row: Record<string, unknown>): Employee | null => {
    const plainObject = row;
    
    const id = plainObject.id;
    if (!id) return null;

    const checkInDate = safeFormat(plainObject.checkInDate);

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
        fullName: (plainObject.fullName || '') as string,
        coordinatorId: (plainObject.coordinatorId || '') as string,
        nationality: (plainObject.nationality || '') as string,
        gender: (plainObject.gender || '') as string,
        address: (plainObject.address || '') as string,
        roomNumber: (plainObject.roomNumber || '') as string,
        zaklad: (plainObject.zaklad || '') as string,
        checkInDate: checkInDate || '',
        checkOutDate: safeFormat(plainObject.checkOutDate),
        contractStartDate: safeFormat(plainObject.contractStartDate),
        contractEndDate: safeFormat(plainObject.contractEndDate),
        departureReportDate: safeFormat(plainObject.departureReportDate),
        comments: (plainObject.comments || '') as string,
        status: plainObject.status as 'active' | 'dismissed' || 'active',
        oldAddress: (plainObject.oldAddress || undefined) as string | undefined,
        addressChangeDate: safeFormat(plainObject.addressChangeDate),
        depositReturned: depositReturned,
        depositReturnAmount: plainObject.depositReturnAmount ? parseFloat(plainObject.depositReturnAmount as string) : null,
        deductionRegulation: plainObject.deductionRegulation ? parseFloat(plainObject.deductionRegulation as string) : null,
        deductionNo4Months: plainObject.deductionNo4Months ? parseFloat(plainObject.deductionNo4Months as string) : null,
        deductionNo30Days: plainObject.deductionNo30Days ? parseFloat(plainObject.deductionNo30Days as string) : null,
        deductionReason: deductionReason,
    };
    
    return newEmployee;
};

const deserializeNonEmployee = (row: Record<string, unknown>): NonEmployee | null => {
    const plainObject = row;

    const id = plainObject.id;
    const fullName = plainObject.fullName;
    
    if (!id || !fullName) return null;
    
    const checkInDate = safeFormat(plainObject.checkInDate);
    if (!checkInDate) return null;
    
    const newNonEmployee: NonEmployee = {
        id: id as string,
        fullName: fullName as string,
        address: (plainObject.address || '') as string,
        roomNumber: (plainObject.roomNumber || '') as string,
        checkInDate: checkInDate,
        checkOutDate: safeFormat(plainObject.checkOutDate),
        comments: (plainObject.comments || '') as string,
    };
    return newNonEmployee;
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
        employeeId: (plainObject.employeeId || '') as string,
        employeeName: (plainObject.employeeName || '') as string,
        coordinatorId: (plainObject.coordinatorId || '') as string,
        coordinatorName: (plainObject.coordinatorName || '') as string,
        createdAt: createdAt,
        isRead: plainObject.isRead === 'TRUE',
        changes: changes,
    };
    return newNotification;
};

const deserializeEquipmentItem = (row: Record<string, unknown>): EquipmentItem | null => {
    const plainObject = row;
    const id = plainObject.id;
    if (!id) return null;

    return {
        id: id as string,
        inventoryNumber: (plainObject.inventoryNumber || '') as string,
        name: (plainObject.name || '') as string,
        quantity: Number(plainObject.quantity) || 0,
        description: (plainObject.description || '') as string,
        addressId: (plainObject.addressId || '') as string,
        addressName: (plainObject.addressName || '') as string,
    };
};

export async function getEmployeesFromSheet(coordinatorId?: string): Promise<Employee[]> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, ['id']);
        const rows = await sheet.getRows({ limit: 2000 });
        
        const plainRows = rows.map(r => r.toObject());
        const filteredRows = coordinatorId ? plainRows.filter(row => row.coordinatorId === coordinatorId) : plainRows;

        return filteredRows.map(deserializeEmployee).filter((e): e is Employee => e !== null);

    } catch (error: unknown) {
        console.error("Error fetching employees from sheet:", error instanceof Error ? error.message : "Unknown error", error instanceof Error ? error.stack : "");
        throw new Error(`Could not fetch employees from sheet. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

export async function getNonEmployeesFromSheet(): Promise<NonEmployee[]> {
  try {
    const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, ['id']);
    const rows = await sheet.getRows({ limit: 1000 });
    return rows.map(r => r.toObject()).map(deserializeNonEmployee).filter((e): e is NonEmployee => e !== null);
  } catch (error: unknown) {
    console.error("Error fetching non-employees from sheet:", error instanceof Error ? error.message : "Unknown error", error instanceof Error ? error.stack : "");
    throw new Error(`Could not fetch non-employees from sheet. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function getEquipmentFromSheet(coordinatorId?: string): Promise<EquipmentItem[]> {
  try {
    const equipmentSheet = await getSheet(SHEET_NAME_EQUIPMENT, ['id', 'inventoryNumber', 'name', 'quantity', 'description', 'addressId', 'addressName']);
    const equipmentRows = await equipmentSheet.getRows({ limit: 2000 });
    const plainEquipmentRows = equipmentRows.map(r => r.toObject());
    let equipment = plainEquipmentRows.map(deserializeEquipmentItem).filter((item): item is EquipmentItem => item !== null);

    if (coordinatorId) {
        const settings = await getSettingsFromSheet();
        const coordinatorAddresses = new Set(settings.addresses.filter(a => a.coordinatorId === coordinatorId).map(a => a.id));
        equipment = equipment.filter(item => coordinatorAddresses.has(item.addressId));
    }
    
    return equipment;
  } catch (error: unknown) {
    console.error("Error fetching equipment from sheet:", error instanceof Error ? error.message : "Unknown error", error instanceof Error ? error.stack : "");
    throw new Error(`Could not fetch equipment from sheet. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

const getSheetData = async (doc: GoogleSpreadsheet, title: string): Promise<Record<string, string>[]> => {
    const sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        console.warn(`Sheet "${title}" not found. Returning empty array.`);
        return [];
    }
    try {
        const rows = await sheet.getRows({ limit: 500 });
        return rows.map(r => r.toObject());
    } catch (e) {
         console.warn(`Could not get rows from sheet: ${title}. It might be empty or missing.`);
        return [];
    }
};

export async function getSettingsFromSheet(): Promise<Settings> {
     try {
        const doc = await getDoc();

        const [
            addressRows,
            roomRows,
            nationalityRows,
            departmentRows,
            coordinatorRows,
            genderRows,
            inspectionTemplateRows,
        ] = await Promise.all([
            getSheetData(doc, SHEET_NAME_ADDRESSES),
            getSheetData(doc, SHEET_NAME_ROOMS),
            getSheetData(doc, SHEET_NAME_NATIONALITIES),
            getSheetData(doc, SHEET_NAME_DEPARTMENTS),
            getSheetData(doc, SHEET_NAME_COORDINATORS),
            getSheetData(doc, SHEET_NAME_GENDERS),
            getSheetData(doc, SHEET_NAME_INSPECTION_TEMPLATE),
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
                coordinatorId: rowObj.coordinatorId,
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
        
        const inspectionTemplate = inspectionTemplateRows.reduce((acc: InspectionTemplateCategory[], row) => {
            const categoryName = row.category;
            if (!categoryName) return acc;

            let category = acc.find(c => c.name === categoryName);
            if (!category) {
                category = { name: categoryName, items: [] };
                acc.push(category);
            }

            category.items.push({
                label: row.label,
                type: row.type as InspectionCategoryItem['type'],
                options: row.options ? row.options.split(',').map((s: string) => s.trim()) : [],
            });

            return acc;
        }, []);

        return {
            id: 'global-settings',
            addresses,
            nationalities: nationalityRows.map(row => row.name).filter(Boolean),
            departments: departmentRows.map(row => row.name).filter(Boolean),
            coordinators,
            genders: genderRows.map(row => row.name).filter(Boolean),
            temporaryAccess: [],
            inspectionTemplate,
        };
    } catch (error: unknown) {
        console.error("Error fetching settings from sheet:", error instanceof Error ? error.message : "Unknown error", error instanceof Error ? error.stack : "");
        throw new Error(`Could not fetch settings. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}


export async function getNotificationsFromSheet(): Promise<Notification[]> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id']);
        const rows = await sheet.getRows({ limit: 200 });
        const plainRows = rows.map(r => r.toObject());
        return plainRows.map(deserializeNotification)
            .filter((n): n is Notification => n !== null)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error: unknown) {
        console.error("Error fetching notifications from sheet:", error instanceof Error ? error.message : "Unknown error", error instanceof Error ? error.stack : "");
        throw new Error(`Could not fetch notifications. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

export async function getAllSheetsData() {
    try {
        const doc = await getDoc();

        const [
            employeesSheet,
            settingsSheets,
            nonEmployeesSheet,
            equipmentSheet,
            notificationsSheet,
            inspectionsSheet,
            inspectionDetailsSheet,
        ] = await Promise.all([
            getSheetData(doc, SHEET_NAME_EMPLOYEES),
            (async () => {
                const [addressRows, roomRows, nationalityRows, departmentRows, coordinatorRows, genderRows, inspectionTemplateRows] = await Promise.all([
                    getSheetData(doc, SHEET_NAME_ADDRESSES),
                    getSheetData(doc, SHEET_NAME_ROOMS),
                    getSheetData(doc, SHEET_NAME_NATIONALITIES),
                    getSheetData(doc, SHEET_NAME_DEPARTMENTS),
                    getSheetData(doc, SHEET_NAME_COORDINATORS),
                    getSheetData(doc, SHEET_NAME_GENDERS),
                    getSheetData(doc, SHEET_NAME_INSPECTION_TEMPLATE),
                ]);
                return { addressRows, roomRows, nationalityRows, departmentRows, coordinatorRows, genderRows, inspectionTemplateRows };
            })(),
            getSheetData(doc, SHEET_NAME_NON_EMPLOYEES),
            getSheetData(doc, SHEET_NAME_EQUIPMENT),
            getSheetData(doc, SHEET_NAME_NOTIFICATIONS),
            getSheetData(doc, SHEET_NAME_INSPECTIONS),
            getSheetData(doc, SHEET_NAME_INSPECTION_DETAILS)
        ]);

        const roomsByAddressId = new Map<string, Room[]>();
        settingsSheets.roomRows.forEach(rowObj => {
            const addressId = rowObj.addressId;
            if (addressId) {
                if (!roomsByAddressId.has(addressId)) {
                    roomsByAddressId.set(addressId, []);
                }
                roomsByAddressId.get(addressId)!.push({ id: rowObj.id, name: rowObj.name, capacity: Number(rowObj.capacity) || 0 });
            }
        });
        const addresses: Address[] = settingsSheets.addressRows.map(rowObj => ({ id: rowObj.id, name: rowObj.name, coordinatorId: rowObj.coordinatorId, rooms: roomsByAddressId.get(rowObj.id) || [] }));
        const coordinators: Coordinator[] = settingsSheets.coordinatorRows.map(rowObj => ({ uid: rowObj.uid, name: rowObj.name, isAdmin: rowObj.isAdmin === 'TRUE', password: rowObj.password }));
        
        const inspectionTemplate = settingsSheets.inspectionTemplateRows.reduce((acc: InspectionTemplateCategory[], row) => {
            const categoryName = row.category;
            if (!categoryName) return acc;

            let category = acc.find(c => c.name === categoryName);
            if (!category) {
                category = { name: categoryName, items: [] };
                acc.push(category);
            }

            category.items.push({
                label: row.label,
                type: row.type as InspectionCategoryItem['type'],
                options: row.options ? row.options.split(',').map((s: string) => s.trim()) : [],
            });

            return acc;
        }, []);
        
        const settings: Settings = {
            id: 'global-settings',
            addresses,
            nationalities: settingsSheets.nationalityRows.map(row => row.name).filter(Boolean),
            departments: settingsSheets.departmentRows.map(row => row.name).filter(Boolean),
            coordinators,
            genders: settingsSheets.genderRows.map(row => row.name).filter(Boolean),
            temporaryAccess: [],
            inspectionTemplate,
        };

        const employees = employeesSheet.map(row => deserializeEmployee(row as Record<string, unknown>)).filter((e): e is Employee => e !== null);
        const nonEmployees = nonEmployeesSheet.map(row => deserializeNonEmployee(row as Record<string, unknown>)).filter((e): e is NonEmployee => e !== null);
        const equipment = equipmentSheet.map(row => deserializeEquipmentItem(row as Record<string, unknown>)).filter((item): item is EquipmentItem => item !== null);

        const notifications = notificationsSheet
            .map(row => deserializeNotification(row as Record<string, unknown>))
            .filter((n): n is Notification => n !== null)
            .sort((a: Notification, b: Notification) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const detailsByInspectionId = new Map<string, Record<string, string>[]>();
        inspectionDetailsSheet.forEach(row => {
            const inspectionId = row.inspectionId;
            if (inspectionId) {
                if (!detailsByInspectionId.has(inspectionId)) {
                    detailsByInspectionId.set(inspectionId, []);
                }
                detailsByInspectionId.get(inspectionId)!.push(row);
            }
        });

        const inspections = inspectionsSheet.map(row => {
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
                if (itemLabel && !itemLabel.startsWith('Photo') && itemLabel !== 'Uwagi') {
                    let type: InspectionCategoryItem['type'] = 'text';
                    const rawValue = detail.itemValue;
                    let value: unknown = rawValue;
                    
                    if (rawValue?.toLowerCase() === 'true' || rawValue?.toLowerCase() === 'false') {
                        type = 'yes_no';
                        value = rawValue.toLowerCase() === 'true';
                    } else if (['Wysoki', 'Normalny', 'Niski', 'Bardzo czysto', 'Czysto', 'Brudno', 'Bardzo brudno', 'Do poprawy'].includes(rawValue)) {
                        type = 'select';
                    } else if (rawValue && !isNaN(parseFloat(rawValue)) && isFinite(rawValue as any)) {
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
                             // eslint-disable-next-line no-empty
                        }
                    }

                    category.items.push({ label: itemLabel, value: value as string | number | boolean | string[], type, options: [] });
                }
                if (detail.uwagi) {
                    category.uwagi = detail.uwagi;
                }
                if (detail.photoData) {
                    if (!category.photos) category.photos = [];
                    category.photos.push(detail.photoData);
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
                categories: Array.from(categoriesMap.values()),
            };
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return { employees, settings, nonEmployees, equipment, notifications, inspections };

    } catch (error: unknown) {
        console.error("Error fetching all sheets data:", error);
        throw new Error(`Could not fetch all data from sheets. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
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

        const detailsByInspectionId = new Map<string, Record<string, string>[]>();
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

                if (itemLabel && !itemLabel.startsWith('Photo') && itemLabel !== 'Uwagi') {
                    let type: InspectionCategoryItem['type'] = 'text';
                    const rawValue = detail.itemValue;
                    let value: unknown = rawValue;
                    
                    if (rawValue?.toLowerCase() === 'true' || rawValue?.toLowerCase() === 'false') {
                        type = 'yes_no';
                        value = rawValue.toLowerCase() === 'true';
                    } else if (['Wysoki', 'Normalny', 'Niski', 'Bardzo czysto', 'Czysto', 'Do poprawy', 'Brudno', 'Bardzo brudno'].includes(rawValue)) {
                        type = 'select';
                    } else if (rawValue && !isNaN(parseFloat(rawValue)) && isFinite(rawValue as any)) {
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

                    category.items.push({ label: itemLabel, value: value as string | number | boolean | string[], type, options: [] });
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
                categories: Array.from(categoriesMap.values()),
            };
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return inspections;

    } catch (error: unknown) {
        console.error("Error fetching inspections from sheet:", error instanceof Error ? error.message : "Unknown error", error instanceof Error ? error.stack : "");
        throw new Error(`Could not fetch inspections. Original error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

    