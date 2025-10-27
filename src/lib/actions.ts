

"use server";

import type { Employee, Settings, Notification, NotificationChange, Room, Inspection, NonEmployee, DeductionReason, EquipmentItem, TemporaryAccess, ImportStatus } from '@/types';
import { getSheet, getEmployeesFromSheet, getSettingsFromSheet, getNotificationsFromSheet, getInspectionsFromSheet, getNonEmployeesFromSheet, getEquipmentFromSheet, getAllSheetsData } from './sheets';
import { format, isPast, isValid, parse, startOfMonth, endOfMonth, differenceInDays, min, max } from 'date-fns';
import * as XLSX from 'xlsx';
import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'studio-6821761262-fdf39.firebasestorage.app';

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
const SHEET_NAME_INSPECTIONS = 'Inspections';
const SHEET_NAME_INSPECTION_DETAILS = 'InspectionDetails';
const SHEET_NAME_EQUIPMENT = 'Equipment';
const SHEET_NAME_IMPORT_STATUS = 'ImportStatus';

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
    const serialized: Record<string, any> = {};

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
            serialized[key] = value;
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
const IMPORT_STATUS_HEADERS = ['jobId', 'fileName', 'status', 'message', 'processedRows', 'totalRows', 'createdAt', 'actorName'];

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
        checkInDate: checkInDate || '',
        checkOutDate: safeFormat(plainObject.checkOutDate),
        contractStartDate: safeFormat(plainObject.contractStartDate),
        contractEndDate: safeFormat(plainObject.contractEndDate),
        departureReportDate: safeFormat(plainObject.departureReportDate),
        comments: plainObject.comments || '',
        status: plainObject.status as 'active' | 'dismissed' || 'active',
        oldAddress: plainObject.oldAddress || undefined,
        addressChangeDate: safeFormat(plainObject.addressChangeDate),
        depositReturned: depositReturned,
        depositReturnAmount: plainObject.depositReturnAmount ? parseFloat(plainObject.depositReturnAmount) : null,
        deductionRegulation: plainObject.deductionRegulation ? parseFloat(plainObject.deductionRegulation) : null,
        deductionNo4Months: plainObject.deductionNo4Months ? parseFloat(plainObject.deductionNo4Months) : null,
        deductionNo30Days: plainObject.deductionNo30Days ? parseFloat(plainObject.deductionNo30Days) : null,
        deductionReason: deductionReason,
    };
    
    return newEmployee;
};

export async function getAllData() {
    try {
        const allData = await getAllSheetsData();
        return allData;
    } catch (error: unknown) {
        console.error("Error in getAllData (actions):", error);
        throw new Error(error instanceof Error ? error.message : "Failed to get all data.");
    }
}

export async function getEmployees(coordinatorId?: string): Promise<Employee[]> {
    try {
        const employees = await getEmployeesFromSheet(coordinatorId);
        return employees;
    } catch (error: unknown) {
        console.error("Error in getEmployees (actions):", error);
        throw new Error(error instanceof Error ? error.message : "Failed to get employees.");
    }
}

export async function getNonEmployees(): Promise<NonEmployee[]> {
  try {
     const nonEmployees = await getNonEmployeesFromSheet();
     return nonEmployees;
  } catch (error: unknown) {
    console.error("Error in getNonEmployees (actions):", error);
    throw new Error(error instanceof Error ? error.message : "Failed to get non-employees.");
  }
}

export async function getEquipment(coordinatorId?: string): Promise<EquipmentItem[]> {
  try {
     const equipment = await getEquipmentFromSheet(coordinatorId);
     return equipment;
  } catch (error: unknown) {
    console.error("Error in getEquipment (actions):", error);
    throw new Error(error instanceof Error ? error.message : "Failed to get equipment.");
  }
}


export async function getSettings(): Promise<Settings> {
    try {
        const settings = await getSettingsFromSheet();
        return settings;
    } catch (error: unknown) {
        console.error("Error in getSettings (actions):", error);
        throw new Error(error instanceof Error ? error.message : "Failed to get settings.");
    }
}

