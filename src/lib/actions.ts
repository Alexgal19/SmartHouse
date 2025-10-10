
"use server";

import type { Employee, Settings, Notification, Coordinator, NotificationChange, HousingAddress, Room, Inspection, NonEmployee, DeductionReason } from '@/types';
import { getSheet, getEmployeesFromSheet, getSettingsFromSheet, getNotificationsFromSheet, getInspectionsFromSheet, getNonEmployeesFromSheet } from '@/lib/sheets';
import { format, isEqual, isPast, isValid, parse } from 'date-fns';
import * as XLSX from 'xlsx';

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


const serializeDate = (date: string | null | undefined): string => {
    if (!date || !isValid(new Date(date))) {
        return '';
    }
    return date; // It's already a YYYY-MM-DD string
};

const serializeEmployee = (employee: Partial<Employee>): Record<string, string | number | boolean> => {
    const serialized: Record<string, any> = {};
    const dataToSerialize = { ...employee };

    for (const [key, value] of Object.entries(dataToSerialize)) {
        if (['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate'].includes(key)) {
            serialized[key] = serializeDate(value as string);
        } else if (Array.isArray(value)) {
            serialized[key] = JSON.stringify(value);
        } else if (value !== null && value !== undefined) {
            serialized[key] = value.toString();
        } else {
            serialized[key] = '';
        }
    }
    return serialized;
};


const serializeNonEmployee = (nonEmployee: Partial<NonEmployee>): Record<string, string | number | boolean> => {
    const serialized: Record<string, any> = {};
    for (const [key, value] of Object.entries(nonEmployee)) {
        if (['checkInDate', 'checkOutDate'].includes(key)) {
            serialized[key] = serializeDate(value as string);
        } else if (value !== null && value !== undefined) {
            serialized[key] = value.toString();
        } else {
            serialized[key] = '';
        }
    }
    return serialized;
};

const serializeNotification = (notification: Omit<Notification, 'changes'> & { changes?: NotificationChange[] }): Record<string, string> => {
    return {
        id: notification.id,
        message: notification.message,
        employeeId: notification.employeeId,
        employeeName: notification.employeeName,
        coordinatorId: notification.coordinatorId,
        coordinatorName: notification.coordinatorName,
        createdAt: notification.createdAt.toISOString(),
        isRead: String(notification.isRead).toUpperCase(),
        changes: JSON.stringify(notification.changes || []),
    };
};

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

