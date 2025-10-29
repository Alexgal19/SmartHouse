
"use server";

import type { Employee, Settings, Notification, NotificationChange, Room, NonEmployee, DeductionReason, EquipmentItem, Inspection, InspectionCategory, Coordinator } from '../types';
import { getSheet } from './sheets';
import { getAllSheetsData } from './sheets';
import { format, isPast, isValid, getDaysInMonth, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

const SHEET_NAME_EMPLOYEES = 'Employees';
const SHEET_NAME_NON_EMPLOYEES = 'NonEmployees';
const SHEET_NAME_NOTIFICATIONS = 'Powiadomienia';
const SHEET_NAME_AUDIT_LOG = 'AuditLog';
const SHEET_NAME_ADDRESSES = 'Addresses';
const SHEET_NAME_ROOMS = 'Rooms';
const SHEET_NAME_NATIONALITIES = 'Nationalities';
const SHEET_NAME_DEPARTMENTS = 'Departments';
const SHEET_NAME_COORDINATORS = 'Coordinators';
const SHEET_NAME_GENDERS = 'Genders';
const SHEET_NAME_EQUIPMENT = 'Equipment';
const SHEET_NAME_INSPECTIONS = 'Inspections';
const SHEET_NAME_INSPECTION_DETAILS = 'InspectionDetails';


const serializeDate = (date?: string | null): string => {
    if (!date) {
        return '';
    }
    const d = new Date(date);
    if (!isValid(d)) {
        return '';
    }
    return date; 
};

const EMPLOYEE_HEADERS = [
    'id', 'fullName', 'coordinatorId', 'nationality', 'gender', 'address', 'roomNumber', 
    'zaklad', 'checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 
    'departureReportDate', 'comments', 'status', 'oldAddress', 'addressChangeDate',
    'depositReturned', 'depositReturnAmount', 'deductionRegulation', 'deductionNo4Months', 'deductionNo30Days', 'deductionReason'
];

const serializeEmployee = (employee: Partial<Employee>): Record<string, string | number | boolean> => {
    const serialized: Record<string, string | number | boolean> = {};

    for (const key of EMPLOYEE_HEADERS) {
        const typedKey = key as keyof Employee;
        const value = employee[typedKey];
        
        if (value === undefined || value === null) {
            serialized[key] = '';
            continue;
        }

        if (['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate', 'addressChangeDate'].includes(key)) {
            serialized[key] = serializeDate(value as string);
        } else if (key === 'deductionReason') {
            serialized[key] = Array.isArray(value) ? JSON.stringify(value) : '';
        } else if (typeof value === 'boolean') {
            serialized[key] = String(value).toUpperCase();
        } else {
            serialized[key] = String(value);
        }
    }

    return serialized;
};


const serializeNonEmployee = (nonEmployee: Partial<NonEmployee>): Record<string, string | number | boolean> => {
    const serialized: Record<string, string> = {};
    for (const [key, value] of Object.entries(nonEmployee)) {
        if (['checkInDate', 'checkOutDate'].includes(key)) {
            serialized[key] = serializeDate(value as string);
        } else if (value !== null && value !== undefined) {
            serialized[key] = String(value);
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
        createdAt: notification.createdAt,
        isRead: String(notification.isRead).toUpperCase(),
        changes: JSON.stringify(notification.changes || []),
    };
};

const serializeEquipment = (item: Partial<EquipmentItem>): Record<string, string | number> => {
    return {
        id: item.id || '',
        inventoryNumber: item.inventoryNumber || '',
        name: item.name || '',
        quantity: item.quantity || 0,
        description: item.description || '',
        addressId: item.addressId || '',
        addressName: item.addressName || '',
    };
};

const NON_EMPLOYEE_HEADERS = [
    'id', 'fullName', 'address', 'roomNumber', 'checkInDate', 'checkOutDate', 'comments'
];

const EQUIPMENT_HEADERS = [
    'id', 'inventoryNumber', 'name', 'quantity', 'description', 'addressId', 'addressName'
];

const COORDINATOR_HEADERS = ['uid', 'name', 'isAdmin', 'password'];
const ADDRESS_HEADERS = ['id', 'name', 'coordinatorId'];
const AUDIT_LOG_HEADERS = ['timestamp', 'actorId', 'actorName', 'action', 'targetType', 'targetId', 'details'];

const safeFormat = (dateStr: unknown): string | null => {
    if (dateStr === null || dateStr === undefined || dateStr === '') return null;
    
    // Handle Excel's numeric date format
    if (typeof dateStr === 'number' && dateStr > 0) {
        // Excel's epoch starts on 1900-01-01, but it has a bug treating 1900 as a leap year.
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
        if (isValid(date)) {
            return format(date, 'yyyy-MM-dd');
        }
    }

    const date = new Date(dateStr as string | number);
    if (!isValid(date)) return null;
    try {
        return format(date, 'yyyy-MM-dd');
    } catch {
        return null;
    }
};

const deserializeEmployee = (row: Record<string, unknown>): Employee | null => {
    const plainObject = row;
    
    const id = String(plainObject.id || '');
    if (!id) return null;

    const checkInDate = safeFormat(plainObject.checkInDate);
    // checkInDate is not strictly mandatory here for deserialization, but good to have
    // if (!checkInDate) return null; 

    let deductionReason: DeductionReason[] | undefined;
    if (plainObject.deductionReason && typeof plainObject.deductionReason === 'string') {
        try {
            const parsed = JSON.parse(plainObject.deductionReason);
            if(Array.isArray(parsed)) deductionReason = parsed;
        } catch(e) {
            console.warn(`Could not parse deductionReason for employee ${id}:`, e);
        }
    }
    
    const validDepositValues: Employee['depositReturned'][] = ['Tak', 'Nie', 'Nie dotyczy'];
    const depositReturnedValue = String(plainObject.depositReturned || '');
    const depositReturned = validDepositValues.includes(depositReturnedValue as Employee['depositReturned']) ? depositReturnedValue as Employee['depositReturned'] : null;

    const newEmployee: Employee = {
        id: id,
        fullName: String(plainObject.fullName || ''),
        coordinatorId: String(plainObject.coordinatorId || ''),
        nationality: String(plainObject.nationality || ''),
        gender: String(plainObject.gender || ''),
        address: String(plainObject.address || ''),
        roomNumber: String(plainObject.roomNumber || ''),
        zaklad: (plainObject.zaklad as string | null) || null,
        checkInDate: checkInDate,
        checkOutDate: safeFormat(plainObject.checkOutDate),
        contractStartDate: safeFormat(plainObject.contractStartDate),
        contractEndDate: safeFormat(plainObject.contractEndDate),
        departureReportDate: safeFormat(plainObject.departureReportDate),
        comments: String(plainObject.comments || ''),
        status: String(plainObject.status) === 'dismissed' ? 'dismissed' : 'active',
        oldAddress: plainObject.oldAddress ? String(plainObject.oldAddress) : undefined,
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

const writeToAuditLog = async (actorId: string, actorName: string, action: string, targetType: string, targetId: string, details: unknown) => {
    try {
        const sheet = await getSheet(SHEET_NAME_AUDIT_LOG, AUDIT_LOG_HEADERS);
        await sheet.addRow({
            timestamp: new Date().toISOString(),
            actorId,
            actorName,
            action,
            targetType,
            targetId,
            details: JSON.stringify(details),
        }, { raw: false, insert: true });
    } catch (e: unknown) {
        console.error("Failed to write to audit log:", e instanceof Error ? e.message : "Unknown error");
    }
};

const createNotification = async (
    actorUid: string,
    action: string,
    employee: { id: string, fullName: string },
    changes: NotificationChange[] = []
) => {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const coordSheet = await getSheet(SHEET_NAME_COORDINATORS, ['uid', 'name']);
        const coordRows = await coordSheet.getRows({ limit: 100 });
        const actor = coordRows.find((r) => r.get('uid') === actorUid)?.toObject();
        
        if (!actor) {
            console.error(`Could not find actor with uid ${actorUid} to create notification.`);
            return;
        }

        const message = `${String(actor.name)} ${action} pracownika ${employee.fullName}.`;
        
        const newNotification: Notification = {
            id: `notif-${Date.now()}`,
            message,
            employeeId: employee.id,
            employeeName: employee.fullName,
            coordinatorId: String(actor.uid || ''),
            coordinatorName: String(actor.name || ''),
            createdAt: new Date().toISOString(),
            isRead: false,
            changes
        };

        await sheet.addRow(serializeNotification(newNotification), { raw: false, insert: true });
        
        await writeToAuditLog(String(actor.uid), String(actor.name), action, 'employee', employee.id, changes);

    } catch (e: unknown) {
        console.error("Could not create notification:", e instanceof Error ? e.message : "Unknown error");
    }
};

export async function addEmployee(employeeData: Partial<Employee>, actorUid: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const newEmployee: Employee = {
            id: `emp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            status: 'active',
            fullName: employeeData.fullName || '',
            coordinatorId: employeeData.coordinatorId || '',
            nationality: employeeData.nationality || '',
            gender: employeeData.gender || '',
            address: employeeData.address || '',
            roomNumber: employeeData.roomNumber || '',
            zaklad: employeeData.zaklad || null,
            checkInDate: employeeData.checkInDate,
            checkOutDate: employeeData.checkOutDate,
            contractStartDate: employeeData.contractStartDate ?? null,
            contractEndDate: employeeData.contractEndDate ?? null,
            departureReportDate: employeeData.departureReportDate,
            comments: employeeData.comments,
            oldAddress: employeeData.oldAddress,
            addressChangeDate: employeeData.addressChangeDate,
            depositReturned: employeeData.depositReturned ?? null,
            depositReturnAmount: employeeData.depositReturnAmount ?? null,
            deductionRegulation: employeeData.deductionRegulation ?? null,
            deductionNo4Months: employeeData.deductionNo4Months ?? null,
            deductionNo30Days: employeeData.deductionNo30Days ?? null,
            deductionReason: employeeData.deductionReason ?? undefined,
        };

        const serialized = serializeEmployee(newEmployee);
        await sheet.addRow(serialized, { raw: false, insert: true });
        
        await createNotification(actorUid, 'dodał', newEmployee);
    } catch (e: unknown) {
        console.error("Error adding employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add employee.");
    }
}


export async function updateEmployee(employeeId: string, updates: Partial<Employee>, actorUid: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 3000 });
        const rowIndex = rows.findIndex((row) => row.get('id') === employeeId);

        if (rowIndex === -1) {
            throw new Error('Employee not found');
        }

        const row = rows[rowIndex];
        const originalEmployee = deserializeEmployee(row.toObject());

        if (!originalEmployee) {
            throw new Error('Could not deserialize original employee data.');
        }
        
        const changes: NotificationChange[] = [];
        const updatedEmployeeData: Employee = { ...originalEmployee, ...updates };

        // Logic to detect changes for notifications
        for (const key of Object.keys(updates) as Array<keyof Employee>) {
            const oldValue = originalEmployee[key];
            const newValue = updates[key];
            
            const normalizedOld = (!oldValue || oldValue === '') ? null : String(oldValue);
            const normalizedNew = (!newValue || newValue === '') ? null : String(newValue);

            if (normalizedOld !== normalizedNew) {
                let oldValStr: string | null = null;
                if (oldValue !== null && oldValue !== undefined) {
                    if (key === 'deductionReason' && Array.isArray(oldValue)) {
                        oldValStr = JSON.stringify(oldValue);
                    } else if (['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate', 'addressChangeDate'].includes(key) && isValid(new Date(oldValue as string))) {
                        oldValStr = format(new Date(oldValue as string), 'dd-MM-yyyy');
                    } else {
                        oldValStr = String(oldValue);
                    }
                }

                let newValStr: string | null = null;
                if (newValue !== null && newValue !== undefined) {
                    if (key === 'deductionReason' && Array.isArray(newValue)) {
                        newValStr = JSON.stringify(newValue);
                    } else if (['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate', 'addressChangeDate'].includes(key) && isValid(new Date(newValue as string))) {
                        newValStr = format(new Date(newValue as string), 'dd-MM-yyyy');
                    } else {
                        newValStr = String(newValue);
                    }
                }
                
                changes.push({ field: key, oldValue: oldValStr || 'Brak', newValue: newValStr || 'Brak' });
            }
        }
        
        const serialized = serializeEmployee(updatedEmployeeData);
        for(const header of EMPLOYEE_HEADERS) {
            row.set(header, serialized[header]);
        }

        await row.save();
        
        if (changes.length > 0) {
            await createNotification(actorUid, 'zaktualizował', originalEmployee, changes);
        }

    } catch (e: unknown) {
        console.error("Error updating employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update employee.");
    }
}

export async function deleteEmployee(employeeId: string, actorUid: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 3000 });
        const row = rows.find((r) => r.get('id') === employeeId);

        if (!row) {
            throw new Error('Employee not found for deletion.');
        }

        const employeeToDelete = deserializeEmployee(row.toObject());

        await row.delete();

        if (employeeToDelete) {
             await createNotification(actorUid, 'trwale usunął', employeeToDelete);
        }

    } catch (e: unknown) {
        console.error("Error deleting employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete employee.");
    }
}

export async function addNonEmployee(nonEmployeeData: Omit<NonEmployee, 'id'>): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const newNonEmployee: NonEmployee = {
            id: `nonemp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            fullName: nonEmployeeData.fullName,
            address: nonEmployeeData.address,
            roomNumber: nonEmployeeData.roomNumber,
            checkInDate: nonEmployeeData.checkInDate || '',
            checkOutDate: nonEmployeeData.checkOutDate,
            comments: nonEmployeeData.comments || '',
        };

        const serialized = serializeNonEmployee(newNonEmployee);
        await sheet.addRow(serialized, { raw: false, insert: true });
    } catch (e: unknown) {
        console.error("Error adding non-employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add non-employee.");
    }
}

export async function updateNonEmployee(id: string, updates: Partial<NonEmployee>): Promise<void> {
     try {
         const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
         const rows = await sheet.getRows({ limit: 1000 });
         const rowIndex = rows.findIndex((row) => row.get('id') === id);

         if (rowIndex === -1) {
             throw new Error('Non-employee not found');
         }

         const row = rows[rowIndex];
         
         for (const key in updates) {
             row.set(key, serializeNonEmployee({ [key]: updates[key as keyof NonEmployee] })[key]);
         }
         await row.save();

     } catch (e: unknown) {
         console.error("Error updating non-employee:", e);
         throw new Error(e instanceof Error ? e.message : "Failed to update non-employee.");
     }
}

export async function deleteNonEmployee(id: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 1000 });
        const row = rows.find((row) => row.get('id') === id);
        if (row) {
            await row.delete();
        } else {
            throw new Error('Non-employee not found');
        }
    } catch (e: unknown) {
        console.error("Error deleting non-employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete non-employee.");
    }
}

