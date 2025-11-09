

"use server";

import type { Employee, Settings, Notification, NotificationChange, Room, NonEmployee, DeductionReason, EquipmentItem, Inspection, InspectionCategory, NotificationType, Coordinator } from '../types';
import { getSheet, getAllSheetsData } from './sheets';
import { format, isPast, isValid, getDaysInMonth, parseISO, differenceInDays, max, min, parse as dateFnsParse } from 'date-fns';
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
        if (['checkInDate', 'checkOutDate', 'departureReportDate'].includes(key)) {
            serialized[key] = serializeDate(value as string);
        } else if (value !== null && value !== undefined) {
            serialized[key] = String(value);
        } else {
            serialized[key] = '';
        }
    }
    return serialized;
};

const serializeNotification = (notification: Omit<Notification, 'id'> & { id: string }): Record<string, string> => {
    return {
        id: notification.id,
        message: notification.message,
        entityId: notification.entityId,
        entityName: notification.entityName,
        recipientId: notification.recipientId,
        createdAt: notification.createdAt,
        isRead: String(notification.isRead).toUpperCase(),
        type: notification.type,
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
    'id', 'fullName', 'coordinatorId', 'nationality', 'gender', 'address', 'roomNumber', 'checkInDate', 'checkOutDate', 'departureReportDate', 'comments'
];

const NOTIFICATION_HEADERS = [
    'id', 'message', 'entityId', 'entityName', 'recipientId', 'createdAt', 'isRead', 'type', 'changes'
];


const EQUIPMENT_HEADERS = [
    'id', 'inventoryNumber', 'name', 'quantity', 'description', 'addressId', 'addressName'
];

const COORDINATOR_HEADERS = ['uid', 'name', 'isAdmin', 'departments', 'password'];
const ADDRESS_HEADERS = ['id', 'locality', 'name', 'coordinatorIds'];
const AUDIT_LOG_HEADERS = ['timestamp', 'actorId', 'actorName', 'action', 'targetType', 'targetId', 'details'];

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
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        if (isValid(date)) {
            return format(date, 'yyyy-MM-dd');
        }
    }

    const dateString = String(dateValue).trim();
    if (!dateString) {
        return null;
    }

    // This is now the priority format
    let date = parseISO(dateString);
    if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
    }

    const formatsToTry = ['dd.MM.yyyy', 'dd-MM-yyyy', 'dd/MM/yyyy'];
    for (const fmt of formatsToTry) {
        date = dateFnsParse(dateString, fmt, new Date());
        if (isValid(date)) {
            return format(date, 'yyyy-MM-dd');
        }
    }
    
    date = new Date(dateString);
    if (isValid(date)) {
        return format(date, 'yyyy-MM-dd');
    }

    return null;
};