export async function getEmployees(): Promise<Employee[]> {
  try {
    return await getEmployeesFromSheet();
  } catch (error) {
    console.error("Error in getEmployees (actions):", error);
    throw new Error(`Could not fetch employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getNonEmployees(): Promise<NonEmployee[]> {
  try {
    return await getNonEmployeesFromSheet();
  } catch (error) {
    console.error("Error in getNonEmployees (actions):", error);
    throw new Error(`Could not fetch non-employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getSettings(): Promise<Settings> {
  try {
    return await getSettingsFromSheet();
  } catch (error) {
    console.error("Error in getSettings:", error);
    throw new Error(`Could not fetch settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


const createNotification = async (
    actor: Coordinator,
    action: string,
    employee: { id: string, fullName: string },
    changes: NotificationChange[] = []
) => {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        
        const message = `${actor.name} ${action} pracownika ${employee.fullName}.`;
        
        const newNotification: Notification = {
            id: `notif-${Date.now()}`,
            message,
            employeeId: employee.id,
            employeeName: employee.fullName,
            coordinatorId: actor.uid,
            coordinatorName: actor.name,
            createdAt: new Date(),
            isRead: false,
            changes
        };

        await sheet.addRow(serializeNotification(newNotification), { raw: false, valueInputOption: 'USER_ENTERED' });
    } catch (e) {
        console.error("Could not create notification:", e);
    }
};

export async function addEmployee(employeeData: Omit<Employee, 'id' | 'status'>, actor: Coordinator): Promise<Employee> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const newEmployee: Employee = {
            ...employeeData,
            id: `emp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            status: 'active',
            checkOutDate: employeeData.checkOutDate || null,
            contractStartDate: employeeData.contractStartDate || null,
            contractEndDate: employeeData.contractEndDate || null,
            departureReportDate: employeeData.departureReportDate || null,
            comments: employeeData.comments || '',
            oldAddress: employeeData.oldAddress || null,
        };

        const serialized = serializeEmployee(newEmployee);
        await sheet.addRow(serialized, { raw: false, valueInputOption: 'USER_ENTERED' });
        
        await createNotification(actor, 'dodał(a) nowego', newEmployee);

        return newEmployee;
    } catch (error) {
        console.error("Error adding employee to Google Sheets:", error);
        throw new Error("Could not add employee.");
    }
}

export async function addNonEmployee(nonEmployeeData: Omit<NonEmployee, 'id'>): Promise<NonEmployee> {
    try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const newNonEmployee: NonEmployee = {
            ...nonEmployeeData,
            id: `ne-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            checkOutDate: nonEmployeeData.checkOutDate || null,
            comments: nonEmployeeData.comments || '',
        };

        const serialized = serializeNonEmployee(newNonEmployee);
        await sheet.addRow(serialized, { raw: false, valueInputOption: 'USER_ENTERED' });

        return newNonEmployee;
    } catch (error) {
        console.error("Error adding non-employee to Google Sheets:", error);
        throw new Error("Could not add non-employee.");
    }
}

const formatDateForChanges = (date: string | null | undefined): string => {
    if (!date || !isValid(parse(date, 'yyyy-MM-dd', new Date()))) return 'N/A';
    return format(parse(date, 'yyyy-MM-dd', new Date()), 'dd-MM-yyyy');
};


const getChanges = (oldData: Employee, newData: Partial<Omit<Employee, 'id'>>): NotificationChange[] => {
    const changes: NotificationChange[] = [];
    const fieldLabels: Record<string, string> = {
        fullName: 'Imię i nazwisko',
        coordinatorId: 'Koordynator',
        nationality: 'Narodowość',
        gender: 'Płeć',
        address: 'Adres',
        roomNumber: 'Numer pokoju',
        zaklad: 'Zakład',
        checkInDate: 'Data zameldowania',
        checkOutDate: 'Data wymeldowania',
        contractStartDate: 'Umowa od',
        contractEndDate: 'Umowa do',
        departureReportDate: 'Data zgłoszenia виїзду',
        comments: 'Komentarze',
        status: 'Status',
        oldAddress: 'Stary adres',
        depositReturned: 'Zwrot kaucji',
        depositReturnAmount: 'Kwota zwrotu kaucji',
        deductionRegulation: 'Potrącenie (regulamin)',
        deductionNo4Months: 'Potrącenie (4 miesiące)',
        deductionNo30Days: 'Potrącenie (30 dni)',
        deductionReason: 'Powód potrącenia',
    };

    for (const key in newData) {
        if (key === 'id') continue;
        
        const typedKey = key as keyof Omit<Employee, 'id'>;
        const oldValue = oldData[typedKey];
        const newValue = newData[typedKey];
        
        let areEqual = false;
        
        const isDateField = ['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate'].includes(typedKey);

        if (Array.isArray(oldValue) && Array.isArray(newValue)) {
            areEqual = JSON.stringify(oldValue.sort()) === JSON.stringify(newValue.sort());
        }
        else if ((oldValue === null || oldValue === undefined || oldValue === '') && (newValue === null || newValue === undefined || newValue === '')) {
             areEqual = true;
        }
        else {
            areEqual = String(oldValue) === String(newValue);
        }

        if (!areEqual) {
             let oldFormatted: string;
             let newFormatted: string;
 
             if (isDateField) {
                 oldFormatted = formatDateForChanges(oldValue as string);
                 newFormatted = formatDateForChanges(newValue as string);
             } else if(Array.isArray(oldValue)) {
                oldFormatted = oldValue.map(item => typeof item === 'object' ? item.name : item).join(', ');
             } else if (Array.isArray(newValue)) {
                newFormatted = newValue.map(item => typeof item === 'object' ? item.name : item).join(', ');
             }
              else {
                 oldFormatted = String(oldValue ?? 'N/A');
                 newFormatted = String(newValue ?? 'N/A');
             }

            changes.push({
                field: fieldLabels[typedKey] || typedKey,
                oldValue: oldFormatted,
                newValue: newFormatted,
            });
        }
    }
    return changes;
};

export async function updateEmployee(employeeId: string, employeeData: Partial<Omit<Employee, 'id'>>, actor: Coordinator, createNotif: boolean = true): Promise<Employee> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(row => row.get('id') === employeeId);

        if (rowIndex === -1) {
            throw new Error("Employee not found");
        }
        
        const rowToUpdate = rows[rowIndex];
        
        const allEmployees: Employee[] = await getEmployeesFromSheet();
        const currentData = allEmployees.find(e => e.id === employeeId);
        if (!currentData) throw new Error("Employee not found for change detection");


        const changes = getChanges(currentData, employeeData);
        
        let action = 'zaktualizował(a) dane';
        if (employeeData.status) {
            if (employeeData.status === 'dismissed' && currentData.status !== 'dismissed') action = 'zwolnił(a)';
            if (employeeData.status === 'active' && currentData.status !== 'active') action = 'przywrócił(a)';
        } 
        
        const serializedChanges = serializeEmployee(employeeData);

        for (const key of Object.keys(serializedChanges)) {
            if (sheet.headerValues.includes(key)) {
                 rowToUpdate.set(key, serializedChanges[key as keyof typeof serializedChanges]);
            }
        }
        
        await rowToUpdate.save({ raw: false, valueInputOption: 'USER_ENTERED' });

        const updatedData = { ...currentData, ...employeeData };

        if(changes.length > 0 && createNotif) { 
            await createNotification(actor, action, updatedData, changes);
        }

        return updatedData;

    } catch (error) {
        console.error("Error updating employee in Google Sheets:", error);
        throw new Error(`Could not update employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function updateNonEmployee(id: string, data: Partial<Omit<NonEmployee, 'id'>>): Promise<NonEmployee> {
    try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(row => row.get('id') === id);

        if (rowIndex === -1) throw new Error("Non-employee not found");
        
        const rowToUpdate = rows[rowIndex];
        const allNonEmployees: NonEmployee[] = await getNonEmployeesFromSheet();
        const currentData = allNonEmployees.find(e => e.id === id);
        if (!currentData) throw new Error("Non-employee not found for update");

        const serializedChanges = serializeNonEmployee(data);

        for (const key of Object.keys(serializedChanges)) {
             if (sheet.headerValues.includes(key)) {
                rowToUpdate.set(key, serializedChanges[key as keyof typeof serializedChanges]);
             }
        }
        
        await rowToUpdate.save({ raw: false, valueInputOption: 'USER_ENTERED' });
        
        const updatedData = { ...currentData, ...data };
        return updatedData;
    } catch (error) {
        console.error("Error updating non-employee in Google Sheets:", error);
        throw new Error(`Could not update non-employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function deleteNonEmployee(id: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowToDelete = rows.find(row => row.get('id') === id);

        if (rowToDelete) {
            await rowToDelete.delete();
        } else {
            throw new Error("Non-employee not found to delete");
        }
    } catch (error) {
        console.error("Error deleting non-employee:", error);
        throw new Error(`Could not delete non-employee. ${error instanceof Error ? error.message : ''}`);
    }
}

async function syncSheet<T extends Record<string, any>>(
    sheetName: string,
    headers: string[],
    newData: T[],
    serializeFn: (item: T) => Record<string, any> = (item) => item
) {
    const sheet = await getSheet(sheetName, headers);
    await sheet.clearRows();
    if (newData.length > 0) {
        const serializedData = newData.map(serializeFn);
        await sheet.addRows(serializedData, { raw: false, valueInputOption: 'USER_ENTERED' });
    }
}


export async function updateSettings(newSettings: Partial<Settings>): Promise<Settings> {
    try {
        const currentSettings = await getSettings();
        const updatedSettings = { ...currentSettings, ...newSettings };

        if (newSettings.addresses) {
            const allRooms = newSettings.addresses.flatMap(address => 
                address.rooms.map(room => ({ ...room, addressId: address.id }))
            );
            await syncSheet(SHEET_NAME_ADDRESSES, ['id', 'name'], updatedSettings.addresses, item => ({ id: item.id, name: item.name }));
            await syncSheet(SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity'], allRooms);
        }
        if (newSettings.nationalities) {
            await syncSheet(SHEET_NAME_NATIONALITIES, ['name'], updatedSettings.nationalities.map((name: string) => ({ name })));
        }
        if (newSettings.departments) {
            await syncSheet(SHEET_NAME_DEPARTMENTS, ['name'], updatedSettings.departments.map((name: string) => ({ name })));
        }
        if (newSettings.genders) {
            await syncSheet(SHEET_NAME_GENDERS, ['name'], updatedSettings.genders.map((name: string) => ({ name })));
        }
        if (newSettings.coordinators) {
             await syncSheet(
                SHEET_NAME_COORDINATORS, 
                COORDINATOR_HEADERS, 
                updatedSettings.coordinators,
                (item) => ({ ...item, isAdmin: String(item.isAdmin).toUpperCase(), password: item.password || '' })
            );
        }
        
        return getSettings();
    } catch (error) {
        console.error("Error updating settings in Google Sheets:", error);
        throw new Error("Could not update settings.");
    }
}


export async function getNotifications(): Promise<Notification[]> {
    try {
        return await getNotificationsFromSheet();
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return [];
    }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const rows = await sheet.getRows();
        const rowToUpdate = rows.find(row => row.get('id') === notificationId);

        if (rowToUpdate) {
            rowToUpdate.set('isRead', 'TRUE');
            await rowToUpdate.save({ raw: false, valueInputOption: 'USER_ENTERED' });
        }
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}

export async function clearAllNotifications(): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        await sheet.clearRows();
    } catch (error) {
        console.error("Error clearing notifications:", error);
        throw new Error("Nie udało się usunąć powiadomień.");
    }
}


// --- Inspections Actions ---

const INSPECTION_HEADERS = ['id', 'addressId', 'addressName', 'date', 'coordinatorId', 'coordinatorName', 'standard'];
const INSPECTION_DETAILS_HEADERS = ['id', 'inspectionId', 'addressName', 'date', 'coordinatorName', 'category', 'itemLabel', 'itemValue', 'uwagi', 'photoData'];

const serializeRaw = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
};

const serializeInspection = (inspection: Omit<Inspection, 'categories'>): Record<string, string | number | boolean> => ({
    id: inspection.id,
    addressId: inspection.addressId,
    addressName: inspection.addressName,
    date: inspection.date.toISOString(),
    coordinatorId: inspection.coordinatorId,
    coordinatorName: inspection.coordinatorName,
    standard: serializeRaw(inspection.standard),
});

export async function getInspections(): Promise<Inspection[]> {
    try {
        return await getInspectionsFromSheet();
    } catch (error) {
        console.error("Error fetching inspections:", error);
        return [];
    }
}

async function saveInspectionData(inspectionData: Omit<Inspection, 'id'>, id?: string) {
    const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, INSPECTION_HEADERS);
    const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, INSPECTION_DETAILS_HEADERS);

    const inspectionId = id || `insp-${Date.now()}`;
    const { categories, ...restOfData } = inspectionData;
    
    // Efficiently delete old details
    const allDetailRows = await detailsSheet.getRows();
    const detailsToDelete = allDetailRows.filter(r => r.get('inspectionId') === inspectionId);
    
    // Using for...of loop to ensure sequential deletion
    for (const row of detailsToDelete) {
        await row.delete();
    }

    const mainInspectionData = serializeInspection({ ...restOfData, id: inspectionId });
    const allInspectionRows = await inspectionsSheet.getRows();
    const existingRow = allInspectionRows.find(row => row.get('id') === inspectionId);

    if (existingRow) {
        Object.keys(mainInspectionData).forEach(key => {
            existingRow.set(key, mainInspectionData[key as keyof typeof mainInspectionData]);
        });
        await existingRow.save({ raw: false, valueInputOption: 'USER_ENTERED' });
    } else {
        await inspectionsSheet.addRow(mainInspectionData, { raw: false, valueInputOption: 'USER_ENTERED' });
    }
    
    const detailPayload = [];
    for (const category of categories) {
        if (category.uwagi) {
             detailPayload.push({
                id: `detail-${Date.now()}-${Math.random()}`,
                inspectionId: inspectionId,
                addressName: inspectionData.addressName,
                date: inspectionData.date.toISOString(),
                coordinatorName: inspectionData.coordinatorName,
                category: category.name,
                itemLabel: '', itemValue: '', photoData: '',
                uwagi: category.uwagi,
            });
        }
        for (const item of category.items) {
             detailPayload.push({
                id: `detail-${Date.now()}-${Math.random()}`,
                inspectionId: inspectionId,
                addressName: inspectionData.addressName,
                date: inspectionData.date.toISOString(),
                coordinatorName: inspectionData.coordinatorName,
                category: category.name,
                itemLabel: item.label,
                itemValue: serializeRaw(item.value),
                uwagi: '', photoData: '',
            });
        }
        if (category.photos) {
            for (const photo of category.photos) {
                 detailPayload.push({
                    id: `detail-${Date.now()}-${Math.random()}`,
                    inspectionId: inspectionId,
                    addressName: inspectionData.addressName,
                    date: inspectionData.date.toISOString(),
                    coordinatorName: inspectionData.coordinatorName,
                    category: category.name,
                    itemLabel: 'Photo',
                    itemValue: '',
                    uwagi: '',
                    photoData: photo
                });
            }
        }
    }
    if (detailPayload.length > 0) {
        await detailsSheet.addRows(detailPayload, { raw: false, valueInputOption: 'USER_ENTERED' });
    }
}

export async function addInspection(inspectionData: Omit<Inspection, 'id'>): Promise<void> {
    try {
        await saveInspectionData(inspectionData);
    } catch (error) {
        console.error("Error in addInspection:", error);
        throw error;
    }
}

export async function updateInspection(id: string, inspectionData: Omit<Inspection, 'id'>): Promise<void> {
    try {
        await saveInspectionData(inspectionData, id);
    } catch (error) {
        console.error("Error in updateInspection:", error);
        throw error;
    }
}

export async function deleteInspection(id: string): Promise<void> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, INSPECTION_HEADERS);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, INSPECTION_DETAILS_HEADERS);

        const allInspectionRows = await inspectionsSheet.getRows();
        const allDetailRows = await detailsSheet.getRows();
        
        const inspectionRowToDelete = allInspectionRows.find(r => r.get('id') === id);
        if (inspectionRowToDelete) {
             await inspectionRowToDelete.delete();
        }

        const detailsToDelete = allDetailRows.filter(r => r.get('inspectionId') === id);
        for (const row of detailsToDelete) {
            await row.delete();
        }

    } catch (error) {
        console.error("Error in deleteInspection:", error);
        throw new Error(`Could not delete inspection. ${error instanceof Error ? error.message : ''}`);
    }
}

export async function transferEmployees(fromCoordinatorId: string, toCoordinatorId: string, actor: Coordinator): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        
        const employeesToTransfer = rows.filter(row => row.get('coordinatorId') === fromCoordinatorId);

        if (employeesToTransfer.length === 0) {
            throw new Error("No employees to transfer.");
        }

        for (const row of employeesToTransfer) {
            row.set('coordinatorId', toCoordinatorId);
            await row.save({ raw: false, valueInputOption: 'USER_ENTERED' });
        }

        const settings = await getSettings();
        const fromCoordinator = settings.coordinators.find(c => c.uid === fromCoordinatorId);
        const toCoordinator = settings.coordinators.find(c => c.uid === toCoordinatorId);
        
        const message = `${actor.name} przeniósł ${employeesToTransfer.length} pracowników od ${fromCoordinator?.name || fromCoordinatorId} do ${toCoordinator?.name || toCoordinatorId}.`;
        
        const notificationSheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const newNotification = {
            id: `notif-${Date.now()}`,
            message,
            employeeId: '',
            employeeName: '',
            coordinatorId: actor.uid,
            coordinatorName: actor.name,
            createdAt: new Date().toISOString(),
            isRead: 'FALSE',
            changes: '[]',
        };
        await notificationSheet.addRow(newNotification as any, { raw: false, valueInputOption: 'USER_ENTERED' });

    } catch (error) {
        console.error("Error transferring employees:", error);
        throw new Error(`Could not transfer employees. ${error instanceof Error ? error.message : ''}`);
    }
}


const parseExcelDate = (excelDate: any): string | null => {
    if (excelDate === null || excelDate === undefined || excelDate === '') return null;

    // Case 1: It's already a JS Date object from xlsx parsing
    if (excelDate instanceof Date) {
        if (isValid(excelDate)) {
            // Correctly format to YYYY-MM-DD, ignoring timezone
            const year = excelDate.getFullYear();
            const month = String(excelDate.getMonth() + 1).padStart(2, '0');
            const day = String(excelDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return null;
    }

    // Case 2: It's a number (Excel's date serial number)
    if (typeof excelDate === 'number') {
        // This formula converts Excel's serial date number to a JS Date.
        // It correctly handles the 1900 leap year bug in Excel.
        const jsDate = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
        if (isValid(jsDate)) {
            const year = jsDate.getFullYear();
            const month = String(jsDate.getMonth() + 1).padStart(2, '0');
            const day = String(jsDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return null;
    }

    // Case 3: It's a string, try to parse it
    if (typeof excelDate === 'string') {
        const trimmedDate = excelDate.trim();
        // Try parsing different common formats
        const formats = ['dd.MM.yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'];
        for (const fmt of formats) {
            const parsedDate = parse(trimmedDate, fmt, new Date());
            if (isValid(parsedDate)) {
                return format(parsedDate, 'yyyy-MM-dd');
            }
        }
    }

    // If all else fails, return null
    return null;
}


export async function bulkImportEmployees(
    fileData: ArrayBuffer,
    coordinators: Coordinator[],
    actor: Coordinator
): Promise<{ success: boolean, message: string }> {
    let importedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const newEmployees: Omit<Employee, 'id' | 'status'>[] = [];
    
    try {
        const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1, defval: null });
        
        if (data.length < 2) {
          return { success: false, message: "Plik Excel jest pusty lub zawiera tylko nagłówek."};
        }
        
        const headers = data[0] as string[];
        const rows = data.slice(1);

        const requiredHeaders = ['fullName', 'coordinatorName', 'nationality', 'gender', 'address', 'roomNumber', 'zaklad', 'checkInDate'];
        for(const header of requiredHeaders) {
            if (!headers.includes(header)) {
                throw new Error(`Brak wymaganej kolumny w pliku Excel: ${header}`);
            }
        }

        for (const [index, rowArray] of rows.entries()) {
            const rowNum = index + 2;
            const row: Record<string, any> = {};
            headers.forEach((header, i) => {
                row[header] = (rowArray as any[])[i];
            });

            try {
                const { fullName, coordinatorName, nationality, gender, address, roomNumber, zaklad } = row;

                if (!fullName) continue; // Ignore empty rows

                if (!coordinatorName) throw new Error(`Brak 'coordinatorName' w wierszu ${rowNum}.`);
                if (!nationality) throw new Error(`Brak 'nationality' w wierszu ${rowNum}.`);
                if (!gender) throw new Error(`Brak 'gender' w wierszu ${rowNum}.`);
                if (!address) throw new Error(`Brak 'address' w wierszu ${rowNum}.`);
                if (!roomNumber) throw new Error(`Brak 'roomNumber' w wierszu ${rowNum}.`);
                if (!zaklad) throw new Error(`Brak 'zaklad' w wierszu ${rowNum}.`);
                
                const checkInDate = parseExcelDate(row.checkInDate);
                if (!checkInDate) {
                    throw new Error(`Nieprawidłowa lub pusta 'checkInDate' w wierszu ${rowNum}.`);
                }

                const coordinator = coordinators.find(c => c.name.toLowerCase() === String(coordinatorName).toLowerCase());
                if (!coordinator) {
                    throw new Error(`Koordynator "${coordinatorName}" nie został znaleziony w wierszu ${rowNum}.`);
                }

                const employeeData = {
                    fullName: String(fullName),
                    coordinatorId: coordinator.uid,
                    nationality: String(nationality),
                    gender: String(gender),
                    address: String(address),
                    roomNumber: String(roomNumber),
                    zaklad: String(zaklad),
                    checkInDate: checkInDate,
                    contractStartDate: parseExcelDate(row.contractStartDate),
                    contractEndDate: parseExcelDate(row.contractEndDate),
                    departureReportDate: parseExcelDate(row.departureReportDate),
                    comments: row.comments || '',
                };
                
                newEmployees.push(employeeData);

            } catch (e: any) {
                errorCount++;
                errors.push(e.message);
            }
        }
        
        if (newEmployees.length > 0) {
            const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
            const employeesToSave = newEmployees.map(emp => serializeEmployee({
                ...emp,
                id: `emp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                status: 'active',
            }));
            await sheet.addRows(employeesToSave, { raw: false, valueInputOption: 'USER_ENTERED' });
            importedCount = employeesToSave.length;
        }

        if (importedCount > 0) {
            const notificationSheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
            const message = `${actor.name} zaimportował masowo ${importedCount} nowych pracowników.`;
            const newNotification = {
                id: `notif-${Date.now()}`,
                message,
                employeeId: '',
                employeeName: '',
                coordinatorId: actor.uid,
                coordinatorName: actor.name,
                createdAt: new Date().toISOString(),
                isRead: 'FALSE',
                changes: '[]',
            };
            await notificationSheet.addRow(newNotification as any, { raw: false, valueInputOption: 'USER_ENTERED' });
        }


    } catch(e: any) {
        return { success: false, message: e.message };
    }
    
    if (errorCount > 0) {
        return { 
            success: importedCount > 0, 
            message: `Import zakończony. Zaimportowano: ${importedCount}, Błędy: ${errorCount}.\n\nBłędy:\n- ${errors.join('\n- ')}`
        };
    }
    
    return { success: true, message: `Pomyślnie zaimportowano ${importedCount} pracowników.` };
}

export async function bulkDeleteEmployees(status: 'active' | 'dismissed', actor: Coordinator): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        
        const rowsToKeep = rows.filter(row => row.get('status') !== status || !row.get('id'));
        const numDeleted = rows.length - rowsToKeep.length;

        if (numDeleted === 0) {
            throw new Error(`Brak ${status === 'active' ? 'aktywnych' : 'zwolnionych'} pracowników do usunięcia.`);
        }
        
        await sheet.clearRows();
        if (rowsToKeep.length > 0) {
            await sheet.addRows(rowsToKeep.map(r => r.toObject()), { raw: false, valueInputOption: 'USER_ENTERED' });
        }


        const message = `${actor.name} usunął masowo ${numDeleted} ${status === 'active' ? 'aktywnych' : 'zwolnionych'} pracowników.`;
        
        const notificationSheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const newNotification = {
            id: `notif-${Date.now()}`,
            message,
            employeeId: '',
            employeeName: '',
            coordinatorId: actor.uid,
            coordinatorName: actor.name,
            createdAt: new Date().toISOString(),
            isRead: 'FALSE',
            changes: '[]',
        };
        await notificationSheet.addRow(newNotification as any, { raw: false, valueInputOption: 'USER_ENTERED' });

    } catch (error) {
        console.error(`Error bulk deleting ${status} employees:`, error);
        throw new Error(`Nie udało się usunąć pracowników. ${error instanceof Error ? error.message : ''}`);
    }
}