export async function addEquipment(itemData: Omit<EquipmentItem, 'id' | 'addressName'>): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EQUIPMENT, EQUIPMENT_HEADERS);
        const { settings } = await getAllSheetsData();
        const addressName = settings.addresses.find((a: { id: any; }) => a.id === itemData.addressId)?.name || 'Nieznany';
        
        const newItem: EquipmentItem = {
            id: `equip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ...itemData,
            addressName
        };
        const serialized = serializeEquipment(newItem);
        await sheet.addRow(serialized, { raw: false, insert: true });
    } catch (e: unknown) {
        console.error("Error adding equipment:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add equipment.");
    }
}

export async function updateEquipment(id: string, updates: Partial<EquipmentItem>): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EQUIPMENT, EQUIPMENT_HEADERS);
        const rows = await sheet.getRows({ limit: 2000 });
        const row = rows.find((r) => r.get('id') === id);
        if (!row) throw new Error("Equipment not found");
        
        for (const key in updates) {
            row.set(key, (updates as Record<string, any>)[key]);
        }
        await row.save();
    } catch (e: unknown) {
        console.error("Error updating equipment:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update equipment.");
    }
}

export async function deleteEquipment(id: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EQUIPMENT, EQUIPMENT_HEADERS);
        const rows = await sheet.getRows({ limit: 2000 });
        const row = rows.find((r) => r.get('id') === id);
        if (row) {
            await row.delete();
        } else {
            throw new Error("Equipment not found");
        }
    } catch (e: unknown) {
        console.error("Error deleting equipment:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete equipment.");
    }
}


export async function bulkDeleteEmployees(status: 'active' | 'dismissed', _actorUid: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 3000 });
        const rowsToDelete = rows.filter((row) => row.get('status') === status);
        
        if (rowsToDelete.length === 0) {
            return;
        }
        
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            await rowsToDelete[i].delete();
        }

    } catch (e: unknown) {
        console.error("Error bulk deleting employees:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to bulk delete employees.");
    }
}

export async function transferEmployees(fromCoordinatorId: string, toCoordinatorId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 3000 });
        const rowsToTransfer = rows.filter((row) => row.get('coordinatorId') === fromCoordinatorId);

        if (rowsToTransfer.length === 0) {
            return;
        }

        const { settings } = await getAllSheetsData();
        const toCoordinator = settings.coordinators.find((c: { uid: string; }) => c.uid === toCoordinatorId);
        if (!toCoordinator) {
            throw new Error("Target coordinator not found.");
        }

        for (const row of rowsToTransfer) {
            row.set('coordinatorId', toCoordinatorId);
        }
        
        const promises = rowsToTransfer.map(row => row.save());
        await Promise.all(promises);

    } catch (e: unknown) {
        console.error("Error transferring employees:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to transfer employees.");
    }
}

export async function checkAndUpdateEmployeeStatuses(actorUid: string): Promise<{ updated: number }> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 3000 });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let updatedCount = 0;
        const rowsToUpdate = [];

        for (const row of rows) {
            const status = String(row.get('status'));
            const checkOutDateString = String(row.get('checkOutDate'));

            if (status === 'active' && checkOutDateString) {
                const checkOutDate = new Date(checkOutDateString);
                if (isValid(checkOutDate) && isPast(checkOutDate)) {
                    row.set('status', 'dismissed');
                    rowsToUpdate.push(row.save()); // Pushing promise to array
                    updatedCount++;

                    const originalEmployee = deserializeEmployee(row.toObject());
                    if (originalEmployee) {
                       await createNotification(actorUid, 'automatycznie zwolnił', originalEmployee, [
                            { field: 'status', oldValue: 'active', newValue: 'dismissed' }
                       ]);
                    }
                }
            }
        }
        
        await Promise.all(rowsToUpdate);

        return { updated: updatedCount };
    } catch (e: unknown) {
        console.error("Error updating statuses:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update statuses.");
    }
}

export async function updateSettings(newSettings: Partial<Omit<Settings, 'temporaryAccess'>>): Promise<void> {
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
            const addressesSheet = await getSheet(SHEET_NAME_ADDRESSES, ADDRESS_HEADERS);
            const roomsSheet = await getSheet(SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity']);
            
            await addressesSheet.clearRows();
            await roomsSheet.clearRows();

            const allRooms: (Room & {addressId: string})[] = [];
            const addressesData = newSettings.addresses.map((addr: { rooms: any[]; id: any; name: any; coordinatorId: any; }) => {
                addr.rooms.forEach(room => {
                    allRooms.push({ ...room, addressId: addr.id });
                });
                return { 
                    id: addr.id, 
                    name: addr.name, 
                    coordinatorId: addr.coordinatorId 
                };
            });

            if (addressesData.length > 0) {
                await addressesSheet.addRows(addressesData, { raw: false, insert: true });
            }
            if (allRooms.length > 0) {
                await roomsSheet.addRows(allRooms.map(r => ({...r, capacity: String(r.capacity)})), { raw: false, insert: true });
            }
        }
        if (newSettings.coordinators) {
             const sheet = await getSheet(SHEET_NAME_COORDINATORS, COORDINATOR_HEADERS);
             const { settings: currentSettings } = await getAllSheetsData();
             const existingPasswords = new Map(currentSettings.coordinators.map(c => [c.uid, c.password]));

             await sheet.clearRows();

             if (newSettings.coordinators.length > 0) {
                 const coordinatorsToSave = newSettings.coordinators.map((c: Coordinator) => {
                     const newPassword = c.password;
                     // If new password is empty or not provided, keep the old one if it exists
                     const finalPassword = (newPassword && newPassword.trim() !== '') ? newPassword : (existingPasswords.get(c.uid) || '');
                     return {
                        ...c,
                        password: finalPassword,
                        isAdmin: String(c.isAdmin).toUpperCase(),
                     }
                 });
                 await sheet.addRows(coordinatorsToSave, { raw: false, insert: true });
             }
        }

    } catch (error: unknown) {
        console.error("Error updating settings:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to update settings.");
    }
}


export async function markNotificationAsRead(notificationId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const rows = await sheet.getRows({ limit: 200 });
        const row = rows.find((r) => r.get('id') === notificationId);
        if (row) {
            row.set('isRead', 'TRUE');
            await row.save();
        }
    } catch (e: unknown) {
        console.error("Could not mark notification as read:", e instanceof Error ? e.message : "Unknown error");
    }
}

export async function clearAllNotifications(): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        await sheet.clearRows();
    } catch (e: unknown) {
        console.error("Could not clear notifications:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to clear notifications.");
    }
}

export async function addInspection(inspectionData: Omit<Inspection, 'id'>): Promise<void> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id', 'addressId', 'addressName', 'date', 'coordinatorId', 'coordinatorName', 'standard']);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['id', 'inspectionId', 'addressName', 'date', 'coordinatorName', 'category', 'itemLabel', 'itemValue', 'uwagi', 'photoData']);
        
        const inspectionId = `insp-${Date.now()}`;
        const dateString = inspectionData.date;

        await inspectionsSheet.addRow({
            id: inspectionId,
            addressId: inspectionData.addressId,
            addressName: inspectionData.addressName,
            date: dateString,
            coordinatorId: inspectionData.coordinatorId,
            coordinatorName: inspectionData.coordinatorName,
            standard: inspectionData.standard || '',
        }, { raw: false, insert: true });

        const detailRows: Record<string, string>[] = [];
        inspectionData.categories.forEach((category: InspectionCategory) => {
            category.items.forEach((item: { label: any; value: any; }) => {
                detailRows.push({
                    id: `insp-det-${Date.now()}-${Math.random()}`,
                    inspectionId,
                    addressName: inspectionData.addressName,
                    date: dateString,
                    coordinatorName: inspectionData.coordinatorName,
                    category: category.name,
                    itemLabel: item.label,
                    itemValue: Array.isArray(item.value) ? JSON.stringify(item.value) : (String(item.value) ?? ''),
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
            
            (category.photos || []).forEach((photo: string, index: number) => {
                detailRows.push({
                    id: `insp-det-${Date.now()}-${Math.random()}`,
                    inspectionId,
                    addressName: inspectionData.addressName,
                    date: dateString,
                    coordinatorName: inspectionData.coordinatorName,
                    category: category.name,
                    itemLabel: `Photo ${index + 1}`,
                    itemValue: '',
                    uwagi: '',
                    photoData: photo,
                });
            });
        });

        if (detailRows.length > 0) {
            await detailsSheet.addRows(detailRows, { raw: false, insert: true });
        }

    } catch (e: unknown) {
        console.error("Error adding inspection:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add inspection.");
    }
}

export async function generateMonthlyReport(year: number, month: number, coordinatorId: string): Promise<{ success: boolean; fileContent?: string; fileName?: string; message?: string; }> {
    try {
        const { employees, settings } = await getAllSheetsData();
        const coordinatorMap = new Map(settings.coordinators.map((c: { uid: any; name: any; }) => [c.uid, c.name]));

        const reportStart = new Date(year, month - 1, 1);
        const reportEnd = new Date(year, month, 0);
        
        let filteredEmployees = employees;
        if (coordinatorId !== 'all') {
            filteredEmployees = employees.filter(e => e.coordinatorId === coordinatorId);
        }

        const reportData = filteredEmployees
            .filter(e => {
                const checkIn = e.checkInDate ? parseISO(e.checkInDate) : null;
                const checkOut = e.checkOutDate ? parseISO(e.checkOutDate) : null;

                if (!checkIn) return false;

                const startsBeforeReportEnd = checkIn <= reportEnd;
                const endsAfterReportStart = !checkOut || checkOut >= reportStart;
                
                return startsBeforeReportEnd && endsAfterReportStart;
            })
            .map(e => {
                const checkIn = parseISO(e.checkInDate!);
                const checkOut = e.checkOutDate ? parseISO(e.checkOutDate) : null;

                const startDateInMonth = checkIn > reportStart ? checkIn : reportStart;
                const endDateInMonth = checkOut && checkOut < reportEnd ? checkOut : reportEnd;

                const daysInMonth = (endDateInMonth.getTime() - startDateInMonth.getTime()) / (1000 * 3600 * 24) + 1;
                
                return {
                    "Imię i nazwisko": e.fullName,
                    "Koordynator": coordinatorMap.get(e.coordinatorId) || 'N/A',
                    "Adres": e.address,
                    "Pokój": e.roomNumber,
                    "Zakład": e.zaklad,
                    "Data zameldowania": e.checkInDate,
                    "Data wymeldowania": e.checkOutDate,
                    "Dni w miesiącu": daysInMonth > 0 ? Math.round(daysInMonth) : 0,
                }
            });

        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Raport Miesięczny");
        
        if (reportData.length > 0) {
            const cols = Object.keys(reportData[0] || {}).map(key => ({
                wch: Math.max(key.length, ...reportData.map(row => String((row as any)[key] ?? '').length))
            }));
            worksheet["!cols"] = cols;
        }

        const fileContent = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const fileName = `Raport_Miesieczny_${year}_${month}.xlsx`;

        return { success: true, fileContent, fileName };

    } catch (e) {
        console.error("Error generating monthly report:", e);
        return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function generateAccommodationReport(year: number, month: number, coordinatorId: string): Promise<{ success: boolean; fileContent?: string; fileName?: string; message?: string; }> {
    try {
        const { employees, settings } = await getAllSheetsData();
        
        const daysInMonth = getDaysInMonth(new Date(year, month - 1));
        const coordinatorMap = new Map(settings.coordinators.map((c: { uid: any; name: any; }) => [c.uid, c.name]));
        
        let filteredAddresses = settings.addresses;
        if (coordinatorId !== 'all') {
            filteredAddresses = settings.addresses.filter((a: { coordinatorId: string; }) => a.coordinatorId === coordinatorId);
        }

        const reportData: Record<string, string | number>[] = [];

        filteredAddresses.forEach((address: { name: any; rooms: any[]; coordinatorId: unknown; }) => {
            const addressRow: Record<string, string | number> = { "Adres": address.name };
            
            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(year, month - 1, day);
                const occupantsOnDate = employees.filter(e => {
                    const checkIn = e.checkInDate ? parseISO(e.checkInDate) : null;
                    const checkOut = e.checkOutDate ? parseISO(e.checkOutDate) : null;

                    return e.address === address.name &&
                           checkIn && checkIn <= currentDate &&
                           (!checkOut || checkOut >= currentDate);
                }).length;
                addressRow[day] = occupantsOnDate;
            }

            const totalCapacity = address.rooms.reduce((sum, room) => sum + room.capacity, 0);
            addressRow["Pojemność"] = totalCapacity;
            addressRow["Koordynator"] = coordinatorMap.get(address.coordinatorId) || 'N/A';
            
            reportData.push(addressRow);
        });
        
        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Raport Zakwaterowania");

        const fileContent = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const fileName = `Raport_Zakwaterowania_${year}_${month}.xlsx`;

        return { success: true, fileContent, fileName };

    } catch (e) {
        console.error("Error generating accommodation report:", e);
        return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
}

export async function importEmployeesFromExcel(fileContent: string, actorUid: string, settings: Settings): Promise<{ importedCount: number; totalRows: number; }> {
    try {
        const workbook = XLSX.read(fileContent, { type: 'base64', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        if(!sheetName) throw new Error("Nie znaleziono arkusza w pliku Excel.");

        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { header: 1 });
        
        if (data.length <= 1) {
             throw new Error("Plik Excel jest pusty lub zawiera tylko nagłówki.");
        }
        
        const headers = data[0] as string[];
        const rows = data.slice(1);
        
        let importedCount = 0;
        const coordinatorMap = new Map(settings.coordinators.map(c => [c.name.toLowerCase(), c.uid]));

        const columnMap: Record<string, keyof Employee> = {
            'Imię i nazwisko': 'fullName',
            'Koordynator': 'coordinatorId',
            'Narodowość': 'nationality',
            'Płeć': 'gender',
            'Adres': 'address',
            'Pokój': 'roomNumber',
            'Zakład': 'zaklad',
            'Data zameldowania': 'checkInDate',
            'Data wymeldowania': 'checkOutDate',
            'Umowa od': 'contractStartDate',
            'Umowa do': 'contractEndDate',
            'Data zgłoszenia wyjazdu': 'departureReportDate',
            'Komentarze': 'comments',
        };
        
        const requiredColumns = ['Imię i nazwisko', 'Data zameldowania'];
        for (const col of requiredColumns) {
            if (!headers.includes(col)) {
                throw new Error(`Brak wymaganej kolumny w pliku Excel: "${col}"`);
            }
        }

        for (const row of rows) {
            const rowData = (row as (string | number | null)[]).reduce((acc, cell, index) => {
                const header = headers[index];
                if(header) {
                   acc[header] = cell;
                }
                return acc;
            }, {} as Record<string, unknown>);

            try {
                const employeeData: Partial<Employee> = {};
                for(const excelHeader in columnMap) {
                    if (headers.includes(excelHeader)) {
                        const employeeKey = columnMap[excelHeader];
                        const value = rowData[excelHeader];

                        if (employeeKey.toLowerCase().includes('date')) {
                            (employeeData as any)[employeeKey] = value ? safeFormat(value) : null;
                        } else if (employeeKey === 'coordinatorId') {
                             const coordinatorName = String(value || '').toLowerCase();
                             employeeData.coordinatorId = coordinatorMap.get(coordinatorName) || '';
                        }
                        else {
                            (employeeData as any)[employeeKey] = value ? String(value) : null;
                        }
                    }
                }
                
                if (!employeeData.fullName || !employeeData.checkInDate) {
                    console.warn('Skipping row due to missing full name or check-in date:', rowData);
                    continue;
                }

                await addEmployee(employeeData, actorUid);
                importedCount++;
            } catch (rowError) {
                console.error('Error processing row:', rowData, rowError);
            }
        }
        
        return { importedCount, totalRows: rows.length };

    } catch (e) {
        console.error("Error importing from Excel:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to import employees from Excel.");
    }
}

    