const deserializeEmployee = (row: Record<string, unknown>): Employee | null => {
    const plainObject = row;
    
    const id = String(plainObject.id || '');
    if (!id) return null;

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
        checkInDate: safeFormat(plainObject.checkInDate),
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

const deserializeNonEmployee = (row: Record<string, unknown>): NonEmployee | null => {
    const plainObject = row;

    const id = plainObject.id;
    if (!id) return null;
    
    return {
        id: id as string,
        fullName: (plainObject.fullName || '') as string,
        coordinatorId: (plainObject.coordinatorId || '') as string,
        nationality: (plainObject.nationality || '') as string,
        gender: (plainObject.gender || '') as string,
        address: (plainObject.address || '') as string,
        roomNumber: (plainObject.roomNumber || '') as string,
        checkInDate: safeFormat(plainObject.checkInDate),
        checkOutDate: safeFormat(plainObject.checkOutDate),
        departureReportDate: safeFormat(plainObject.departureReportDate),
        comments: (plainObject.comments || '') as string,
    };
};


export async function getAllData(uid?: string, isAdmin?: boolean) {
    try {
        const allData = await getAllSheetsData(uid, isAdmin);
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
    actor: Coordinator,
    action: 'dodał' | 'zaktualizował' | 'trwale usunął' | 'automatycznie zwolnił' | 'przeniósł',
    entity: (Employee),
    settings: Settings,
    changes: NotificationChange[] = []
) => {
    try {
        const responsibleCoordinator = settings.coordinators.find(c => c.uid === entity.coordinatorId);
        
        let notificationType: NotificationType = 'info';
        const isAddAction = action === 'dodał';
        const isDeleteAction = action === 'trwale usunął';
        const isImportantUpdate = changes.some(c => ['address', 'roomNumber'].includes(c.field));
        
        if (isAddAction) notificationType = 'success';
        if (isDeleteAction) notificationType = 'destructive';
        if (isImportantUpdate) notificationType = 'warning';
        
        const message = `${actor.name} ${action} ${entity.zaklad ? 'pracownika' : 'mieszkańca'} ${entity.fullName}.`;
        
        // 1. Create notification for the responsible coordinator
        if (responsibleCoordinator) {
            const responsibleNotification: Omit<Notification, 'id'> = {
                message,
                entityId: entity.id,
                entityName: entity.fullName,
                recipientId: responsibleCoordinator.uid,
                createdAt: new Date().toISOString(),
                isRead: false,
                type: notificationType,
                changes
            };
            const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
            await sheet.addRow(serializeNotification({ ...responsibleNotification, id: `notif-${Date.now()}-${Math.random()}` }));
        }

        // 2. If it's a critical event, notify all admins
        const shouldNotifyAdmins = isAddAction || isDeleteAction || isImportantUpdate;
        if (shouldNotifyAdmins) {
            const admins = settings.coordinators.filter(c => c.isAdmin);
            const adminNotifications: (Omit<Notification, 'id'> & { id: string })[] = [];
            
            for (const admin of admins) {
                // Avoid duplicating notification if the responsible coordinator is an admin
                if (responsibleCoordinator && admin.uid === responsibleCoordinator.uid) continue;
                // Avoid duplicating notification for the actor if they are an admin
                if (admin.uid === actor.uid) continue;

                adminNotifications.push({
                    id: `notif-admin-${Date.now()}-${Math.random()}`,
                    message,
                    entityId: entity.id,
                    entityName: entity.fullName,
                    recipientId: admin.uid,
                    createdAt: new Date().toISOString(),
                    isRead: false,
                    type: notificationType,
                    changes
                });
            }

            if (adminNotifications.length > 0) {
                const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
                const serializedNotifications = adminNotifications.map(serializeNotification);
                await sheet.addRows(serializedNotifications);
            }
        }
        
        await writeToAuditLog(actor.uid, actor.name, action, 'employee', entity.id, changes);

    } catch (e: unknown) {
        console.error("Could not create notification:", e);
    }
};

const findActor = (actorUid: string | undefined, settings: Settings): Coordinator => {
    if (actorUid === 'system' || !actorUid) {
        return { uid: 'system', name: 'System', isAdmin: true, departments: [] };
    }
    const actor = settings.coordinators.find(c => c.uid === actorUid);
    if (!actor) {
        throw new Error("Could not find acting user.");
    }
    return actor;
}

export async function addEmployee(employeeData: Partial<Employee>, actorUid: string): Promise<void> {
    try {
        const { settings } = await getAllData(actorUid, true);
        const actor = findActor(actorUid, settings);

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
        
        await createNotification(actor, 'dodał', newEmployee, settings);
    } catch (e: unknown) {
        console.error("Error adding employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add employee.");
    }
}


export async function updateEmployee(employeeId: string, updates: Partial<Employee>, actorUid: string): Promise<void> {
    try {
        const { settings } = await getAllData(actorUid, true);
        const actor = findActor(actorUid, settings);

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
            await createNotification(actor, 'zaktualizował', updatedEmployeeData, settings, changes);
        }

    } catch (e: unknown) {
        console.error("Error updating employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update employee.");
    }
}

export async function deleteEmployee(employeeId: string, actorUid: string): Promise<void> {
    try {
        const { settings } = await getAllData(actorUid, true);
        const actor = findActor(actorUid, settings);

        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 2000 });
        const row = rows.find((r) => r.get('id') === employeeId);

        if (!row) {
            throw new Error('Employee not found for deletion.');
        }

        const employeeToDelete = deserializeEmployee(row.toObject());

        await row.delete();

        if (employeeToDelete) {
             await createNotification(actor, 'trwale usunął', employeeToDelete, settings);
        }

    } catch (e: unknown) {
        console.error("Error deleting employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete employee.");
    }
}

