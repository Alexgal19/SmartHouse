
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
        } else if (typeof value === 'boolean') {
            serialized[key] = String(value).toUpperCase();
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

export async function getAllEmployees(): Promise<Employee[]> {
    try {
        const employees = await getEmployeesFromSheet();
        return employees;
    } catch (error) {
        console.error("Error in getAllEmployees (actions):", error);
        throw new Error(`Could not fetch all employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function getNonEmployees(): Promise<NonEmployee[]> {
  try {
     const nonEmployees = await getNonEmployeesFromSheet();
     return nonEmployees;
  } catch (error) {
    console.error("Error in getNonEmployees (actions):", error);
    // Return empty array on any other error to keep the app running
    return [];
  }
}

export async function getSettings(): Promise<Settings> {
    try {
        const settings = await getSettingsFromSheet();
        return settings;
    } catch (error) {
        console.error("Error in getSettings (actions):", error);
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

        await sheet.addRow(serializeNotification(newNotification), { raw: false, insert: true, valueInputOption: 'USER_ENTERED' });
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
            checkInDate: employeeData.checkInDate || '',
            checkOutDate: employeeData.checkOutDate,
            contractStartDate: employeeData.contractStartDate,
            contractEndDate: employeeData.contractEndDate,
            departureReportDate: employeeData.departureReportDate,
            comments: employeeData.comments || '',
            oldAddress: employeeData.oldAddress || undefined,
        };

        const serialized = serializeEmployee(newEmployee);
        await sheet.addRow(serialized, { raw: false, insert: true, valueInputOption: 'USER_ENTERED' });
        
        await createNotification(actor, 'dodał', newEmployee);
        
        return newEmployee;
    } catch (e) {
        if (e instanceof Error) {
            console.error("Error adding employee:", e.stack);
            throw new Error(`Could not add employee: ${e.message}`);
        }
        throw new Error('Could not add employee due to an unknown error.');
    }
}


export async function updateEmployee(employeeId: string, updates: Partial<Employee>, actor: Coordinator): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(row => row.get('id') === employeeId);

        if (rowIndex === -1) {
            throw new Error('Employee not found');
        }

        const row = rows[rowIndex];
        const originalEmployee = deserializeEmployee(row);

        if (!originalEmployee) {
            throw new Error('Could not deserialize original employee data.');
        }
        
        const changes: NotificationChange[] = [];
        for (const key in updates) {
            const typedKey = key as keyof Employee;
            const oldValue = originalEmployee[typedKey];
            const newValue = updates[typedKey];
            
            const areDates = ['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate'].includes(key);

            let oldValStr, newValStr;

            if(areDates) {
                oldValStr = oldValue ? format(new Date(oldValue as string), 'dd-MM-yyyy') : 'Brak';
                newValStr = newValue ? format(new Date(newValue as string), 'dd-MM-yyyy') : 'Brak';
            } else {
                 oldValStr = String(oldValue);
                 newValStr = String(newValue);
            }
           
            if (oldValStr !== newValStr) {
                changes.push({ field: typedKey, oldValue: oldValStr, newValue: newValStr });
            }

            row.set(key, serializeEmployee({ [key]: newValue })[key]);
        }

        await row.save();
        
        if (changes.length > 0) {
            await createNotification(actor, 'zaktualizował', originalEmployee, changes);
        }

    } catch (e) {
        if (e instanceof Error) {
            console.error("Error updating employee:", e.stack);
            throw new Error(`Could not update employee: ${e.message}`);
        }
        throw new Error('Could not update employee due to an unknown error.');
    }
}

export async function addNonEmployee(nonEmployeeData: Omit<NonEmployee, 'id'>): Promise<NonEmployee> {
    try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const newNonEmployee: NonEmployee = {
            ...nonEmployeeData,
            id: `nonemp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            checkInDate: nonEmployeeData.checkInDate || '',
            checkOutDate: nonEmployeeData.checkOutDate,
            comments: nonEmployeeData.comments || '',
        };

        const serialized = serializeNonEmployee(newNonEmployee);
        await sheet.addRow(serialized, { raw: false, insert: true, valueInputOption: 'USER_ENTERED' });
        
        return newNonEmployee;
    } catch (e) {
        if (e instanceof Error) {
            console.error("Error adding non-employee:", e.stack);
            throw new Error(`Could not add non-employee: ${e.message}`);
        }
        throw new Error('Could not add non-employee due to an unknown error.');
    }
}

export async function updateNonEmployee(id: string, updates: Partial<NonEmployee>): Promise<void> {
     try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(row => row.get('id') === id);

        if (rowIndex === -1) {
            throw new Error('Non-employee not found');
        }

        const row = rows[rowIndex];
        
        for (const key in updates) {
            row.set(key, serializeNonEmployee({ [key]: updates[key as keyof NonEmployee] })[key]);
        }
        await row.save();

    } catch (e) {
        if (e instanceof Error) {
            console.error("Error updating non-employee:", e.stack);
            throw new Error(`Could not update non-employee: ${e.message}`);
        }
        throw new Error('Could not update non-employee due to an unknown error.');
    }
}