export async function checkAndUpdateEmployeeStatuses(actor: Coordinator): Promise<{ updated: number }> {
  let updatedCount = 0;
  try {
    const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
    const rows = await sheet.getRows();
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    const updates: Promise<any>[] = [];
    const notificationPromises: Promise<any>[] = [];

    for (const row of rows) {
      const status = row.get('status');
      const contractEndDateStr = row.get('contractEndDate');
      
      if (status === 'active' && contractEndDateStr) {
        const contractEndDate = parse(contractEndDateStr, 'yyyy-MM-dd', new Date());
        if (isValid(contractEndDate) && isPast(contractEndDate)) {
          const employeeId = row.get('id');
          const employeeName = row.get('fullName');
          row.set('status', 'dismissed');
          row.set('checkOutDate', format(today, 'yyyy-MM-dd'));
          updates.push(row.save({ raw: false, valueInputOption: 'USER_ENTERED' }));
          
          notificationPromises.push(createNotification(
            actor, 
            'automatycznie zmienił status na "Zwolniony" dla', 
            { id: employeeId, fullName: employeeName },
            [{ field: 'Status', oldValue: 'active', newValue: 'dismissed'}]
          ));

          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await Promise.all([...updates, ...notificationPromises]);
    }
     return { updated: updatedCount };
  } catch (error) {
    console.error("Error updating employee statuses:", error);
    throw new Error("Could not update statuses.");
  }
}

    