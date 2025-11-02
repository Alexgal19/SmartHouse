
"use server";

import type { Employee, Settings, Notification, NotificationChange, Room, NonEmployee, DeductionReason, EquipmentItem, Inspection, InspectionCategory } from '../types';
import { getSheet, getAllSheetsData } from './sheets';
import { format, isPast, isValid, getDaysInMonth, parseISO, differenceInDays, max, min } from 'date-fns';
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
const SHEET_NAME_LOCALITIES = 'Localities';
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
const ADDRESS_HEADERS = ['id', 'locality', 'name', 'coordinatorIds'];
const AUDIT_LOG_HEADERS = ['timestamp', 'actorId', 'actorName', 'action', 'targetType', 'targetId', 'details'];

const safeFormat = (dateStr: unknown): string | null => {
    if (!dateStr) return null;
    
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

export async function getAllData() {
    try {
        const allData = await getAllSheetsData();
        return allData;
    } catch (error: unknown) {
        console.error("Error in getAllData (actions):", error);
        throw new Error(error instanceof Error ? error.message : "Failed to get all data.");
    }
}

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
            zaklad: employeeData.zaklad || '',
            checkInDate: employeeData.checkInDate || '',
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
        const rows = await sheet.getRows({ limit: 2000 });
        const rowIndex = rows.findIndex((row) => row.get('id') === employeeId);

        if (rowIndex === -1) {
            throw new Error('Employee not found');
        }

        const row = rows[rowIndex];
        const originalEmployee = deserializeEmployee(row.toObject());

        if (!originalEmployee) {
            throw new Error('Could not deserialize original employee data.');
        }

        const updatedEmployeeData: Employee = { ...originalEmployee, ...updates };
        
        // Handle address change logic
        if (updates.address && updates.address !== originalEmployee.address) {
            updatedEmployeeData.oldAddress = originalEmployee.address;
            updatedEmployeeData.addressChangeDate = format(new Date(), 'yyyy-MM-dd');
        }
        
        const changes: NotificationChange[] = [];

        for (const key in updates) {
            const typedKey = key as keyof Employee;
            const oldValue = originalEmployee[typedKey];
            const newValue = updates[typedKey];
            
            const areDates = ['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate', 'addressChangeDate'].includes(key);

            let oldValStr: string | null = null;
            if (oldValue !== null && oldValue !== undefined) {
                 if (key === 'deductionReason' && Array.isArray(oldValue)) {
                    oldValStr = JSON.stringify(oldValue);
                } else if (areDates && isValid(new Date(oldValue as string))) {
                    oldValStr = format(new Date(oldValue as string), 'dd-MM-yyyy');
                } else {
                    oldValStr = String(oldValue);
                }
            }

            let newValStr: string | null = null;
            if (newValue !== null && newValue !== undefined) {
                 if (key === 'deductionReason' && Array.isArray(newValue)) {
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
        const { settings } = await getAllData();
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
            row.set(key, (updates as Record<string,unknown>)[key]);
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
        const rows = await sheet.getRows({ limit: 2000 });
        const rowsToDelete = rows.filter((row) => row.get('status') === status);
        
        if (rowsToDelete.length === 0) {
            return;
        }

        const deletedRowIndexes = rowsToDelete.map(r => r.rowNumber - 1);
        await sheet.deleteRows(deletedRowIndexes);

    } catch (e: unknown) {
        console.error("Error bulk deleting employees:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to bulk delete employees.");
    }
}

export async function transferEmployees(fromCoordinatorId: string, toCoordinatorId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 2000 });
        const rowsToTransfer = rows.filter((row) => row.get('coordinatorId') === fromCoordinatorId);

        if (rowsToTransfer.length === 0) {
            return;
        }

        const { settings } = await getAllData();
        const toCoordinator = settings.coordinators.find((c: { uid: string; }) => c.uid === toCoordinatorId);
        if (!toCoordinator) {
            throw new Error("Target coordinator not found.");
        }

        for (const row of rowsToTransfer) {
            row.set('coordinatorId', toCoordinatorId);
        }

        await sheet.saveUpdatedCells();

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
        if (newSettings.localities) {
            await updateSimpleList(SHEET_NAME_LOCALITIES, newSettings.localities);
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
                    locality: addr.locality,
                    name: addr.name, 
                    coordinatorIds: addr.coordinatorIds.join(',') 
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
             await sheet.clearRows();
             if (newSettings.coordinators.length > 0) {
                 await sheet.addRows(newSettings.coordinators.map((c: { isAdmin: any; }) => ({
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

export async function deleteNotification(notificationId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id']);
        const rows = await sheet.getRows({ limit: 200 });
        const rowToDelete = rows.find(row => row.get('id') === notificationId);
        if (rowToDelete) {
            await rowToDelete.delete();
        } else {
            throw new Error('Notification not found');
        }
    } catch (e: unknown) {
        console.error("Could not delete notification:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete notification.");
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

export async function generateAccommodationReport(year: number, month: number, coordinatorId: string): Promise<{ success: boolean; fileContent?: string; fileName?: string; message?: string; }> {
    try {
        const { employees, settings } = await getAllData();
        const coordinatorMap = new Map(settings.coordinators.map((c: { uid: any; name: any; }) => [c.uid, c.name]));

        const reportStart = new Date(year, month - 1, 1);
        const reportEnd = new Date(year, month, 0, 23, 59, 59);

        let filteredEmployees = employees;
        if (coordinatorId !== 'all') {
            filteredEmployees = employees.filter(e => e.coordinatorId === coordinatorId);
        }

        const reportData: any[] = [];

        filteredEmployees.forEach(e => {
            if (!e.checkInDate) return;

            const periods: { address: string, start: Date, end: Date }[] = [];
            const mainCheckIn = parseISO(e.checkInDate);
            const mainCheckOut = e.checkOutDate ? parseISO(e.checkOutDate) : null;

            if (e.addressChangeDate && e.oldAddress) {
                const changeDate = parseISO(e.addressChangeDate);
                // Period at old address
                periods.push({
                    address: e.oldAddress,
                    start: mainCheckIn,
                    end: changeDate
                });
                // Period at new address
                periods.push({
                    address: e.address,
                    start: changeDate,
                    end: mainCheckOut || reportEnd
                });
            } else {
                // Single period
                periods.push({
                    address: e.address,
                    start: mainCheckIn,
                    end: mainCheckOut || reportEnd
                });
            }

            periods.forEach(period => {
                const effectiveStart = max(period.start, reportStart);
                const effectiveEnd = min(period.end, reportEnd);

                if (effectiveStart > effectiveEnd) return;

                const daysInMonth = differenceInDays(effectiveEnd, effectiveStart) + 1;
                
                if (daysInMonth > 0) {
                    reportData.push({
                        "Imię i nazwisko": e.fullName,
                        "Koordynator": coordinatorMap.get(e.coordinatorId) || 'N/A',
                        "Adres": period.address,
                        "Pokój": e.roomNumber,
                        "Zakład": e.zaklad,
                        "Stary adres": e.oldAddress,
                        "Data zmiany adresu": e.addressChangeDate ? formatDate(e.addressChangeDate) : null,
                        "Data zameldowania": formatDate(e.checkInDate),
                        "Data wymeldowania": formatDate(e.checkOutDate),
                        "Dni w miesiącu": daysInMonth
                    });
                }
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Raport Zakwaterowania");
        
        if (reportData.length > 0) {
            const cols = Object.keys(reportData[0] || {}).map(key => ({
                wch: Math.max(key.length, ...reportData.map(row => String(row[key as keyof typeof row] ?? '').length)) + 2
            }));
            worksheet["!cols"] = cols;
        }

        const fileContent = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const fileName = `Raport_Zakwaterowania_${year}_${String(month).padStart(2, '0')}.xlsx`;

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
        if(!sheetName) throw new Error("Nie znaleziono arkusza в pliku Excel.");

        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

        let importedCount = 0;

        for (const row of data) {
            try {
                // Map Excel columns to Employee properties
                const employeeData: Partial<Employee> = {
                    fullName: row['Imię i nazwisko'] as string,
                    coordinatorId: row['Koordynator'] as string, // This is coordinator NAME, needs mapping
                    nationality: row['Narodowość'] as string,
                    gender: row['Płeć'] as string,
                    address: row['Adres'] as string,
                    roomNumber: String(row['Pokój'] || ''),
                    zaklad: row['Zakład'] as string,
                    checkInDate: row['Data zameldowania'] ? safeFormat(row['Data zameldowania']) : '',
                    checkOutDate: row['Data wymeldowania'] ? safeFormat(row['Data wymeldowania']) : undefined,
                    contractStartDate: row['Umowa od'] ? safeFormat(row['Umowa od']) : undefined,
                    contractEndDate: row['Umowa do'] ? safeFormat(row['Umowa do']) : undefined,
                    comments: row['Komentarze'] as string,
                };
                
                if (!employeeData.fullName || !employeeData.checkInDate) {
                    console.warn('Skipping row due to missing full name or check-in date:', row);
                    continue;
                }
                
                const coordinator = settings.coordinators.find((c: { name: string; }) => c.name.toLowerCase() === (employeeData.coordinatorId || '').toLowerCase());
                employeeData.coordinatorId = coordinator ? coordinator.uid : '';

                await addEmployee(employeeData, actorUid);
                importedCount++;
            } catch (rowError) {
                console.error('Error processing row:', row, rowError);
            }
        }
        
        return { importedCount, totalRows: data.length };

    } catch (e) {
        console.error("Error importing from Excel:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to import employees from Excel.");
    }
}