export async function deleteNonEmployee(id: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const row = rows.find(row => row.get('id') === id);
        if (row) {
            await row.delete();
        } else {
            throw new Error('Non-employee not found');
        }
    } catch (e) {
        if (e instanceof Error) {
            throw new Error(`Could not delete non-employee: ${e.message}`);
        }
        throw new Error('Could not delete non-employee.');
    }
}


export async function bulkDeleteEmployees(status: 'active' | 'dismissed', actor: Coordinator): Promise<void> {
     if (!actor.isAdmin) {
        throw new Error("Only admins can bulk delete employees.");
    }
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowsToDelete = rows.filter(row => row.get('status') === status);
        
        if (rowsToDelete.length === 0) {
            return;
        }

        // Deleting rows one by one from the end to avoid shifting indices
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            await rowsToDelete[i].delete();
        }
    } catch (e) {
        if (e instanceof Error) {
            throw new Error(`Could not bulk delete employees: ${e.message}`);
        }
        throw new Error('Could not bulk delete employees.');
    }
}

export async function transferEmployees(fromCoordinatorId: string, toCoordinatorId: string, actor: Coordinator): Promise<void> {
    if (!actor.isAdmin) {
        throw new Error("Only admins can transfer employees.");
    }
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowsToTransfer = rows.filter(row => row.get('coordinatorId') === fromCoordinatorId);

        if (rowsToTransfer.length === 0) {
            return;
        }

        const { coordinators } = await getSettingsFromSheet();
        const toCoordinator = coordinators.find(c => c.uid === toCoordinatorId);
        if (!toCoordinator) {
            throw new Error("Target coordinator not found.");
        }

        for (const row of rowsToTransfer) {
            row.set('coordinatorId', toCoordinatorId);
            await row.save();
        }
    } catch (e) {
        if (e instanceof Error) {
            throw new Error(`Could not transfer employees: ${e.message}`);
        }
        throw new Error('Could not transfer employees.');
    }
}

export async function checkAndUpdateEmployeeStatuses(actor: Coordinator): Promise<{ updated: number }> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let updatedCount = 0;

        for (const row of rows) {
            const status = row.get('status');
            const contractEndDateString = row.get('contractEndDate');

            if (status === 'active' && contractEndDateString) {
                const contractEndDate = new Date(contractEndDateString);
                if (isValid(contractEndDate) && isPast(contractEndDate)) {
                    row.set('status', 'dismissed');
                    row.set('checkOutDate', format(contractEndDate, 'yyyy-MM-dd'));
                    await row.save();
                    updatedCount++;

                    const originalEmployee = deserializeEmployee(row);
                    if (originalEmployee) {
                       await createNotification(actor, 'automatycznie zwolnił', originalEmployee, [
                           { field: 'status', oldValue: 'active', newValue: 'dismissed' }
                       ]);
                    }
                }
            }
        }
        return { updated: updatedCount };
    } catch (e) {
         if (e instanceof Error) {
            throw new Error(`Could not update statuses: ${e.message}`);
        }
        throw new Error('Could not update statuses.');
    }
}