const writeToAuditLog = async (actorId: string, actorName: string, action: string, targetType: string, targetId: string, details: any) => {
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
        const actor = coordRows.find((r: { get: (arg0: string) => string; }) => r.get('uid') === actorUid)?.toObject();
        
        if (!actor) {
            console.error(`Could not find actor with uid ${actorUid} to create notification.`);
            return;
        }

        const message = `${actor.name} ${action} pracownika ${employee.fullName}.`;
        
        const newNotification: Notification = {
            id: `notif-${Date.now()}`,
            message,
            employeeId: employee.id,
            employeeName: employee.fullName,
            coordinatorId: actor.uid,
            coordinatorName: actor.name,
            createdAt: new Date().toISOString(),
            isRead: false,
            changes
        };

        await sheet.addRow(serializeNotification(newNotification), { raw: false, insert: true });
        
        // Also write to the audit log
        await writeToAuditLog(actor.uid, actor.name, action, 'employee', employee.id, changes);

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
            zaklad: employeeData.zaklad || '',
            checkInDate: employeeData.checkInDate || '',
            checkOutDate: employeeData.checkOutDate,
            contractStartDate: employeeData.contractStartDate || null,
            contractEndDate: employeeData.contractEndDate || null,
            departureReportDate: employeeData.departureReportDate,
            comments: employeeData.comments,
            oldAddress: employeeData.oldAddress,
            addressChangeDate: employeeData.addressChangeDate,
            depositReturned: employeeData.depositReturned,
            depositReturnAmount: employeeData.depositReturnAmount,
            deductionRegulation: employeeData.deductionRegulation,
            deductionNo4Months: employeeData.deductionNo4Months,
            deductionNo30Days: employeeData.deductionNo30Days,
            deductionReason: employeeData.deductionReason,
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
        const rows = await sheet.getRows({ limit: 2000 });
        const rowIndex = rows.findIndex((row: { get: (arg0: string) => string; }) => row.get('id') === employeeId);

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

        for (const key in updates) {
            const typedKey = key as keyof Employee;
            const oldValue = originalEmployee[typedKey];
            const newValue = updates[typedKey];
            
            const areDates = ['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate', 'addressChangeDate'].includes(key);

            let oldValStr: string | null = null;
            if (oldValue !== null && oldValue !== undefined) {
                 if (key === 'deductionReason') {
                    oldValStr = JSON.stringify(oldValue);
                } else if (areDates && isValid(new Date(oldValue as string))) {
                    oldValStr = format(new Date(oldValue as string), 'dd-MM-yyyy');
                } else {
                    oldValStr = String(oldValue);
                }
            }

            let newValStr: string | null = null;
            if (newValue !== null && newValue !== undefined) {
                 if (key === 'deductionReason') {
                    newValStr = JSON.stringify(newValue);
                } else if (areDates && isValid(new Date(newValue as string))) {
                    newValStr = format(new Date(newValue as string), 'dd-MM-yyyy');
                } else {
                    newValStr = String(newValue);
                }
            }
           
            if (oldValStr !== newValStr) {
                changes.push({ field: typedKey, oldValue: oldValStr || 'Brak', newValue: newValStr || 'Brak' });
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
        const rows = await sheet.getRows({ limit: 2000 });
        const row = rows.find((r: { get: (arg0: string) => string; }) => r.get('id') === employeeId);

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
        const rowIndex = rows.findIndex((row: { get: (arg0: string) => string; }) => row.get('id') === id);

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
        const row = rows.find((row: { get: (arg0: string) => string; }) => row.get('id') === id);
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

export async function addEquipment(itemData: Omit<EquipmentItem, 'id'>): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EQUIPMENT, EQUIPMENT_HEADERS);
        const newItem: EquipmentItem = {
            id: `equip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ...itemData,
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
        const row = rows.find((r: { get: (arg0: string) => string; }) => r.get('id') === id);
        if (!row) throw new Error("Equipment not found");
        
        for (const key in updates) {
            row.set(key, (updates as any)[key]);
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
        const row = rows.find((r: { get: (arg0: string) => string; }) => r.get('id') === id);
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
        const rows = await sheet.getRows({ limit: 2000 });
        const rowsToDelete = rows.filter((row: { get: (arg0: string) => string; }) => row.get('status') === status);
        
        if (rowsToDelete.length === 0) {
            return;
        }

        // Deleting rows in reverse order is a good practice to avoid index shifting issues,
        // although google-spreadsheet library might handle this, it's a safe bet.
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
        const rows = await sheet.getRows({ limit: 2000 });
        const rowsToTransfer = rows.filter((row: { get: (arg0: string) => string; }) => row.get('coordinatorId') === fromCoordinatorId);

        if (rowsToTransfer.length === 0) {
            return;
        }

        const { coordinators } = await getSettings();
        const toCoordinator = coordinators.find(c => c.uid === toCoordinatorId);
        if (!toCoordinator) {
            throw new Error("Target coordinator not found.");
        }

        for (const row of rowsToTransfer) {
            row.set('coordinatorId', toCoordinatorId);
            await row.save();
        }
    } catch (e: unknown) {
        console.error("Error transferring employees:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to transfer employees.");
    }
}

export async function checkAndUpdateEmployeeStatuses(actorUid: string): Promise<{ updated: number }> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 2000 });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let updatedCount = 0;

        for (const row of rows) {
            const status = row.get('status');
            const checkOutDateString = row.get('checkOutDate');

            if (status === 'active' && checkOutDateString) {
                const checkOutDate = new Date(checkOutDateString);
                if (isValid(checkOutDate) && isPast(checkOutDate)) {
                    row.set('status', 'dismissed');
                    await row.save();
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
            const addressesData = newSettings.addresses.map(addr => {
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

    } catch (error: unknown) {
        console.error("Error updating settings:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to update settings.");
    }
}


export async function getNotifications(): Promise<Notification[]> {
    try {
        const notifications = await getNotificationsFromSheet();
        return notifications;
    } catch (error: unknown) {
        console.error("Error in getNotifications (actions):", error);
        throw new Error(error instanceof Error ? error.message : "Failed to get notifications.");
    }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const rows = await sheet.getRows({ limit: 200 });
        const row = rows.find((r: { get: (arg0: string) => string; }) => r.get('id') === notificationId);
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


export async function getInspections(coordinatorId?: string): Promise<Inspection[]> {
    try {
        const inspections = await getInspectionsFromSheet(coordinatorId);
        return inspections;
    } catch (error: unknown) {
        console.error("Error in getInspections (actions):", error);
        throw new Error(error instanceof Error ? error.message : "Failed to get inspections.");
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
    } catch (e: unknown) {
        console.error("Error adding inspection:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add inspection.");
    }
}

export async function updateInspection(id: string, inspectionData: Omit<Inspection, 'id'>): Promise<void> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id', 'addressId', 'addressName', 'date', 'coordinatorId', 'coordinatorName', 'standard']);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['id', 'inspectionId', 'addressName', 'date', 'coordinatorName', 'category', 'itemLabel', 'itemValue', 'uwagi', 'photoData']);
        
        const inspectionRows = await inspectionsSheet.getRows({ limit: 1000 });
        const inspectionRow = inspectionRows.find((r: { get: (arg0: string) => string; }) => r.get('id') === id);
        if (!inspectionRow) throw new Error("Inspection not found");
        
        const dateString = inspectionData.date;
        inspectionRow.set('addressId', inspectionData.addressId);
        inspectionRow.set('addressName', inspectionData.addressName);
        inspectionRow.set('date', dateString);
        inspectionRow.set('coordinatorId', inspectionData.coordinatorId);
        inspectionRow.set('coordinatorName', inspectionData.coordinatorName);
        inspectionRow.set('standard', inspectionData.standard || '');
        await inspectionRow.save();

        const detailRows = await detailsSheet.getRows({ limit: 5000 });
        const oldDetailRows = detailRows.filter((r: { get: (arg0: string) => string; }) => r.get('inspectionId') === id);
        for (let i = oldDetailRows.length - 1; i >= 0; i--) {
            await oldDetailRows[i].delete();
        }

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
    } catch(e: unknown) {
        console.error("Error updating inspection:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update inspection.");
    }
}

export async function deleteInspection(id: string): Promise<void> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id']);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['inspectionId']);

        const inspectionRows = await inspectionsSheet.getRows({ limit: 1000 });
        const inspectionRow = inspectionRows.find((r: { get: (arg0: string) => string; }) => r.get('id') === id);
        if (inspectionRow) {
            await inspectionRow.delete();
        }

        const detailRows = await detailsSheet.getRows({ limit: 5000 });
        const oldDetailRows = detailRows.filter((r: { get: (arg0: string) => string; }) => r.get('inspectionId') === id);
        for (let i = oldDetailRows.length - 1; i >= 0; i--) {
            await oldDetailRows[i].delete();
        }
    } catch(e: unknown) {
         console.error("Error deleting inspection:", e);
         throw new Error(e instanceof Error ? e.message : "Failed to delete inspection.");
    }
}

const parseAndFormatDate = (dateValue: any): string | null => {
    if (dateValue === null || dateValue === undefined || dateValue === '') {
        return null;
    }
    if (dateValue instanceof Date && isValid(dateValue)) {
         return format(dateValue, 'yyyy-MM-dd');
    }
    if (typeof dateValue === 'number') { 
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        return format(date, 'yyyy-MM-dd');
    }
    if (typeof dateValue === 'string') {
        const parsedDate = parse(dateValue, 'dd-MM-yyyy', new Date());
        if (isValid(parsedDate)) {
            return format(parsedDate, 'yyyy-MM-dd');
        }
        const isoDate = new Date(dateValue);
        if(isValid(isoDate)) {
            return format(isoDate, 'yyyy-MM-dd');
        }
    }
    return null;
};

export async function getSignedUploadUrl(fileName: string, contentType: string): Promise<{ success: boolean; message: string; url?: string, filePath?: string }> {
    try {
        const storage = new Storage({
             credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            projectId: process.env.GOOGLE_PROJECT_ID,
        });
        
        const bucket = storage.bucket(BUCKET_NAME);
        const filePath = `imports/${Date.now()}-${fileName}`;
        const file = bucket.file(filePath);

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType,
        });

        return { success: true, url, filePath, message: "URL generated." };
    } catch (error: unknown) {
        console.error('Error getting signed URL:', error);
        return { success: false, message: error instanceof Error ? error.message : 'An unknown error occurred while generating the upload URL.' };
    }
}

export async function bulkImportEmployees(filePath: string, actorUid: string): Promise<{success: boolean, message: string}> {
    try {
        const storage = new Storage({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            projectId: process.env.GOOGLE_PROJECT_ID,
        });
        const bucket = storage.bucket(BUCKET_NAME);
        const file = bucket.file(filePath);

        const [fileBuffer] = await file.download();
        
        const settings = await getSettings();
        
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null });

        if (json.length === 0) {
            return { success: false, message: 'Plik jest pusty.' };
        }

        const requiredHeaders = ['fullName', 'coordinatorName', 'nationality', 'gender', 'address', 'roomNumber', 'zaklad'];
        const headers = Object.keys(json[0] || {});
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            return { success: false, message: `Brakujące kolumny w pliku: ${missingHeaders.join(', ')}` };
        }
        
        const employeesToAdd: (Partial<Employee>)[] = [];
        
        for (const row of json) {
             if (!row.fullName) {
                continue; // Skip empty rows
            }
            const coordinator = row.coordinatorName ? settings.coordinators.find(c => c.name.toLowerCase() === String(row.coordinatorName).toLowerCase()) : null;
            
            const employee: Partial<Employee> = {
                fullName: row.fullName ? String(row.fullName) : '',
                coordinatorId: coordinator ? coordinator.uid : '',
                nationality: row.nationality ? String(row.nationality) : '',
                gender: row.gender ? String(row.gender) : '',
                address: row.address ? String(row.address) : '',
                roomNumber: row.roomNumber ? String(row.roomNumber) : '',
                zaklad: row.zaklad ? String(row.zaklad) : '',
                checkInDate: parseAndFormatDate(row.checkInDate) ?? undefined,
                contractStartDate: parseAndFormatDate(row.contractStartDate) || undefined,
                contractEndDate: parseAndFormatDate(row.contractEndDate) || undefined,
                departureReportDate: parseAndFormatDate(row.departureReportDate) || undefined,
                comments: row.comments ? String(row.comments) : undefined,
            };
            employeesToAdd.push(employee);
        }
        
        for (const emp of employeesToAdd) {
            await addEmployee(emp, actorUid);
        }

        return { success: true, message: `Pomyślnie zaimportowano ${employeesToAdd.length} pracowników.` };

    } catch (e: unknown) {
         return { success: false, message: e instanceof Error ? e.message : "Wystąpił nieznany błąd podczas przetwarzania pliku." };
    }
}


export async function generateMonthlyReport(year: number, month: number, coordinatorId?: string): Promise<{ success: boolean; message?: string; fileContent?: string; fileName?: string }> {
    try {
        const startDate = startOfMonth(new Date(year, month - 1));
        const endDate = endOfMonth(new Date(year, month - 1));

        let allEmployees = await getEmployeesFromSheet();
        let allInspections = await getInspectionsFromSheet();
        const settings = await getSettingsFromSheet();
        
        const coordinatorMap = new Map(settings.coordinators.map(c => [c.uid, c.name]));
        let reportCoordinatorName = 'Wszyscy';

        if(coordinatorId && coordinatorId !== 'all') {
            allEmployees = allEmployees.filter(e => e.coordinatorId === coordinatorId);
            allInspections = allInspections.filter(i => i.coordinatorId === coordinatorId);
            reportCoordinatorName = coordinatorMap.get(coordinatorId) || 'Nieznany';
        }

        const employeesInMonth = allEmployees.filter(e => {
            if (!e.checkInDate) return false;
            const checkIn = new Date(e.checkInDate);
            const checkOut = e.checkOutDate ? new Date(e.checkOutDate) : null;
            return checkIn <= endDate && (!checkOut || checkOut >= startDate);
        });

        const inspectionsInMonth = allInspections.filter(i => {
            const inspectionDate = new Date(i.date);
            return inspectionDate >= startDate && inspectionDate <= endDate;
        });
        
        const wb = XLSX.utils.book_new();

        // Employees Sheet
        const employeesHeaders = ["ID", "Imię і nazwisko", "Koordynator", "Adres", "Pokój", "Data zameldowania", "Data wymeldowania", "Status", "Potrącenia (zł)"];
        const employeesData = employeesInMonth.map(e => {
            const deductionReasonTotal = e.deductionReason?.reduce((sum, r) => sum + (r.checked && r.amount ? r.amount : 0), 0) || 0;
            const totalDeductions = (e.deductionRegulation || 0) + (e.deductionNo4Months || 0) + (e.deductionNo30Days || 0) + deductionReasonTotal;
            return [
                e.id, e.fullName, coordinatorMap.get(e.coordinatorId) || e.coordinatorId, e.address, e.roomNumber, e.checkInDate, e.checkOutDate || '', e.status, totalDeductions
            ];
        });
        const ws_employees = XLSX.utils.aoa_to_sheet([employeesHeaders, ...employeesData]);
        XLSX.utils.book_append_sheet(wb, ws_employees, `Pracownicy (${reportCoordinatorName})`);

        // Inspections Sheet
        const inspectionsHeaders = ["ID Інспекції", "Adres", "Data", "Koordynator", "Standard"];
        const inspectionsData = inspectionsInMonth.map(i => [i.id, i.addressName, format(new Date(i.date), 'yyyy-MM-dd'), i.coordinatorName, i.standard || '']);
        const ws_inspections = XLSX.utils.aoa_to_sheet([inspectionsHeaders, ...inspectionsData]);
        XLSX.utils.book_append_sheet(wb, ws_inspections, `Інспекції (${reportCoordinatorName})`);
        
        // Finance Sheet
        const financeHeaders = ["Pracownik", "Zwrot kaucji", "Kwota zwrotu", "Potrącenie (regulamin)", "Potrącenie (4 msc)", "Potrącenie (30 dni)", "Potrącenia (inne)", "Suma potrąceń"];
        const financeData = employeesInMonth.filter(e => e.depositReturnAmount || e.deductionRegulation || e.deductionNo4Months || e.deductionNo30Days || e.deductionReason?.some(r => r.checked)).map(e => {
            const deductionReasonTotal = e.deductionReason?.reduce((sum, r) => sum + (r.checked && r.amount ? r.amount : 0), 0) || 0;
            const totalDeductions = (e.deductionRegulation || 0) + (e.deductionNo4Months || 0) + (e.deductionNo30Days || 0) + deductionReasonTotal;
            return [
                e.fullName, e.depositReturned || 'Nie dotyczy', e.depositReturnAmount || 0, e.deductionRegulation || 0, e.deductionNo4Months || 0, e.deductionNo30Days || 0, deductionReasonTotal, totalDeductions
            ];
        });
        const ws_finance = XLSX.utils.aoa_to_sheet([financeHeaders, ...financeData]);
        XLSX.utils.book_append_sheet(wb, ws_finance, `Finanse (${reportCoordinatorName})`);

        // Housing Sheet (new)
        if (coordinatorId && coordinatorId !== 'all') {
            const { addresses } = await getSettingsFromSheet();
            const coordinatorAddresses = addresses.filter(addr => addr.coordinatorId === coordinatorId);
            const housingHeaders = ["Adres", "Liczba pokoi", "Całkowita pojemność", "Zajęte miejsca", "Wolne miejsca"];
            const housingData = coordinatorAddresses.map(addr => {
                const totalCapacity = addr.rooms.reduce((sum, room) => sum + room.capacity, 0);
                const occupiedCount = allEmployees.filter(e => e.address === addr.name && e.status === 'active').length;
                return [
                    addr.name,
                    addr.rooms.length,
                    totalCapacity,
                    occupiedCount,
                    totalCapacity - occupiedCount
                ];
            });
             const ws_housing = XLSX.utils.aoa_to_sheet([housingHeaders, ...housingData]);
             XLSX.utils.book_append_sheet(wb, ws_housing, `Mieszkania (${reportCoordinatorName})`);
        }


        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const fileContent = buf.toString('base64');
        const fileName = `raport_${reportCoordinatorName.replace(/\s/g, '_')}_${year}_${String(month).padStart(2, '0')}.xlsx`;

        return { success: true, fileContent, fileName };

    } catch (error: unknown) {
        console.error("Error generating monthly report:", error);
        throw new Error(error instanceof Error ? error.message : "An unknown error occurred during report generation.");
    }
}


export async function generateAccommodationReport(year: number, month: number, coordinatorId?: string): Promise<{ success: boolean; message?: string; fileContent?: string; fileName?: string }> {
    try {
        const monthStartDate = startOfMonth(new Date(year, month - 1));
        const monthEndDate = endOfMonth(new Date(year, month - 1));

        let allEmployees = await getEmployeesFromSheet();
        const settings = await getSettingsFromSheet();
        const coordinatorMap = new Map(settings.coordinators.map(c => [c.uid, c.name]));

        if (coordinatorId && coordinatorId !== 'all') {
            allEmployees = allEmployees.filter(e => e.coordinatorId === coordinatorId);
        }

        const reportData: { employeeName: string; address: string; days: number; month: string, coordinatorName: string }[] = [];

        for (const employee of allEmployees) {
            if (!employee.checkInDate || !isValid(new Date(employee.checkInDate))) {
                continue; 
            }
            
            const checkInDate = new Date(employee.checkInDate);
            const checkOutDate = employee.checkOutDate && isValid(new Date(employee.checkOutDate)) ? new Date(employee.checkOutDate) : null;
            const addressChangeDate = employee.addressChangeDate && isValid(new Date(employee.addressChangeDate)) ? new Date(employee.addressChangeDate) : null;
            const employeeCoordinatorName = coordinatorMap.get(employee.coordinatorId) || 'Nieznany';

            if (checkInDate > monthEndDate || (checkOutDate && checkOutDate < monthStartDate)) {
                continue;
            }

            const reportMonthStr = format(monthStartDate, 'yyyy-MM');

            if (addressChangeDate && addressChangeDate > monthStartDate && addressChangeDate <= monthEndDate && employee.oldAddress) {
                
                const oldAddressStartDate = max([monthStartDate, checkInDate]);
                const oldAddressEndDate = min([addressChangeDate, ...(checkOutDate ? [checkOutDate] : []), monthEndDate]);
                if (oldAddressStartDate < oldAddressEndDate) {
                    const daysAtOldAddress = differenceInDays(oldAddressEndDate, oldAddressStartDate);
                    if (daysAtOldAddress > 0) {
                        reportData.push({
                            employeeName: employee.fullName,
                            address: `${employee.oldAddress} (стара)`,
                            days: daysAtOldAddress,
                            month: reportMonthStr,
                            coordinatorName: employeeCoordinatorName
                        });
                    }
                }
                
                const newAddressStartDate = addressChangeDate;
                const newAddressEndDate = min([monthEndDate, ...(checkOutDate ? [checkOutDate] : [])]);
                 if (newAddressStartDate <= newAddressEndDate) {
                    const daysAtNewAddress = differenceInDays(newAddressEndDate, newAddressStartDate) + 1;
                    if (daysAtNewAddress > 0) {
                         reportData.push({
                            employeeName: employee.fullName,
                            address: employee.address,
                            days: daysAtNewAddress,
                            month: reportMonthStr,
                            coordinatorName: employeeCoordinatorName
                        });
                    }
                }

            } else {
                let currentAddress = employee.address;
                
                if(addressChangeDate && addressChangeDate > monthEndDate && employee.oldAddress){
                    currentAddress = employee.oldAddress;
                }

                const effectiveStartDate = max([monthStartDate, checkInDate]);
                const effectiveEndDate = min([monthEndDate, ...(checkOutDate ? [checkOutDate] : [])]);

                if (effectiveStartDate <= effectiveEndDate) {
                    const days = differenceInDays(effectiveEndDate, effectiveStartDate) + 1;
                    if (days > 0) {
                        reportData.push({
                            employeeName: employee.fullName,
                            address: currentAddress,
                            days: days,
                            month: reportMonthStr,
                            coordinatorName: employeeCoordinatorName
                        });
                    }
                }
            }
        }
        
        const wb = XLSX.utils.book_new();
        const headers = ["Employee Name", "Address", "Days Lived", "Month", "Coordinator Name"];
        const data = reportData.map(row => [row.employeeName, row.address, row.days, row.month, row.coordinatorName]);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        
        const reportCoordinatorName = coordinatorId && coordinatorId !== 'all' ? coordinatorMap.get(coordinatorId) : 'Wszyscy';
        XLSX.utils.book_append_sheet(wb, ws, `Dni Pobytu (${reportCoordinatorName})`);

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const fileContent = buf.toString('base64');
        const fileName = `raport_zakwaterowania_${reportCoordinatorName?.replace(/\s/g, '_')}_${year}_${String(month).padStart(2, '0')}.xlsx`;

        return { success: true, fileContent, fileName };

    } catch (error: unknown) {
        console.error("Error generating accommodation report:", error);
        throw new Error(error instanceof Error ? error.message : "An unknown error occurred during accommodation report generation.");
    }
}