export async function addNonEmployee(nonEmployeeData: Omit<NonEmployee, 'id'>, actorUid: string): Promise<void> {
    try {
        await addEmployee({ ...nonEmployeeData, zaklad: null }, actorUid);
    } catch (e: unknown) {
        console.error("Error adding non-employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add non-employee.");
    }
}

export async function updateNonEmployee(id: string, updates: Partial<NonEmployee>, actorUid: string): Promise<void> {
     try {
        await updateEmployee(id, updates, actorUid);
     } catch (e: unknown) {
         console.error("Error updating non-employee:", e);
         throw new Error(e instanceof Error ? e.message : "Failed to update non-employee.");
    }
}

export async function deleteNonEmployee(id: string, actorUid: string): Promise<void> {
    try {
        await deleteEmployee(id, actorUid);
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

        // Deleting rows in reverse order to avoid index shifting issues
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            await rowsToDelete[i].delete();
        }

    } catch (e: unknown) {
        console.error("Error bulk deleting employees:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to bulk delete employees.");
    }
}

export async function bulkDeleteEmployeesByCoordinator(coordinatorId: string, actorUid: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 5000 }); // Increased limit
        const rowsToDelete = rows.filter((row) => row.get('coordinatorId') === coordinatorId);
        
        if (rowsToDelete.length === 0) {
            return;
        }

        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            await rowsToDelete[i].delete();
        }
        
        // Audit logging
        const { settings } = await getAllData(actorUid, true);
        const actor = findActor(actorUid, settings);
        if (actor) {
            const deletedForCoordinator = settings.coordinators.find(c => c.uid === coordinatorId);
            await writeToAuditLog(actor.uid, actor.name, 'bulk-delete-by-coordinator', 'employee', coordinatorId, {
                deletedCount: rowsToDelete.length,
                deletedForCoordinatorName: deletedForCoordinator?.name || coordinatorId
            });
        }

    } catch (e: unknown) {
        console.error("Error bulk deleting employees by coordinator:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to bulk delete employees by coordinator.");
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
            await row.save();
        }

    } catch (e: unknown) {
        console.error("Error transferring employees:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to transfer employees.");
    }
}