export async function updateSettings(newSettings: Partial<Settings>): Promise<void> {
    const updateSimpleList = async (sheetName: string, items: string[]) => {
        const sheet = await getSheet(sheetName, ['name']);
        await sheet.clearRows();
        if (items.length > 0) {
            await sheet.addRows(items.map(name => ({ name })), { raw: false, insert: true });
        }
    };
    
    try {
        if (newSettings.nationalities) {
            await updateSimpleList(SHEET_NAME_NATIONALITIES, newSettings.nationalities);
        }
        if (newSettings.departments) {
            await updateSimpleList(SHEET_NAME_DEPARTMENTS, newSettings.departments);
        }
        if (newSettings.genders) {
            await updateSimpleList(SHEET_NAME_GENDERS, newSettings.genders);
        }
        if (newSettings.addresses) {
            const addressesSheet = await getSheet(SHEET_NAME_ADDRESSES, ['id', 'name']);
            const roomsSheet = await getSheet(SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity']);
            
            await addressesSheet.clearRows();
            await roomsSheet.clearRows();

            const allRooms: (Room & {addressId: string})[] = [];
            const addressesData = newSettings.addresses.map(addr => {
                addr.rooms.forEach(room => {
                    allRooms.push({ ...room, addressId: addr.id });
                });
                return { id: addr.id, name: addr.name };
            });

            if (addressesData.length > 0) {
                await addressesSheet.addRows(addressesData, { raw: false, insert: true });
            }
            if (allRooms.length > 0) {
                 await roomsSheet.addRows(allRooms.map(r => ({...r, capacity: r.capacity.toString()})), { raw: false, insert: true });
            }
        }
        if (newSettings.coordinators) {
             const sheet = await getSheet(SHEET_NAME_COORDINATORS, COORDINATOR_HEADERS);
             await sheet.clearRows();
             if (newSettings.coordinators.length > 0) {
                await sheet.addRows(newSettings.coordinators.map(c => ({
                    ...c,
                    isAdmin: String(c.isAdmin).toUpperCase()
                })), { raw: false, insert: true });
             }
        }
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Could not update settings: ${error.message}`);
        }
        throw new Error('An unknown error occurred while updating settings.');
    }
}


export async function getNotifications(): Promise<Notification[]> {
    try {
        const notifications = await getNotificationsFromSheet();
        return notifications;
    } catch (error) {
         console.error("Error in getNotifications (actions):", error);
        throw new Error(`Could not fetch notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const rows = await sheet.getRows();
        const row = rows.find(r => r.get('id') === notificationId);
        if (row) {
            row.set('isRead', 'TRUE');
            await row.save();
        }
    } catch (e) {
        console.error("Could not mark notification as read:", e);
    }
}

export async function clearAllNotifications(): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        await sheet.clearRows();
    } catch (e) {
         if (e instanceof Error) {
            throw new Error(`Could not clear notifications: ${e.message}`);
        }
        throw new Error('An unknown error occurred while clearing notifications.');
    }
}


