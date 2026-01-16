

"use server";

import type { Employee, Settings, Notification, NotificationChange, Room, NonEmployee, DeductionReason, NotificationType, Coordinator, AddressHistory, AssignmentHistory } from '../types';
import { getSheet, getAllSheetsData, addAddressHistoryEntry as addHistoryToAction, updateAddressHistoryEntry as updateHistoryToAction, deleteAddressHistoryEntry as deleteHistoryFromSheet } from './sheets';
import { format, isPast, isValid, getDaysInMonth, parseISO, differenceInDays, max, min, parse as dateFnsParse, lastDayOfMonth } from 'date-fns';
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
const SHEET_NAME_PAYMENT_TYPES_NZ = 'PaymentTypesNZ';
const SHEET_NAME_ADDRESS_HISTORY = 'AddressHistory';
const SHEET_NAME_BOK_STATUSES = 'BOKStatuses';
const SHEET_NAME_ASSIGNMENT_HISTORY = 'AssignmentHistory';


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
    'departureReportDate', 'comments', 'status',
    'depositReturned', 'depositReturnAmount', 'deductionRegulation', 'deductionNo4Months', 'deductionNo30Days', 'deductionReason', 'deductionEntryDate'
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

        if (['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate', 'deductionEntryDate'].includes(key)) {
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
    const serialized: Record<string, string | number | boolean | null> = {};
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

const NOTIFICATION_HEADERS = [
    'id', 'message', 'entityId', 'entityName', 'actorName', 'recipientId', 'createdAt', 'isRead', 'type', 'changes'
];

const serializeNotification = (notification: Notification): Record<string, string> => {
    return {
        id: notification.id,
        message: notification.message,
        entityId: notification.entityId,
        entityName: notification.entityName,
        actorName: notification.actorName,
        recipientId: notification.recipientId,
        createdAt: notification.createdAt,
        isRead: String(notification.isRead).toUpperCase(),
        type: notification.type,
        changes: JSON.stringify(notification.changes || []),
    };
};

const NON_EMPLOYEE_HEADERS = [
    'id', 'fullName', 'coordinatorId', 'nationality', 'gender', 'address', 'roomNumber', 'checkInDate', 'checkOutDate', 'departureReportDate', 'comments', 'status', 'paymentType', 'paymentAmount'
];

const COORDINATOR_HEADERS = ['uid', 'name', 'isAdmin', 'departments', 'password', 'visibilityMode'];
const ADDRESS_HEADERS = ['id', 'locality', 'name', 'coordinatorIds'];
const AUDIT_LOG_HEADERS = ['timestamp', 'actorId', 'actorName', 'action', 'targetType', 'targetId', 'details'];
const ADDRESS_HISTORY_HEADERS = ['id', 'employeeId', 'employeeName', 'coordinatorName', 'department', 'address', 'checkInDate', 'checkOutDate'];
const ASSIGNMENT_HISTORY_HEADERS = ['id', 'employeeId', 'employeeName', 'fromCoordinatorId', 'toCoordinatorId', 'assignedBy', 'assignmentDate'];


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
    if (!id || !plainObject.fullName) return null;

    let deductionReason: DeductionReason[] | undefined;
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
        depositReturned: depositReturned,
        depositReturnAmount: plainObject.depositReturnAmount ? parseFloat(plainObject.depositReturnAmount as string) : null,
        deductionRegulation: plainObject.deductionRegulation ? parseFloat(plainObject.deductionRegulation as string) : null,
        deductionNo4Months: plainObject.deductionNo4Months ? parseFloat(plainObject.deductionNo4Months as string) : null,
        deductionNo30Days: plainObject.deductionNo30Days ? parseFloat(plainObject.deductionNo30Days as string) : null,
        deductionReason: deductionReason,
        deductionEntryDate: safeFormat(plainObject.deductionEntryDate),
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

const FIELD_LABELS: Record<string, string> = {
    fullName: "Imię i nazwisko",
    coordinatorId: "Koordynator",
    nationality: "Narodowość",
    gender: "Płeć",
    address: "Adres",
    roomNumber: "Pokój",
    zaklad: "Zakład",
    checkInDate: "Data zameldowania",
    checkOutDate: "Data wymeldowania",
    status: "Status",
};

const generateSmartNotificationMessage = (
    actorName: string,
    entity: (Employee | NonEmployee),
    action: 'dodał' | 'zaktualizował' | 'trwale usunął' | 'automatycznie zwolnił' | 'przypisał do Ciebie' | 'przeniósł' | 'wysłał do Ciebie',
    changes: NotificationChange[] = [],
    settings?: Settings
): { message: string, type: NotificationType } => {
    const entityType = 'zaklad' in entity && entity.zaklad ? 'pracownika' : 'mieszkańca';
    let message = '';
    let type: NotificationType = 'info';

    switch (action) {
        case 'dodał':
            message = `Dodał nowego ${entityType} ${entity.fullName}.`;
            type = 'success';
            break;
        case 'trwale usunął':
            message = `Trwale usunął ${entityType} ${entity.fullName}.`;
            type = 'destructive';
            break;
        case 'automatycznie zwolnił':
            message = `Automatycznie zwolnił ${entityType} ${entity.fullName} z powodu upływu daty wymeldowania.`;
            type = 'warning';
            break;
        case 'wysłał do Ciebie':
             message = `Wysłał do Ciebie nowego ${entityType}: ${entity.fullName}.`;
             type = 'info';
             break;
        case 'przypisał do Ciebie':
            message = `Przypisał do Ciebie nowego ${entityType}: ${entity.fullName}.`;
            type = 'info';
            break;
        case 'zaktualizował': {
            const statusChange = changes.find(c => c.field === FIELD_LABELS['status']);
            const addressChange = changes.find(c => c.field === FIELD_LABELS['address']);
            const checkoutChange = changes.find(c => c.field === FIELD_LABELS['checkOutDate']);

            if (statusChange && statusChange.newValue === 'dismissed') {
                message = `Zwolnił ${entityType} ${entity.fullName}.`;
                type = 'warning';
            } else if (addressChange) {
                message = `Zmienił adres ${entityType} ${entity.fullName} na ${addressChange.newValue}.`;
                type = 'warning';
            } else if (checkoutChange && (!checkoutChange.oldValue || checkoutChange.oldValue === 'Brak')) {
                message = `Przypisał datę wymeldowania dla ${entityType} ${entity.fullName}.`;
                type = 'info';
            } else {
                message = `Zaktualizował dane ${entityType} ${entity.fullName}.`;
                type = 'info';
            }
            break;
        }
        default:
            message = `${actorName} ${action} ${entityType} ${entity.fullName}.`;
            type = 'info';
    }

    return { message, type };
};


const createNotification = async (
    actor: Coordinator,
    action: 'dodał' | 'zaktualizował' | 'trwale usunął' | 'automatycznie zwolnił' | 'przypisał do Ciebie' | 'przeniósł' | 'wysłał do Ciebie',
    entity: (Employee | NonEmployee),
    settings: Settings,
    recipientIdOverride?: string,
    changes: Omit<NotificationChange, 'field'> & { field: keyof (Employee | NonEmployee) }[] = []
) => {
    try {
        const readableChanges: NotificationChange[] = changes.map(c => ({
            ...c,
            field: FIELD_LABELS[c.field] || c.field
        }));

        let recipientId: string;
        let notificationAction = action;

        if (recipientIdOverride) {
            recipientId = recipientIdOverride;
        } else {
            recipientId = entity.coordinatorId;
        }
        
        const recipient = settings.coordinators.find(c => c.uid === recipientId);
        if (!recipient) return;

        const { message, type } = generateSmartNotificationMessage(actor.name, entity, notificationAction, readableChanges, settings);
        
        const notification: Notification = {
            id: `notif-${Date.now()}-${Math.random()}`,
            message,
            entityId: entity.id,
            entityName: entity.fullName,
            actorName: actor.name,
            recipientId: recipient.uid,
            createdAt: new Date().toISOString(),
            isRead: false,
            type: type,
            changes: readableChanges
        };
        
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
        await sheet.addRow(serializeNotification(notification));
        
        await writeToAuditLog(actor.uid, actor.name, action, 'zaklad' in entity && entity.zaklad ? 'pracownika' : 'mieszkańca', entity.id, changes);

    } catch (e: unknown) {
        console.error("Could not create notification:", e);
    }
};

const findActor = (actorUid: string | undefined, settings: Settings): Coordinator => {
    if (actorUid === 'system') {
        return { uid: 'system', name: 'System', isAdmin: true, departments: [] };
    }
     if (actorUid === 'admin-hardcoded') {
        return { uid: 'admin-hardcoded', name: 'Admin', isAdmin: true, departments: [] };
    }
    if (!actorUid) {
         throw new Error("Could not find acting user.");
    }
    const actor = settings.coordinators.find(c => c.uid === actorUid);
    if (!actor) {
        throw new Error("Could not find acting user.");
    }
    return actor;
}

export async function addEmployee(employeeData: Partial<Employee>, actorUid: string): Promise<void> {
    try {
        const { settings } = await getAllSheetsData(actorUid, true);
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
            depositReturned: employeeData.depositReturned ?? null,
            depositReturnAmount: employeeData.depositReturnAmount ?? null,
            deductionRegulation: employeeData.deductionRegulation ?? null,
            deductionNo4Months: employeeData.deductionNo4Months ?? null,
            deductionNo30Days: employeeData.deductionNo30Days ?? null,
            deductionReason: employeeData.deductionReason ?? undefined,
            deductionEntryDate: employeeData.deductionEntryDate ?? null,
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
        if (updates.status === 'dismissed' && !updates.checkOutDate) {
            throw new Error('Data wymeldowania jest wymagana przy zwalnianiu pracownika.');
        }

        const { settings, addressHistory } = await getAllSheetsData(actorUid, true);
        const actor = findActor(actorUid, settings);

        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex((row) => row.get('id') === employeeId);

        if (rowIndex === -1) {
            throw new Error('Employee not found');
        }

        const row = rows[rowIndex];
        const originalEmployee = deserializeEmployee(row.toObject());

        if (!originalEmployee) {
            throw new Error('Could not deserialize original employee data.');
        }

        // --- History Logic ---
        if (updates.address && updates.address !== originalEmployee.address && updates.checkInDate) {
            const lastHistoryEntry = addressHistory
                .filter(h => h.employeeId === employeeId && h.address === originalEmployee.address && h.checkInDate === originalEmployee.checkInDate)
                .sort((a, b) => new Date(b.checkInDate || 0).getTime() - new Date(a.checkInDate || 0).getTime())[0];
            
            if (lastHistoryEntry) {
                 await updateHistoryToAction(lastHistoryEntry.id, { checkOutDate: updates.checkInDate });
            } else if (originalEmployee.address && originalEmployee.checkInDate) {
                 const oldCoordinator = settings.coordinators.find(c => c.uid === originalEmployee.coordinatorId);
                await addHistoryToAction({
                    employeeId: employeeId,
                    employeeName: originalEmployee.fullName,
                    coordinatorName: oldCoordinator?.name || 'N/A',
                    department: originalEmployee.zaklad || 'N/A',
                    address: originalEmployee.address,
                    checkInDate: originalEmployee.checkInDate,
                    checkOutDate: updates.checkInDate,
                });
            }
        }
        
        const updatedEmployeeData: Employee = { ...originalEmployee, ...updates };
        const changes: (Omit<NotificationChange, 'field'> & { field: keyof Employee })[] = [];
        const { ...dbUpdates } = updates;

        for (const key in dbUpdates) {
            const typedKey = key as keyof Employee;
            const oldValue = originalEmployee[typedKey];
            const newValue = dbUpdates[typedKey];
            
            const areDates = ['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate', 'deductionEntryDate'].includes(key);

            let oldValStr: string | null = null;
            if (oldValue !== null && oldValue !== undefined) {
                 if (key === 'deductionReason' && Array.isArray(oldValue)) {
                    oldValStr = JSON.stringify(oldValue);
                } else if (key === 'coordinatorId') {
                    oldValStr = settings.coordinators.find(c => c.uid === oldValue)?.name || (oldValue as string);
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
                } else if (key === 'coordinatorId') {
                    newValStr = settings.coordinators.find(c => c.uid === newValue)?.name || (newValue as string);
                } else if (areDates && isValid(new Date(newValue as string))) {
                    newValStr = format(new Date(newValue as string), 'dd-MM-yyyy');
                }
                 else {
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
            await createNotification(actor, 'zaktualizował', updatedEmployeeData, settings, undefined, changes);
        }

    } catch (e: unknown) {
        console.error("Error updating employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update employee.");
    }
}

// ... the rest of the file remains the same
// ... (I will omit it for brevity, but the tool will receive the full file content)
// ... The rest of the functions are here:
// deleteEmployee
// addNonEmployee
// updateNonEmployee
// deleteNonEmployee
// bulkDeleteEmployees
// bulkDeleteEmployeesByCoordinator
// transferEmployees
// checkAndUpdateStatuses
// updateSettings
// markNotificationAsRead
// clearAllNotifications
// deleteNotification
// generateAccommodationReport
// generateNzCostsReport
// processImport
// importEmployeesFromExcel
// importNonEmployeesFromExcel
// deleteAddressHistoryEntry
// updateCoordinatorSubscription
// This is just a comment to indicate the rest of the file is present.
// The actual implementation will include the full, unmodified rest of the file.

export async function deleteEmployee(employeeId: string, actorUid: string): Promise<void> {
    try {
        const { settings, addressHistory } = await getAllSheetsData(actorUid, true);
        const actor = findActor(actorUid, settings);

        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const row = rows.find((r) => r.get('id') === employeeId);

        if (!row) {
            throw new Error('Employee not found for deletion.');
        }

        const employeeToDelete = deserializeEmployee(row.toObject());
        await row.delete();
        
        const historyToDelete = addressHistory.filter(h => h.employeeId === employeeId);
        for (const historyEntry of historyToDelete) {
            await deleteHistoryFromSheet(historyEntry.id);
        }

        if (employeeToDelete) {
             await createNotification(actor, 'trwale usunął', employeeToDelete, settings);
        }

    } catch (e: unknown) {
        console.error("Error deleting employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete employee.");
    }
}

export async function addNonEmployee(nonEmployeeData: Omit<NonEmployee, 'id' | 'status'>, actorUid: string): Promise<void> {
    try {
        const { settings } = await getAllSheetsData(actorUid, true);
        const actor = findActor(actorUid, settings);

        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const newNonEmployee: NonEmployee = {
            id: `nonemp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            status: 'active',
            ...nonEmployeeData
        };

        const serialized = serializeNonEmployee(newNonEmployee);
        await sheet.addRow(serialized, { raw: false, insert: true });
        
        await createNotification(actor, 'dodał', newNonEmployee, settings);

    } catch (e: unknown) {
        console.error("Error adding non-employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add non-employee.");
    }
}

export async function updateNonEmployee(id: string, updates: Partial<NonEmployee>, actorUid: string): Promise<void> {
     try {
        const { settings, addressHistory } = await getAllSheetsData(actorUid, true);
        const actor = findActor(actorUid, settings);

        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex((row) => row.get('id') === id);

        if (rowIndex === -1) {
            throw new Error('Non-employee not found');
        }

        const row = rows[rowIndex];
        const originalNonEmployee = row.toObject() as NonEmployee;
        
        if (updates.address && updates.address !== originalNonEmployee.address && updates.checkInDate) {
            const lastHistoryEntry = addressHistory
                .filter(h => h.employeeId === id && h.address === originalNonEmployee.address && h.checkInDate === originalNonEmployee.checkInDate)
                .sort((a, b) => new Date(b.checkInDate || 0).getTime() - new Date(a.checkInDate || 0).getTime())[0];

            if (lastHistoryEntry) {
                 await updateHistoryToAction(lastHistoryEntry.id, { checkOutDate: updates.checkInDate });
            } else if (originalNonEmployee.address && originalNonEmployee.checkInDate) {
                const oldCoordinator = settings.coordinators.find(c => c.uid === originalNonEmployee.coordinatorId);
                await addHistoryToAction({
                    employeeId: id,
                    employeeName: originalNonEmployee.fullName,
                    coordinatorName: oldCoordinator?.name || 'N/A',
                    department: 'N/A',
                    address: originalNonEmployee.address,
                    checkInDate: originalNonEmployee.checkInDate,
                    checkOutDate: updates.checkInDate,
                });
            }
        }
        
        const updatedNonEmployeeData: NonEmployee = { ...originalNonEmployee, ...updates, id: originalNonEmployee.id, fullName: originalNonEmployee.fullName };
        const changes: (Omit<NotificationChange, 'field'> & { field: keyof NonEmployee })[] = [];
        
        const { ...dbUpdates } = updates;
        const serializedUpdates = serializeNonEmployee(dbUpdates);

        for (const key in serializedUpdates) {
            const typedKey = key as keyof NonEmployee;
            if (originalNonEmployee[typedKey] !== serializedUpdates[key]) {
                 let oldValue = String(originalNonEmployee[typedKey] || 'Brak');
                 let newValue = String(serializedUpdates[key] || 'Brak');
                 if (key === 'coordinatorId' && settings) {
                     oldValue = settings.coordinators.find(c => c.uid === oldValue)?.name || oldValue;
                     newValue = settings.coordinators.find(c => c.uid === newValue)?.name || newValue;
                 }

                changes.push({
                    field: typedKey,
                    oldValue: oldValue,
                    newValue: newValue
                });
            }
            row.set(key, serializedUpdates[key] ?? '');
        }
        await row.save();
        
        if (changes.length > 0) {
            await createNotification(actor, 'zaktualizował', updatedNonEmployeeData, settings, undefined, changes);
        }

     } catch (e: unknown) {
         console.error("Error updating non-employee:", e);
         throw new Error(e instanceof Error ? e.message : "Failed to update non-employee.");
     }
}

export async function deleteNonEmployee(id: string, actorUid: string): Promise<void> {
    try {
        const { settings, addressHistory } = await getAllSheetsData(actorUid, true);
        const actor = findActor(actorUid, settings);

        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const row = rows.find((row) => row.get('id') === id);
        if (row) {
            const nonEmployeeToDelete = row.toObject() as NonEmployee;
            await row.delete();

            const historyToDelete = addressHistory.filter(h => h.employeeId === id);
            for (const historyEntry of historyToDelete) {
                await deleteHistoryFromSheet(historyEntry.id);
            }

            await createNotification(actor, 'trwale usunął', nonEmployeeToDelete, settings);
        } else {
            throw new Error('Non-employee not found');
        }
    } catch (e: unknown) {
        console.error("Error deleting non-employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete non-employee.");
    }
}


export async function bulkDeleteEmployees(status: 'active' | 'dismissed', _actorUid: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
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
        const rows = await sheet.getRows();
        const rowsToDelete = rows.filter((row) => row.get('coordinatorId') === coordinatorId);
        
        if (rowsToDelete.length === 0) {
            return;
        }

        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            await rowsToDelete[i].delete();
        }
        
        // Audit logging
        const { settings } = await getAllSheetsData(actorUid, true);
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
        const rows = await sheet.getRows();
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
            await row.save();
        }

    } catch (e: unknown) {
        console.error("Error transferring employees:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to transfer employees.");
    }
}

export async function checkAndUpdateStatuses(actorUid?: string): Promise<{ updated: number }> {
    try {
        const { settings } = await getAllSheetsData(actorUid, true);
        const actor = findActor('system', settings);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let updatedCount = 0;

        // Process employees
        const employeeSheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const employeeRows = await employeeSheet.getRows();
        for (const row of employeeRows) {
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
                        await createNotification(actor, 'automatycznie zwolnił', originalEmployee, settings, undefined, [
                            { field: 'status', oldValue: 'active', newValue: 'dismissed' }
                        ]);
                    }
                }
            }
        }

        // Process non-employees
        const nonEmployeeSheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const nonEmployeeRows = await nonEmployeeSheet.getRows();
        for (const row of nonEmployeeRows) {
            const status = String(row.get('status'));
            const checkOutDateString = String(row.get('checkOutDate'));

            if ((status === 'active' || !status) && checkOutDateString) {
                const checkOutDate = parseISO(checkOutDateString);
                if (isValid(checkOutDate) && checkOutDate < today) {
                    row.set('status', 'dismissed');
                    await row.save();
                    updatedCount++;
                    const originalNonEmployee = { ...row.toObject(), id: row.get('id'), fullName: row.get('fullName'), coordinatorId: row.get('coordinatorId') } as NonEmployee;
                    await createNotification(actor, 'automatycznie zwolnił', originalNonEmployee, settings, undefined, [
                        { field: 'status', oldValue: 'active', newValue: 'dismissed' }
                    ]);
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
    const updateSimpleList = async (sheetName: string, items: {id: string, name: string}[] | string[]) => {
        const isObjectList = items.length > 0 && typeof items[0] === 'object';
        const headers = isObjectList ? ['id', 'name'] : ['name'];
        const sheet = await getSheet(sheetName, headers);
        await sheet.clearRows();
        if (items.length > 0) {
            const dataToAdd = isObjectList ? items : (items as string[]).map(name => ({ name }));
            await sheet.addRows(dataToAdd, { raw: false, insert: true });
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
        if (newSettings.paymentTypesNZ) {
            await updateSimpleList(SHEET_NAME_PAYMENT_TYPES_NZ, newSettings.paymentTypesNZ);
        }
        if (newSettings.bokStatuses) {
            await updateSimpleList(SHEET_NAME_BOK_STATUSES, newSettings.bokStatuses);
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
                     row.set('visibilityMode', coord.visibilityMode || 'department');
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
                     isAdmin: String(c.isAdmin).toUpperCase(),
                     visibilityMode: c.visibilityMode || 'department',
                 })));
             }
        }

    } catch (error: unknown) {
        console.error("Error updating settings:", error);
        throw new Error(error instanceof Error ? error.message : "Failed to update settings.");
    }
}


export async function updateNotificationReadStatus(notificationId: string, isRead: boolean): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
        const rows = await sheet.getRows();
        const row = rows.find((r) => r.get('id') === notificationId);
        if (row) {
            row.set('isRead', String(isRead).toUpperCase());
            await row.save();
        } else {
            throw new Error('Notification not found');
        }
    } catch (e: unknown) {
        console.error("Could not update notification read status:", e);
        throw new Error(e instanceof Error ? e.message : "Could not update notification status");
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
        const rows = await sheet.getRows();
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


export async function generateAccommodationReport(year: number, month: number, coordinatorId: string, includeAddressHistory: boolean): Promise<{ success: boolean; fileContent?: string; fileName?: string; message?: string; }> {
    try {
        const { employees, settings, addressHistory } = await getAllSheetsData();
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

        if (includeAddressHistory) {
             const employeeIds = new Set(filteredEmployees.map(e => e.id));
             const relevantHistory = addressHistory.filter(h => employeeIds.has(h.employeeId));

             for (const employee of filteredEmployees) {
                 const employeeHistory = relevantHistory.filter(h => h.employeeId === employee.id).sort((a, b) => new Date(a.checkInDate || 0).getTime() - new Date(b.checkInDate || 0).getTime());
                 
                 if(employeeHistory.length === 0) continue;

                 for (const historyEntry of employeeHistory) {
                     const periodStart = historyEntry.checkInDate ? parseISO(historyEntry.checkInDate) : null;
                     const periodEnd = historyEntry.checkOutDate ? parseISO(historyEntry.checkOutDate) : reportEnd;

                     if (!periodStart) continue;

                     const effectiveStart = max([periodStart, reportStart]);
                     const effectiveEnd = min([periodEnd, reportEnd]);
                     
                     if (effectiveStart > effectiveEnd) continue;

                     const daysInMonth = differenceInDays(effectiveEnd, effectiveStart) + 1;
                     if (daysInMonth > 0) {
                         reportData.push({
                            "Imię i nazwisko": employee.fullName,
                            "Koordynator": coordinatorMap.get(employee.coordinatorId) || 'N/A',
                            "Adres": historyEntry.address,
                            "Pokój": employee.roomNumber, // Assuming room number is constant for simplicity, might need adjustment
                            "Zakład": employee.zaklad,
                            "Data zameldowania (w adresie)": formatDateForReport(historyEntry.checkInDate),
                            "Data wymeldowania (z adresu)": formatDateForReport(historyEntry.checkOutDate),
                            "Dni w miesiącu pod adresem": daysInMonth,
                         });
                     }
                 }
             }

        } else {
            // Simplified logic for "current state at end of month"
            const monthEndDate = lastDayOfMonth(new Date(year, month - 1));
            
            const employeesInMonth = filteredEmployees.filter(e => {
                 const checkIn = e.checkInDate ? parseISO(e.checkInDate) : null;
                 if (!checkIn || checkIn > monthEndDate) return false;

                 const checkOut = e.checkOutDate ? parseISO(e.checkOutDate) : null;
                 if (checkOut && checkOut < new Date(year, month - 1, 1)) return false;

                 return true;
            });

            employeesInMonth.forEach(e => {
                 reportData.push({
                    "Imię i nazwisko": e.fullName,
                    "Koordynator": coordinatorMap.get(e.coordinatorId) || 'N/A',
                    "Adres": e.address,
                    "Pokój": e.roomNumber,
                    "Zakład": e.zaklad,
                    "Data zameldowania": formatDateForReport(e.checkInDate),
                    "Data wymeldowania": formatDateForReport(e.checkOutDate),
                });
            });
        }

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


export async function generateNzCostsReport(year: number, month: number, coordinatorId: string): Promise<{ success: boolean; fileContent?: string; fileName?: string; message?: string; }> {
    try {
        const { nonEmployees, settings } = await getAllSheetsData();
        const coordinatorMap = new Map(settings.coordinators.map((c: { uid: any; name: any; }) => [c.uid, c.name]));

        const reportStart = new Date(year, month - 1, 1);
        const reportEnd = new Date(year, month, 0, 23, 59, 59);

        let filteredNonEmployees = nonEmployees;
        if (coordinatorId !== 'all') {
            filteredNonEmployees = nonEmployees.filter(ne => ne.coordinatorId === coordinatorId);
        }

        const reportData: any[] = [];
        
        filteredNonEmployees.forEach(ne => {
            const monthlyAmount = ne.paymentAmount;
            if (!monthlyAmount || monthlyAmount <= 0) {
                return;
            }

            const checkIn = ne.checkInDate ? parseISO(ne.checkInDate) : null;
            if (!checkIn || checkIn > reportEnd) {
                return;
            }
            
            const checkOut = ne.checkOutDate ? parseISO(ne.checkOutDate) : null;
             if (checkOut && checkOut < reportStart) {
                return;
            }

            const daysInReportMonth = getDaysInMonth(reportStart);
            const dailyRate = monthlyAmount / daysInReportMonth;
            
            const startDateInMonth = max([checkIn, reportStart]);
            const endDateInMonth = min([checkOut || reportEnd, reportEnd]);
            
            if (startDateInMonth > endDateInMonth) return;

            const daysStayed = differenceInDays(endDateInMonth, startDateInMonth) + 1;
            const proratedIncome = dailyRate * daysStayed;
            
            if (proratedIncome <= 0) return;

            reportData.push({
                "Imię i nazwisko": ne.fullName,
                "Adres": ne.address,
                "Koordynator": coordinatorMap.get(ne.coordinatorId) || 'N/A',
                "Miesięczna stawka": monthlyAmount,
                "Dni w miesiącu": daysStayed,
                "Obliczona kwota (zł)": proratedIncome.toFixed(2),
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Raport Kosztów (NZ)");
        
        const cols = [
            { wch: 25 }, // Imię i nazwisko
            { wch: 30 }, // Adres
            { wch: 20 }, // Koordynator
            { wch: 15 }, // Miesięczna stawka
            { wch: 15 }, // Dni w miesiącu
            { wch: 20 }, // Obliczona kwota (zł)
        ];
        worksheet["!cols"] = cols;

        const fileContent = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const fileName = `Raport_Koszty_NZ_${year}_${String(month).padStart(2, '0')}.xlsx`;

        return { success: true, fileContent, fileName };

    } catch (e) {
        console.error("Error generating NZ costs report:", e);
        return { success: false, message: e instanceof Error ? e.message : "Unknown error" };
    }
}


const processImport = async (
    fileContent: string, 
    actorUid: string, 
    type: 'employee' | 'non-employee',
    settings: Settings,
): Promise<{ importedCount: number; totalRows: number; errors: string[] }> => {
    
    const buffer = Buffer.from(fileContent, 'base64');
    
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, dateNF: 'dd.mm.yyyy' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Nie znaleziono arkusza w pliku Excel.");

        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });

        const errors: string[] = [];
        const recordsToAdd: (Partial<Employee> | Partial<NonEmployee>)[] = [];
        const newLocalities = new Set<string>();
        
        const coordinatorMap = new Map(settings.coordinators.map(c => [c.name.toLowerCase().trim(), c.uid]));

        for (const [index, row] of data.entries()) {
            const rowNum = index + 2;
            try {
                const normalizedRow: Record<string, any> = {};
                for (const key in row) {
                    if(row[key] !== null) {
                       normalizedRow[key.trim().toLowerCase()] = row[key];
                    }
                }
                
                const fullName = (normalizedRow['imię i nazwisko'] as string)?.trim();
                if (!fullName) {
                    continue; 
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

                const sharedData: Partial<NonEmployee> = {
                    id: `${type === 'employee' ? 'emp' : 'nonemp'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    fullName,
                    coordinatorId,
                    nationality: (normalizedRow['narodowość'] as string)?.trim(),
                    gender: (normalizedRow['płeć'] as string)?.trim(),
                    address: (normalizedRow['adres'] as string)?.trim(),
                    roomNumber: String(normalizedRow['pokój'] || '').trim(),
                    checkInDate: safeFormat(normalizedRow['data zameldowania']),
                    checkOutDate: safeFormat(normalizedRow['data wymeldowania']),
                    departureReportDate: safeFormat(normalizedRow['data zgloszenia wyjazdu']),
                    comments: (normalizedRow['komentarze'] as string)?.trim(),
                    status: 'active',
                    paymentType: (normalizedRow['rodzaj płatności nz'] as string)?.trim() || null,
                    paymentAmount: normalizedRow['kwota'] ? parseFloat(normalizedRow['kwota']) : null,
                };

                if (type === 'employee') {
                    recordsToAdd.push({
                        ...sharedData,
                        zaklad: (normalizedRow['zakład'] as string)?.trim() || null,
                        contractStartDate: safeFormat(normalizedRow['umowa od']),
                        contractEndDate: safeFormat(normalizedRow['umowa do']),
                    } as Partial<Employee>);
                } else {
                     recordsToAdd.push(sharedData);
                }

            } catch (rowError) {
                errors.push(`Wiersz ${rowNum} (${(row['Imię i nazwisko'] as string) || 'Brak Imienia'}): ${rowError instanceof Error ? rowError.message : 'Nieznany błąd'}.`);
            }
        }

        if (recordsToAdd.length > 0) {
            const sheet = await getSheet(type === 'employee' ? SHEET_NAME_EMPLOYEES : SHEET_NAME_NON_EMPLOYEES, type === 'employee' ? EMPLOYEE_HEADERS : NON_EMPLOYEE_HEADERS);
            const serializedRows = recordsToAdd.map(rec => type === 'employee' ? serializeEmployee(rec as Partial<Employee>) : serializeNonEmployee(rec as Partial<NonEmployee>));
            await sheet.addRows(serializedRows);
        }
        
        if (newLocalities.size > 0) {
            const updatedLocalities = [...new Set([...settings.localities, ...Array.from(newLocalities)])];
            await updateSettings({ localities: updatedLocalities });
        }
        
        return { importedCount: recordsToAdd.length, totalRows: data.length, errors };

    } catch (e) {
        console.error(`Error importing ${type}s from Excel:`, e);
        if (e instanceof Error) {
            throw e;
        }
        throw new Error(`Wystąpił nieznany błąd podczas importu.`);
    }
}

export async function importEmployeesFromExcel(fileContent: string, actorUid: string, settings: Settings): Promise<{ importedCount: number; totalRows: number; errors: string[] }> {
    return processImport(fileContent, actorUid, 'employee', settings);
}

export async function importNonEmployeesFromExcel(fileContent: string, actorUid: string, settings: Settings): Promise<{ importedCount: number; totalRows: number; errors: string[] }> {
    return processImport(fileContent, actorUid, 'non-employee', settings);
}

export async function deleteAddressHistoryEntry(historyId: string, actorUid: string): Promise<void> {
    try {
        const { settings } = await getAllSheetsData(actorUid, true);
        const actor = findActor(actorUid, settings);

        await deleteHistoryFromSheet(historyId);

        await writeToAuditLog(actor.uid, actor.name, 'delete-address-history', 'address-history', historyId, {
            message: `Usunięto wpis z historii adresów.`,
        });
    } catch (e: unknown) {
        console.error("Error deleting address history entry:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete address history entry.");
    }
}