export async function checkAndUpdateEmployeeStatuses(actorUid?: string): Promise<{ updated: number }> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 2000 });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let updatedCount = 0;
        const { settings } = await getAllData(actorUid, true);
        const actor = findActor(actorUid, settings);

        for (const row of rows) {
            const status = String(row.get('status'));
            const checkOutDateString = String(row.get('checkOutDate'));
            
            if (status === 'active' && checkOutDateString) {
                const checkOutDate = parseISO(checkOutDateString);
                if (isValid(checkOutDate) && checkOutDate < today) {
                    row.set('status', 'dismissed');
                    await row.save();
                    updatedCount++;

                    const originalEmployee = deserializeEmployee(row.toObject());
                    if (originalEmployee) {
                        await createNotification(actor, 'automatycznie zwolnił', originalEmployee, settings, [
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
             const currentRows = await sheet.getRows();
             
             const toUpdate = newSettings.coordinators.filter(c => currentRows.some(r => r.get('uid') === c.uid));
             const toAdd = newSettings.coordinators.filter(c => !currentRows.some(r => r.get('uid') === c.uid));
             const toDelete = currentRows.filter(r => !newSettings.coordinators.some(c => c.uid === r.get('uid')));
 
             for (const row of toDelete.reverse()) {
                 await row.delete();
             }
 
             for (const coord of toUpdate) {
                 const row = currentRows.find(r => r.get('uid') === coord.uid);
                 if (row) {
                     row.set('name', coord.name);
                     row.set('isAdmin', String(coord.isAdmin).toUpperCase());
                     row.set('departments', coord.departments.join(','));
                     if (coord.password) {
                         row.set('password', coord.password);
                     }
                     await row.save();
                 }
             }
 
             if (toAdd.length > 0) {
                 await sheet.addRows(toAdd.map(c => ({
                     ...c,
                     departments: c.departments.join(','),
                     isAdmin: String(c.isAdmin).toUpperCase()
                 })));
             }
        }

    } catch (error: unknown) {
        console.error("Error updating settings:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to update settings.");
    }
}


export async function markNotificationAsRead(notificationId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
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
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
        await sheet.clearRows();
    } catch (e: unknown) {
        console.error("Could not clear notifications:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to clear notifications.");
    }
}

export async function deleteNotification(notificationId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
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
        const formatDateForReport = (dateString: string | null | undefined): string | null => {
            if (!dateString) return null;
            try {
                return format(parseISO(dateString), 'dd-MM-yyyy');
            } catch {
                return dateString;
            }
        };

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
                const effectiveStart = max([period.start, reportStart]);
                const effectiveEnd = min([period.end, reportEnd]);

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
                        "Data zmiany adresu": formatDateForReport(e.addressChangeDate),
                        "Data zameldowania": formatDateForReport(e.checkInDate),
                        "Data wymeldowania": formatDateForReport(e.checkOutDate),
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


export async function importEmployeesFromExcel(fileContent: string): Promise<{ importedCount: number; totalRows: number; errors: string[] }> {
    const { settings } = await getAllData();
    try {
        const workbook = XLSX.read(fileContent, { type: 'base64', cellDates: false, dateNF: 'dd.mm.yyyy' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Nie znaleziono arkуша в pliku Excel.");

        const worksheet = workbook.Sheets[sheetName];
        
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });

        const errors: string[] = [];
        const employeesToAdd: Partial<Employee>[] = [];
        const newLocalities = new Set<string>();
        
        const coordinatorMap = new Map(
            settings.coordinators.map(c => [c.name.toLowerCase().trim(), c.uid])
        );

        for (const [index, row] of data.entries()) {
            const rowNum = index + 2;
            try {
                const normalizedRow: Record<string, any> = {};
                for (const key in row) {
                    normalizedRow[key.trim().toLowerCase()] = row[key];
                }
                
                const fullName = (normalizedRow['imię i nazwisko'] as string)?.trim();
                if (!fullName) {
                    continue; // Skip row if full name is missing, don't add to errors
                }
                
                const coordinatorName = (normalizedRow['koordynator'] as string)?.toLowerCase().trim();
                const coordinatorId = coordinatorName ? coordinatorMap.get(coordinatorName) : '';
                if (!coordinatorId) {
                     errors.push(`Wiersz ${rowNum} (${fullName}): Nie znaleziono koordynatora '${normalizedRow['koordynator']}'.`);
                     continue;
                }
                
                const locality = (normalizedRow['miejscowość'] as string)?.trim();
                if (locality && !settings.localities.includes(locality)) {
                    newLocalities.add(locality);
                }

                const employeeData: Partial<Employee> = {
                    id: `emp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    status: 'active',
                    fullName: fullName,
                    coordinatorId: coordinatorId,
                    nationality: (normalizedRow['narodowość'] as string)?.trim(),
                    gender: (normalizedRow['płeć'] as string)?.trim(),
                    address: (normalizedRow['adres'] as string)?.trim(),
                    roomNumber: String(normalizedRow['pokój'] || '').trim(),
                    zaklad: (normalizedRow['zakład'] as string)?.trim() || null,
                    checkInDate: safeFormat(normalizedRow['data zameldowania']),
                    checkOutDate: safeFormat(normalizedRow['data wymeldowania']),
                    contractStartDate: safeFormat(normalizedRow['umowa od']),
                    contractEndDate: safeFormat(normalizedRow['umowa do']),
                    comments: (normalizedRow['komentarze'] as string)?.trim(),
                };
                
                employeesToAdd.push(employeeData);

            } catch (rowError) {
                errors.push(`Wiersz ${rowNum} (${(row['Imię i nazwisko'] as string) || 'Brak Imienia'}): ${rowError instanceof Error ? rowError.message : 'Nieznany błąd'}.`);
            }
        }

        if (employeesToAdd.length > 0) {
            const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
            const serializedRows = employeesToAdd.map(emp => serializeEmployee(emp));
            await sheet.addRows(serializedRows);
        }
        
        if (newLocalities.size > 0) {
            const updatedLocalities = [...new Set([...settings.localities, ...Array.from(newLocalities)])];
            await updateSettings({ localities: updatedLocalities });
        }
        
        return { importedCount: employeesToAdd.length, totalRows: data.length, errors };

    } catch (e) {
        console.error("Error importing from Excel:", e);
        if (e instanceof Error) {
            return { importedCount: 0, totalRows: 0, errors: [e.message] };
        }
        return { importedCount: 0, totalRows: 0, errors: ["Wystąpił nieznany błąd podczas importu."] };
    }
}