export async function getInspections(): Promise<Inspection[]> {
    try {
        const inspections = await getInspectionsFromSheet();
        return inspections;
    } catch (error) {
         console.error("Error in getInspections (actions):", error);
        throw new Error(`Could not fetch inspections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function addInspection(inspectionData: Omit<Inspection, 'id'>): Promise<string> {
    const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id', 'addressId', 'addressName', 'date', 'coordinatorId', 'coordinatorName', 'standard']);
    const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['id', 'inspectionId', 'addressName', 'date', 'coordinatorName', 'category', 'itemLabel', 'itemValue', 'uwagi', 'photoData']);
    
    const inspectionId = `insp-${Date.now()}`;
    const dateString = inspectionData.date.toISOString();

    await inspectionsSheet.addRow({
        id: inspectionId,
        addressId: inspectionData.addressId,
        addressName: inspectionData.addressName,
        date: dateString,
        coordinatorId: inspectionData.coordinatorId,
        coordinatorName: inspectionData.coordinatorName,
        standard: inspectionData.standard || '',
    }, { raw: false, insert: true });

    const detailRows: any[] = [];
    inspectionData.categories.forEach(category => {
        category.items.forEach(item => {
             detailRows.push({
                id: `insp-det-${Date.now()}-${Math.random()}`,
                inspectionId,
                addressName: inspectionData.addressName,
                date: dateString,
                coordinatorName: inspectionData.coordinatorName,
                category: category.name,
                itemLabel: item.label,
                itemValue: Array.isArray(item.value) ? JSON.stringify(item.value) : (item.value?.toString() ?? ''),
                uwagi: '',
                photoData: '',
            });
        });

        if (category.uwagi) {
             detailRows.push({
                id: `insp-det-${Date.now()}-${Math.random()}`,
                inspectionId,
                addressName: inspectionData.addressName,
                date: dateString,
                coordinatorName: inspectionData.coordinatorName,
                category: category.name,
                itemLabel: 'Uwagi', itemValue: '',
                uwagi: category.uwagi,
                photoData: '',
             });
        }
        
        (category.photos || []).forEach(photo => {
             detailRows.push({
                id: `insp-det-${Date.now()}-${Math.random()}`,
                inspectionId,
                addressName: inspectionData.addressName,
                date: dateString,
                coordinatorName: inspectionData.coordinatorName,
                category: category.name,
                itemLabel: 'Photo', itemValue: '', uwagi: '',
                photoData: photo,
             });
        })
    });
    
    if (detailRows.length > 0) {
        await detailsSheet.addRows(detailRows, { raw: false, insert: true });
    }
    
    return inspectionId;
}

export async function updateInspection(id: string, inspectionData: Omit<Inspection, 'id'>): Promise<void> {
    const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id', 'addressId', 'addressName', 'date', 'coordinatorId', 'coordinatorName', 'standard']);
    const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['id', 'inspectionId', 'addressName', 'date', 'coordinatorName', 'category', 'itemLabel', 'itemValue', 'uwagi', 'photoData']);
    
    // Update main inspection row
    const inspectionRows = await inspectionsSheet.getRows();
    const inspectionRow = inspectionRows.find(r => r.get('id') === id);
    if (!inspectionRow) throw new Error("Inspection not found");
    
    const dateString = inspectionData.date.toISOString();
    inspectionRow.set('addressId', inspectionData.addressId);
    inspectionRow.set('addressName', inspectionData.addressName);
    inspectionRow.set('date', dateString);
    inspectionRow.set('coordinatorId', inspectionData.coordinatorId);
    inspectionRow.set('coordinatorName', inspectionData.coordinatorName);
    inspectionRow.set('standard', inspectionData.standard || '');
    await inspectionRow.save();

    // Delete old details
    const detailRows = await detailsSheet.getRows();
    const oldDetailRows = detailRows.filter(r => r.get('inspectionId') === id);
    for (let i = oldDetailRows.length - 1; i >= 0; i--) {
        await oldDetailRows[i].delete();
    }

    // Add new details
    const newDetailRows: any[] = [];
    inspectionData.categories.forEach(category => {
        category.items.forEach(item => {
             newDetailRows.push({
                id: `insp-det-${Date.now()}-${Math.random()}`,
                inspectionId: id,
                addressName: inspectionData.addressName,
                date: dateString,
                coordinatorName: inspectionData.coordinatorName,
                category: category.name,
                itemLabel: item.label,
                itemValue: Array.isArray(item.value) ? JSON.stringify(item.value) : (item.value?.toString() ?? ''),
                uwagi: '',
                photoData: '',
            });
        });

        if (category.uwagi) {
             newDetailRows.push({
                id: `insp-det-${Date.now()}-${Math.random()}`,
                inspectionId: id,
                addressName: inspectionData.addressName,
                date: dateString,
                coordinatorName: inspectionData.coordinatorName,
                category: category.name,
                itemLabel: 'Uwagi', itemValue: '',
                uwagi: category.uwagi,
                photoData: '',
             });
        }
        
        (category.photos || []).forEach(photo => {
             newDetailRows.push({
                id: `insp-det-${Date.now()}-${Math.random()}`,
                inspectionId: id,
                addressName: inspectionData.addressName,
                date: dateString,
                coordinatorName: inspectionData.coordinatorName,
                category: category.name,
                itemLabel: 'Photo', itemValue: '', uwagi: '',
                photoData: photo,
             });
        })
    });

     if (newDetailRows.length > 0) {
        await detailsSheet.addRows(newDetailRows, { raw: false, insert: true });
    }
}

export async function deleteInspection(id: string): Promise<void> {
    const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id']);
    const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['inspectionId']);

    const inspectionRows = await inspectionsSheet.getRows();
    const inspectionRow = inspectionRows.find(r => r.get('id') === id);
    if (inspectionRow) {
        await inspectionRow.delete();
    }

    const detailRows = await detailsSheet.getRows();
    const oldDetailRows = detailRows.filter(r => r.get('inspectionId') === id);
     for (let i = oldDetailRows.length - 1; i >= 0; i--) {
        await oldDetailRows[i].delete();
    }
}

export async function bulkImportEmployees(fileData: ArrayBuffer, coordinators: Coordinator[], actor: Coordinator): Promise<{success: boolean, message: string}> {
    if (!actor.isAdmin) {
        return { success: false, message: "Brak uprawnień do importu." };
    }
    
    try {
        const workbook = XLSX.read(fileData, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const requiredHeaders = ['fullName', 'coordinatorName', 'nationality', 'gender', 'address', 'roomNumber', 'zaklad', 'checkInDate'];
        const headers = Object.keys(json[0] || {});
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            return { success: false, message: `Brakujące kolumny w pliku: ${missingHeaders.join(', ')}` };
        }
        
        const employeesToAdd: (Omit<Employee, 'id' | 'status'>)[] = [];
        
        for (const row of json) {
            const coordinator = coordinators.find(c => c.name.toLowerCase() === String(row.coordinatorName).toLowerCase());
            if (!coordinator) {
                console.warn(`Koordynator "${row.coordinatorName}" nie znaleziony, pomijanie pracownika ${row.fullName}.`);
                continue; // Skip if coordinator not found
            }

            let checkInDate;
            if (typeof row.checkInDate === 'number') {
                checkInDate = format(XLSX.SSF.parse_date_code(row.checkInDate), 'yyyy-MM-dd');
            } else if (typeof row.checkInDate === 'string') {
                 const parsedDate = parse(row.checkInDate, 'dd-MM-yyyy', new Date());
                if (isValid(parsedDate)) {
                    checkInDate = format(parsedDate, 'yyyy-MM-dd');
                } else {
                     checkInDate = row.checkInDate; // assume it's yyyy-mm-dd
                }
            }
             if (!checkInDate || !isValid(new Date(checkInDate))) {
                console.warn(`Nieprawidłowa data zameldowania dla ${row.fullName}, pomijanie.`);
                continue;
            }

            const employee: Omit<Employee, 'id' | 'status'> = {
                fullName: String(row.fullName),
                coordinatorId: coordinator.uid,
                nationality: String(row.nationality),
                gender: String(row.gender),
                address: String(row.address),
                roomNumber: String(row.roomNumber),
                zaklad: String(row.zaklad),
                checkInDate,
                checkOutDate: null,
            };
            employeesToAdd.push(employee);
        }
        
        // Add employees to sheet
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const newRows = employeesToAdd.map(emp => serializeEmployee({ ...emp, id: `emp-${Date.now()}-${Math.random()}`, status: 'active' }));
        await sheet.addRows(newRows, { raw: false, insert: true, valueInputOption: 'USER_ENTERED' });

        return { success: true, message: `Pomyślnie zaimportowano ${employeesToAdd.length} pracowników.` };

    } catch (e: any) {
         return { success: false, message: e.message || "Wystąpił nieznany błąd podczas przetwarzania pliku." };
    }
}
function deserializeEmployee(row: any): Employee | null {
    const id = row.get('id');
    if (!id) return null;

    const checkInDate = row.get('checkInDate') ? format(new Date(row.get('checkInDate')), 'yyyy-MM-dd') : null;

    if (!checkInDate) return null;

    const deductionReasonRaw = row.get('deductionReason');
    let deductionReason: DeductionReason[] | undefined = undefined;
    if (deductionReasonRaw && typeof deductionReasonRaw === 'string') {
        try {
            const parsed = JSON.parse(deductionReasonRaw);
            if(Array.isArray(parsed)) {
                deductionReason = parsed;
            }
        } catch(e) {
            // Ignore parse error
        }
    }

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
        checkOutDate: row.get('checkOutDate') ? format(new Date(row.get('checkOutDate')), 'yyyy-MM-dd') : null,
        contractStartDate: row.get('contractStartDate') ? format(new Date(row.get('contractStartDate')), 'yyyy-MM-dd') : null,
        contractEndDate: row.get('contractEndDate') ? format(new Date(row.get('contractEndDate')), 'yyyy-MM-dd') : null,
        departureReportDate: row.get('departureReportDate') ? format(new Date(row.get('departureReportDate')), 'yyyy-MM-dd') : null,
        comments: row.get('comments') || '',
        status: row.get('status') as 'active' | 'dismissed' || 'active',
        oldAddress: row.get('oldAddress') || undefined,
        depositReturned: row.get('depositReturned') as Employee['depositReturned'] || null,
        depositReturnAmount: row.get('depositReturnAmount') ? parseFloat(row.get('depositReturnAmount')) : null,
        deductionRegulation: row.get('deductionRegulation') ? parseFloat(row.get('deductionRegulation')) : null,
        deductionNo4Months: row.get('deductionNo4Months') ? parseFloat(row.get('deductionNo4Months')) : null,
        deductionNo30Days: row.get('deductionNo30Days') ? parseFloat(row.get('deductionNo30Days')) : null,
        deductionReason: deductionReason,
    };
}

    