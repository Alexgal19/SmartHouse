"use server";

import type { Employee, Settings, Notification, NotificationChange, NonEmployee, DeductionReason, NotificationType, Coordinator, BokResident } from '../types';
import { revalidatePath } from 'next/cache';
import {
    getSheet,
    getSettings,
    getEmployees,
    getNonEmployees,
    getRawAddressHistory,
    addAddressHistoryEntry as addHistoryToAction,
    updateAddressHistoryEntry as updateHistoryToAction,
    deleteAddressHistoryEntry as deleteHistoryFromSheet,
    invalidateEmployeesCache,
    invalidateNonEmployeesCache,
    invalidateBokResidentsCache,
    invalidateSettingsCache,
    withTimeout
} from './sheets';
import { format, isValid, getDaysInMonth, parseISO, differenceInDays, max, min, parse as dateFnsParse, lastDayOfMonth } from 'date-fns';

const TIMEOUT_MS = 45000;
import * as XLSX from 'xlsx';
import { adminMessaging } from './firebase-admin';
import { batchPromises } from './utils';

const EMPLOYEE_HEADERS = [
    'id', 'firstName', 'lastName', 'fullName', 'coordinatorId', 'nationality', 'gender', 'address', 'ownAddress', 'roomNumber',
    'zaklad', 'checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate',
    'departureReportDate', 'comments', 'status', 'depositReturned', 'depositReturnAmount',
    'deductionRegulation', 'deductionNo4Months', 'deductionNo30Days', 'deductionReason', 'deductionEntryDate'
];

const NON_EMPLOYEE_HEADERS = [
    'id', 'firstName', 'lastName', 'fullName', 'coordinatorId', 'nationality', 'gender', 'address', 'roomNumber',
    'checkInDate', 'checkOutDate', 'departureReportDate', 'comments', 'status', 'paymentType',
    'paymentAmount'
];

const BOK_RESIDENT_HEADERS = [
    'id', 'role', 'firstName', 'lastName', 'fullName', 'coordinatorId', 'nationality', 'address', 'roomNumber',
    'zaklad', 'gender', 'checkInDate', 'checkOutDate', 'returnStatus', 'status', 'comments', 'sendDate', 'dismissDate'
];

const SHEET_NAME_EMPLOYEES = 'Employees';
const SHEET_NAME_NON_EMPLOYEES = 'NonEmployees';
const SHEET_NAME_BOK_RESIDENTS = 'BokResidents';
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
const SHEET_NAME_STATUSES = 'Statuses';
const SHEET_NAME_BOK_ROLES = 'BokRoles';
const SHEET_NAME_BOK_RETURN_OPTIONS = 'BokReturnOptions';


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

const serializeEmployee = (employee: Partial<Employee>): Record<string, string | number | boolean> => {
    const serialized: Record<string, string | number | boolean> = {};

    const dataToWrite = { ...employee };
    if (dataToWrite.firstName || dataToWrite.lastName) {
        dataToWrite.fullName = `${dataToWrite.lastName || ''} ${dataToWrite.firstName || ''}`.trim();
    }

    for (const key of EMPLOYEE_HEADERS) {
        const typedKey = key as keyof Employee;
        const value = dataToWrite[typedKey];

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
    const serialized: Record<string, string | number | boolean> = {};
    const dataToWrite = { ...nonEmployee };

    if (dataToWrite.firstName || dataToWrite.lastName) {
        dataToWrite.fullName = `${dataToWrite.lastName || ''} ${dataToWrite.firstName || ''}`.trim();
    }

    for (const key of NON_EMPLOYEE_HEADERS) {
        const typedKey = key as keyof NonEmployee;
        const value = dataToWrite[typedKey];

        if (value === undefined || value === null) {
            serialized[key] = '';
            continue;
        }

        if (['checkInDate', 'checkOutDate', 'departureReportDate'].includes(key)) {
            serialized[key] = serializeDate(value as string);
        } else if (typeof value === 'boolean') {
            serialized[key] = String(value).toUpperCase();
        } else {
            serialized[key] = String(value);
        }
    }
    return serialized;
};

const serializeBokResident = (resident: Partial<BokResident>): Record<string, string | number | boolean> => {
    const serialized: Record<string, string | number | boolean> = {};
    const dataToWrite = { ...resident };

    if (dataToWrite.firstName || dataToWrite.lastName) {
        dataToWrite.fullName = `${dataToWrite.lastName || ''} ${dataToWrite.firstName || ''}`.trim();
    }

    for (const key of BOK_RESIDENT_HEADERS) {
        const typedKey = key as keyof BokResident;
        const value = dataToWrite[typedKey];

        if (value === undefined || value === null) {
            serialized[key] = '';
            continue;
        }

        if (['checkInDate', 'checkOutDate', 'sendDate', 'dismissDate'].includes(key)) {
            serialized[key] = serializeDate(value as string);
        } else {
            serialized[key] = String(value);
        }
    }
    return serialized;
};

const NOTIFICATION_HEADERS = [
    'id', 'message', 'entityId', 'entityFirstName', 'entityLastName', 'actorName', 'recipientId', 'createdAt', 'isRead', 'type', 'changes'
];

const serializeNotification = (notification: Notification): Record<string, string> => {
    return {
        id: notification.id,
        message: notification.message,
        entityId: notification.entityId,
        entityFirstName: notification.entityFirstName,
        entityLastName: notification.entityLastName,
        actorName: notification.actorName,
        recipientId: notification.recipientId,
        createdAt: notification.createdAt,
        isRead: String(notification.isRead).toUpperCase(),
        type: notification.type,
        changes: JSON.stringify(notification.changes || []),
    };
};

const COORDINATOR_HEADERS = ['uid', 'name', 'isAdmin', 'isDriver', 'departments', 'password', 'visibilityMode', 'pushSubscription'];
const ADDRESS_HEADERS = ['id', 'locality', 'name', 'coordinatorIds', 'isActive'];
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

    const formatsToTry = ['dd.MM.yyyy', 'yyyy.MM.dd', 'dd-MM-yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy', 'dd/MM/yy'];
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

const splitFullName = (fullName: string | null | undefined): { firstName: string, lastName: string } => {
    if (!fullName || typeof fullName !== 'string') {
        return { firstName: '', lastName: '' };
    }
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length === 1) {
        return { firstName: '', lastName: nameParts[0] };
    }
    const lastName = nameParts.shift() || '';
    const firstName = nameParts.join(' ');
    return { firstName, lastName };
}


const deserializeEmployee = (row: Record<string, unknown>): Employee | null => {
    const plainObject = row;

    const id = plainObject.id;
    if (!id || (!plainObject.lastName && !plainObject.fullName)) {
        return null;
    }

    const { firstName, lastName } = (plainObject.lastName && plainObject.firstName)
        ? { firstName: plainObject.firstName as string, lastName: plainObject.lastName as string }
        : splitFullName(plainObject.fullName as string);

    if (!lastName) {
        console.warn(`[Data Deserialization] Skipping employee record with ID "${id}" due to missing last name.`);
        return null;
    }

    const checkInDate = safeFormat(plainObject.checkInDate);
    if (!checkInDate) {
        console.warn(`[Data Deserialization] Employee "${lastName}, ${firstName}" (ID: ${id}) has an invalid or missing check-in date: "${plainObject.checkInDate}". The record will be loaded, but this may affect functionality.`);
    }

    let deductionReason: DeductionReason[] | undefined = undefined;
    if (plainObject.deductionReason && typeof plainObject.deductionReason === 'string') {
        try {
            const parsed = JSON.parse(plainObject.deductionReason);
            if (Array.isArray(parsed)) deductionReason = parsed;
        } catch (e) {
            console.warn(`Could not parse deductionReason for employee ${id}:`, e);
        }
    }

    const validDepositValues = ['Tak', 'Nie', 'Nie dotyczy'];
    const depositReturned = validDepositValues.includes(plainObject.depositReturned as string) ? plainObject.depositReturned as Employee['depositReturned'] : null;

    const newEmployee: Employee = {
        id: id as string,
        firstName,
        lastName,
        fullName: `${lastName} ${firstName}`.trim(),
        coordinatorId: (plainObject.coordinatorId || '') as string,
        nationality: (plainObject.nationality || '') as string,
        gender: (plainObject.gender || '') as string,
        address: (plainObject.address || '') as string,
        ownAddress: (plainObject.ownAddress as string | null) || null,
        roomNumber: (plainObject.roomNumber || '') as string,
        zaklad: (plainObject.zaklad as string | null) || null,
        checkInDate: checkInDate,
        checkOutDate: safeFormat(plainObject.checkOutDate),
        contractStartDate: safeFormat(plainObject.contractStartDate),
        contractEndDate: safeFormat(plainObject.contractEndDate),
        departureReportDate: safeFormat(plainObject.departureReportDate),
        comments: (plainObject.comments || '') as string,
        status: plainObject.status as 'active' | 'dismissed' || 'active',
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
        await withTimeout(sheet.addRow({
            timestamp: new Date().toISOString(),
            actorId,
            actorName,
            action,
            targetType,
            targetId,
            details: JSON.stringify(details),
        }, { raw: false, insert: true }), TIMEOUT_MS, 'sheet.addRow(AuditLog)');
    } catch (e: unknown) {
        console.error("Failed to write to audit log:", e instanceof Error ? e.message : "Unknown error");
    }
};

const FIELD_LABELS: Record<string, string> = {
    firstName: "Imię",
    lastName: "Nazwisko",
    coordinatorId: "Koordynator",
    nationality: "Narodowość",
    gender: "Płeć",
    address: "Adres",
    ownAddress: "Adres własny",
    roomNumber: "Pokój",
    zaklad: "Zakład",
    checkInDate: "Data zameldowania",
    checkOutDate: "Data wymeldowania",
    status: "Status",
};

const generateSmartNotificationMessage = (
    actorName: string,
    entity: (Employee | NonEmployee | BokResident),
    action: 'dodał' | 'zaktualizował' | 'trwale usunął' | 'automatycznie zwolnił' | 'przypisał do Ciebie' | 'przeniósł' | 'wysłał do Ciebie',
    changes: NotificationChange[] = []
): { message: string, type: NotificationType } => {
    const entityType = 'role' in entity ? 'mieszkańca BOK' : ('zaklad' in entity && entity.zaklad ? 'pracownika' : 'mieszkańca');
    const entityFullName = `${entity.firstName} ${entity.lastName}`.trim();
    let message = '';
    let type: NotificationType = 'info';

    switch (action) {
        case 'dodał':
            message = `Dodał nowego ${entityType} ${entityFullName}.`;
            type = 'success';
            break;
        case 'trwale usunął':
            message = `Trwale usunął ${entityType} ${entityFullName}.`;
            type = 'destructive';
            break;
        case 'automatycznie zwolnił':
            message = `Automatycznie zwolnił ${entityType} ${entityFullName} z powodu upływu daty wymeldowania.`;
            type = 'warning';
            break;
        case 'wysłał do Ciebie':
            message = `Wysłał do Ciebie nowego ${entityType}: ${entityFullName}.`;
            type = 'info';
            break;
        case 'przypisał do Ciebie':
            message = `Przypisał do Ciebie nowego ${entityType}: ${entityFullName}.`;
            type = 'info';
            break;
        case 'zaktualizował': {
            const statusChange = changes.find(c => c.field === FIELD_LABELS['status']);
            const addressChange = changes.find(c => c.field === FIELD_LABELS['address']);
            const checkoutChange = changes.find(c => c.field === FIELD_LABELS['checkOutDate']);

            if (statusChange && statusChange.newValue === 'dismissed') {
                message = `Zwolnił ${entityType} ${entityFullName}.`;
                type = 'warning';
            } else if (addressChange) {
                message = `Zmienił adres ${entityType} ${entityFullName} na ${addressChange.newValue}.`;
                type = 'warning';
            } else if (checkoutChange && (!checkoutChange.oldValue || checkoutChange.oldValue === 'Brak')) {
                message = `Przypisał datę wymeldowania dla ${entityType} ${entityFullName}.`;
                type = 'info';
            } else {
                message = `Zaktualizował dane ${entityType} ${entityFullName}.`;
                type = 'info';
            }
            break;
        }
        default:
            message = `${actorName} ${action} ${entityType} ${entityFullName}.`;
            type = 'info';
    }

    return { message, type };
};


const createNotification = async (
    actor: Coordinator,
    action: 'dodał' | 'zaktualizował' | 'trwale usunął' | 'automatycznie zwolnił' | 'przypisał do Ciebie' | 'przeniósł' | 'wysłał do Ciebie',
    entity: (Employee | NonEmployee | BokResident),
    settings: Settings,
    recipientIdOverride?: string,
    changes: NotificationChange[] = [],
    sendPush: boolean = true
) => {
    try {
        const readableChanges: NotificationChange[] = changes.map(c => ({
            ...c,
            field: FIELD_LABELS[c.field] || c.field
        }));

        let recipientId: string;
        const notificationAction = action;

        if (recipientIdOverride) {
            recipientId = recipientIdOverride;
        } else {
            recipientId = entity.coordinatorId;
        }

        const recipient = settings.coordinators.find(c => c.uid === recipientId);
        if (!recipient) return;

        const { message, type } = generateSmartNotificationMessage(actor.name, entity, notificationAction, readableChanges);

        const notification: Notification = {
            id: `notif-${Date.now()}-${Math.random()}`,
            message,
            entityId: entity.id,
            entityFirstName: entity.firstName,
            entityLastName: entity.lastName,
            actorName: actor.name,
            recipientId: recipient.uid,
            createdAt: new Date().toISOString(),
            isRead: false,
            type: type,
            changes: readableChanges
        };

        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
        await withTimeout(sheet.addRow(serializeNotification(notification)), TIMEOUT_MS, 'sheet.addRow(Notification)');

        const entityType = 'role' in entity ? 'bok-resident' : ('zaklad' in entity && entity.zaklad ? 'pracownika' : 'mieszkańca');
        await writeToAuditLog(actor.uid, actor.name, action, entityType, entity.id, changes);

        // Send Push Notification (only if explicitly enabled)
        if (sendPush) {
            const pushTitle = 'Powiadomienie SmartHouse';
            const pushLink = `/dashboard?view=employees&edit=${entity.id}`;
            await sendPushNotification(recipientId, pushTitle, message, pushLink);
        }

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

const validateRoomAvailability = (settings: Settings, addressName: string | undefined | null, roomName: string | undefined | null) => {
    if (addressName) {
        const address = settings.addresses.find(a => a.name === addressName);
        if (address && address.isActive === false) {
            throw new Error(`Adres "${address.name}" jest zablokowany i nie można do niego przypisywać mieszkańców.`);
        }
        if (address && roomName) {
            const room = address.rooms.find(r => r.name === roomName);
            if (room && room.isActive === false) {
                throw new Error(`Pokój "${room.name}" w adresie "${address.name}" jest wyłączony z użytku.`);
            }
        }
    }
}

export async function addEmployee(employeeData: Partial<Employee>, actorUid: string): Promise<Employee> {
    try {
        const settings = await getSettings();
        const actor = findActor(actorUid, settings);

        validateRoomAvailability(settings, employeeData.address, employeeData.roomNumber);

        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const newEmployee: Employee = {
            id: `emp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            status: 'active',
            firstName: employeeData.firstName || '',
            lastName: employeeData.lastName || '',
            fullName: `${employeeData.lastName || ''} ${employeeData.firstName || ''}`.trim(),
            coordinatorId: employeeData.coordinatorId || '',
            nationality: employeeData.nationality || '',
            gender: employeeData.gender || '',
            address: employeeData.address || '',
            ownAddress: employeeData.ownAddress,
            roomNumber: employeeData.roomNumber || '',
            zaklad: employeeData.zaklad || null,
            checkInDate: employeeData.checkInDate || null,
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
        await withTimeout(sheet.addRow(serialized, { raw: false, insert: true }), TIMEOUT_MS, 'sheet.addRow(Employee)');

        await createNotification(actor, 'dodał', newEmployee, settings);

        await invalidateEmployeesCache();
        return newEmployee;
    } catch (e: unknown) {
        console.error("Error adding employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add employee.");
    }
}


export async function updateEmployee(employeeId: string, updates: Partial<Employee>, actorUid: string): Promise<Employee> {
    try {
        if (updates.status === 'dismissed' && !updates.checkOutDate) {
            throw new Error('Data wymeldowania jest wymagana przy zwalnianiu pracownika.');
        }

        const [settings, addressHistory] = await Promise.all([getSettings(), getRawAddressHistory()]);
        const actor = findActor(actorUid, settings);

        validateRoomAvailability(settings, updates.address, updates.roomNumber);

        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Employee)');
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
            const lastHistoryEntry = (addressHistory || [])
                .filter(h => h.employeeId === employeeId && h.address === originalEmployee.address && h.checkInDate === originalEmployee.checkInDate)
                .sort((a, b) => new Date(b.checkInDate || 0).getTime() - new Date(a.checkInDate || 0).getTime())[0];

            if (lastHistoryEntry) {
                await updateHistoryToAction(lastHistoryEntry.id, { checkOutDate: updates.checkInDate });
            } else if (originalEmployee.address && originalEmployee.checkInDate) {
                const oldCoordinator = settings.coordinators.find(c => c.uid === originalEmployee.coordinatorId);
                await addHistoryToAction({
                    employeeId: employeeId,
                    employeeFirstName: originalEmployee.firstName,
                    employeeLastName: originalEmployee.lastName,
                    coordinatorName: oldCoordinator?.name || 'N/A',
                    department: originalEmployee.zaklad || 'N/A',
                    address: originalEmployee.address,
                    checkInDate: originalEmployee.checkInDate,
                    checkOutDate: updates.checkInDate,
                });
            }
        }

        const updatedEmployeeData: Employee = { ...originalEmployee, ...updates };
        const changes: NotificationChange[] = [];
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
        for (const header of EMPLOYEE_HEADERS) {
            row.set(header, serialized[header]);
        }

        await withTimeout(row.save(), TIMEOUT_MS, 'row.save(Employee)');

        if (changes.length > 0) {
            await createNotification(actor, 'zaktualizował', updatedEmployeeData, settings, undefined, changes);
        }

        await invalidateEmployeesCache();
        return updatedEmployeeData;

    } catch (e: unknown) {
        console.error("Error updating employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update employee.");
    }
}

export async function deleteEmployee(employeeId: string, _actorUid: string): Promise<string> {
    try {
        const addressHistory = await getRawAddressHistory();

        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Employee)');
        const row = rows.find((r) => r.get('id') === employeeId);

        if (!row) {
            throw new Error('Employee not found for deletion.');
        }

        await withTimeout(row.delete(), TIMEOUT_MS, 'row.delete(Employee)');

        const historyToDelete = (addressHistory || []).filter(h => h.employeeId === employeeId);
        for (const historyEntry of historyToDelete) {
            await deleteHistoryFromSheet(historyEntry.id);
        }

        await invalidateEmployeesCache();
        return employeeId;

    } catch (e: unknown) {
        console.error("Error deleting employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete employee.");
    }
}

export async function addNonEmployee(nonEmployeeData: Omit<NonEmployee, 'id' | 'status'>, actorUid: string): Promise<NonEmployee> {
    try {
        const settings = await getSettings();
        const actor = findActor(actorUid, settings);

        validateRoomAvailability(settings, nonEmployeeData.address, nonEmployeeData.roomNumber);

        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const newNonEmployee: NonEmployee = {
            id: `nonemp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            status: 'active',
            firstName: nonEmployeeData.firstName || '',
            lastName: nonEmployeeData.lastName || '',
            fullName: `${nonEmployeeData.lastName || ''} ${nonEmployeeData.firstName || ''}`.trim(),
            coordinatorId: nonEmployeeData.coordinatorId || '',
            nationality: nonEmployeeData.nationality || '',
            gender: nonEmployeeData.gender || '',
            address: nonEmployeeData.address || '',
            roomNumber: nonEmployeeData.roomNumber || '',
            checkInDate: nonEmployeeData.checkInDate,
            checkOutDate: nonEmployeeData.checkOutDate,
            departureReportDate: nonEmployeeData.departureReportDate,
            comments: nonEmployeeData.comments,
            paymentType: nonEmployeeData.paymentType,
            paymentAmount: nonEmployeeData.paymentAmount,
        };

        const serialized = serializeNonEmployee(newNonEmployee);
        await withTimeout(sheet.addRow(serialized, { raw: false, insert: true }), TIMEOUT_MS, 'sheet.addRow(NonEmployee)');

        await createNotification(actor, 'dodał', newNonEmployee, settings);

        await invalidateNonEmployeesCache();

        return newNonEmployee;
    } catch (e: unknown) {
        console.error("Error adding non-employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add non-employee.");
    }
}

export async function updateNonEmployee(id: string, updates: Partial<NonEmployee>, actorUid: string): Promise<NonEmployee> {
    try {
        if (updates.status === 'dismissed' && !updates.checkOutDate) {
            throw new Error('Data wymeldowania jest wymagana przy zwalnianiu osoby niebędącej pracownikiem.');
        }

        const [settings, addressHistory] = await Promise.all([getSettings(), getRawAddressHistory()]);
        const actor = findActor(actorUid, settings);

        validateRoomAvailability(settings, updates.address, updates.roomNumber);

        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(NonEmployee)');
        const rowIndex = rows.findIndex((row) => row.get('id') === id);

        if (rowIndex === -1) {
            throw new Error('Non-employee not found');
        }

        const row = rows[rowIndex];
        const originalNonEmployee = { ...row.toObject(), ...splitFullName(row.get('fullName')) } as NonEmployee;

        if (updates.address && updates.address !== originalNonEmployee.address && updates.checkInDate) {
            const lastHistoryEntry = (addressHistory || [])
                .filter(h => h.employeeId === id && h.address === originalNonEmployee.address && h.checkInDate === originalNonEmployee.checkInDate)
                .sort((a, b) => new Date(b.checkInDate || 0).getTime() - new Date(a.checkInDate || 0).getTime())[0];

            if (lastHistoryEntry) {
                await updateHistoryToAction(lastHistoryEntry.id, { checkOutDate: updates.checkInDate });
            } else if (originalNonEmployee.address && originalNonEmployee.checkInDate) {
                const oldCoordinator = settings.coordinators.find(c => c.uid === originalNonEmployee.coordinatorId);
                await addHistoryToAction({
                    employeeId: id,
                    employeeFirstName: originalNonEmployee.firstName,
                    employeeLastName: originalNonEmployee.lastName,
                    coordinatorName: oldCoordinator?.name || 'N/A',
                    department: 'N/A',
                    address: originalNonEmployee.address,
                    checkInDate: originalNonEmployee.checkInDate,
                    checkOutDate: updates.checkInDate,
                });
            }
        }

        const updatedNonEmployeeData: NonEmployee = { ...originalNonEmployee, ...updates };
        const changes: NotificationChange[] = [];

        for (const key in updates) {
            const typedKey = key as keyof NonEmployee;
            const oldValue = originalNonEmployee[typedKey];
            const newValue = updates[typedKey];

            let oldValStr: string | null = null;
            if (oldValue !== null && oldValue !== undefined) {
                oldValStr = String(oldValue);
            }

            let newValStr: string | null = null;
            if (newValue !== null && newValue !== undefined) {
                newValStr = String(newValue);
            }

            if (oldValStr !== newValStr) {
                changes.push({ field: typedKey, oldValue: oldValStr || 'Brak', newValue: newValStr || 'Brak' });
            }
        }

        const serializedData = serializeNonEmployee(updatedNonEmployeeData);
        for (const header of NON_EMPLOYEE_HEADERS) {
            row.set(header, serializedData[header]);
        }

        await withTimeout(row.save(), TIMEOUT_MS, 'row.save(NonEmployee)');

        if (changes.length > 0) {
            await createNotification(actor, 'zaktualizował', updatedNonEmployeeData, settings, undefined, changes);
        }

        await invalidateNonEmployeesCache();
        return updatedNonEmployeeData;

    } catch (e: unknown) {
        console.error("Error updating non-employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update non-employee.");
    }
}

export async function deleteNonEmployee(id: string, _actorUid: string): Promise<string> {
    try {
        const addressHistory = await getRawAddressHistory();

        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(NonEmployee)');
        const row = rows.find((row) => row.get('id') === id);
        if (row) {
            await withTimeout(row.delete(), TIMEOUT_MS, 'row.delete(NonEmployee)');

            const historyToDelete = (addressHistory || []).filter(h => h.employeeId === id);
            for (const historyEntry of historyToDelete) {
                await deleteHistoryFromSheet(historyEntry.id);
            }
            await invalidateNonEmployeesCache();
            return id;
        } else {
            throw new Error('Non-employee not found');
        }
    } catch (e: unknown) {
        console.error("Error deleting non-employee:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete non-employee.");
    }
}

export async function addBokResident(residentData: Omit<BokResident, 'id'>, actorUid: string): Promise<BokResident> {
    try {
        const settings = await getSettings();
        const actor = findActor(actorUid, settings);

        validateRoomAvailability(settings, residentData.address, residentData.roomNumber);

        const sheet = await getSheet(SHEET_NAME_BOK_RESIDENTS, BOK_RESIDENT_HEADERS);
        const newResident: BokResident = {
            id: `bok-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ...residentData,
            fullName: `${residentData.lastName} ${residentData.firstName}`.trim(),
        };

        const serialized = serializeBokResident(newResident);
        await withTimeout(sheet.addRow(serialized, { raw: false, insert: true }), TIMEOUT_MS, 'sheet.addRow(BokResident)');

        await createNotification(actor, 'dodał', newResident, settings, undefined, [], false);

        await invalidateBokResidentsCache();

        return newResident;
    } catch (e: unknown) {
        console.error("Error adding BOK resident:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to add BOK resident.");
    }
}

export async function updateBokResident(id: string, updates: Partial<BokResident>, actorUid: string): Promise<BokResident> {
    try {
        const settings = await getSettings();
        const actor = findActor(actorUid, settings);

        validateRoomAvailability(settings, updates.address, updates.roomNumber);

        const sheet = await getSheet(SHEET_NAME_BOK_RESIDENTS, BOK_RESIDENT_HEADERS);
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(BokResident)');
        const row = rows.find(r => r.get('id') === id);

        if (!row) {
            throw new Error('BOK Resident not found');
        }

        const originalResident = { ...row.toObject(), ...splitFullName(row.get('fullName')) } as BokResident;
        const updatedResident = { ...originalResident, ...updates };
        // Recompute fullName to avoid stale value when firstName/lastName change
        updatedResident.fullName = `${updatedResident.lastName} ${updatedResident.firstName}`.trim();

        const changes: NotificationChange[] = [];

        for (const key in updates) {
            const typedKey = key as keyof BokResident;
            const oldValue = originalResident[typedKey];
            const newValue = updates[typedKey];

            if (String(oldValue) !== String(newValue)) {
                changes.push({ field: typedKey, oldValue: String(oldValue || 'Brak'), newValue: String(newValue || 'Brak') });
            }
        }

        const serialized = serializeBokResident(updatedResident);
        for (const header of BOK_RESIDENT_HEADERS) {
            row.set(header, serialized[header]);
        }
        await withTimeout(row.save(), TIMEOUT_MS, 'row.save(BokResident)');

        if (changes.length > 0) {
            await createNotification(actor, 'zaktualizował', updatedResident, settings, undefined, changes, false);
        }

        await invalidateBokResidentsCache();
        return updatedResident;

    } catch (e: unknown) {
        console.error("Error updating BOK resident:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update BOK resident.");
    }
}

export async function deleteBokResident(id: string, _actorUid: string): Promise<string> {
    try {
        // Clean up associated address history entries (same as deleteEmployee/deleteNonEmployee)
        const addressHistory = await getRawAddressHistory();

        const sheet = await getSheet(SHEET_NAME_BOK_RESIDENTS, BOK_RESIDENT_HEADERS);
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(BokResident)');
        const row = rows.find(r => r.get('id') === id);

        if (row) {
            await withTimeout(row.delete(), TIMEOUT_MS, 'row.delete(BokResident)');

            const historyToDelete = (addressHistory || []).filter(h => h.employeeId === id);
            for (const historyEntry of historyToDelete) {
                await deleteHistoryFromSheet(historyEntry.id);
            }

            await invalidateBokResidentsCache();
            return id;
        } else {
            throw new Error('BOK Resident not found');
        }
    } catch (e: unknown) {
        console.error("Error deleting BOK resident:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete BOK resident.");
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
            await withTimeout(rowsToDelete[i].delete(), TIMEOUT_MS, 'row.delete(Employee)');
        }

        await invalidateEmployeesCache();
        revalidatePath('/dashboard');

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
            await withTimeout(rowsToDelete[i].delete(), TIMEOUT_MS, 'row.delete(Employee)');
        }

        await invalidateEmployeesCache();
        revalidatePath('/dashboard');

        // Audit logging
        const settings = await getSettings();
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

export async function bulkDeleteEmployeesByDepartment(department: string, actorUid: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        const rowsToDelete = rows.filter((row) => row.get('zaklad') === department);

        if (rowsToDelete.length === 0) {
            return;
        }

        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            await withTimeout(rowsToDelete[i].delete(), TIMEOUT_MS, 'row.delete(Employee)');
        }

        await invalidateEmployeesCache();
        revalidatePath('/dashboard');

        // Audit logging
        const settings = await getSettings();
        const actor = findActor(actorUid, settings);
        if (actor) {
            await writeToAuditLog(actor.uid, actor.name, 'bulk-delete-by-department', 'employee', department, {
                deletedCount: rowsToDelete.length,
                department: department
            });
        }

    } catch (e: unknown) {
        console.error("Error bulk deleting employees by department:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to bulk delete employees by department.");
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

        const settings = await getSettings();
        const toCoordinator = settings.coordinators.find((c: { uid: string; name: string; }) => c.uid === toCoordinatorId);
        if (!toCoordinator) {
            throw new Error("Target coordinator not found.");
        }

        for (const row of rowsToTransfer) {
            row.set('coordinatorId', toCoordinatorId);
            await withTimeout(row.save(), TIMEOUT_MS, 'row.save(Employee)');
        }

        await invalidateEmployeesCache();
        revalidatePath('/dashboard');

    } catch (e: unknown) {
        console.error("Error transferring employees:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to transfer employees.");
    }
}

export async function checkAndUpdateStatuses(actorUid?: string): Promise<{ updated: number }> {
    try {
        const settings = await getSettings();
        const actor = findActor(actorUid || 'system', settings);
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
                    await withTimeout(row.save(), TIMEOUT_MS, 'row.save(Employee)');
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
                    await withTimeout(row.save(), TIMEOUT_MS, 'row.save(NonEmployee)');
                    updatedCount++;
                    const originalNonEmployee = { ...row.toObject(), ...splitFullName(row.get('fullName')) } as NonEmployee;
                    await createNotification(actor, 'automatycznie zwolnił', originalNonEmployee, settings, undefined, [
                        { field: 'status', oldValue: 'active', newValue: 'dismissed' }
                    ]);
                }
            }
        }

        // Process BOK residents
        const bokSheet = await getSheet(SHEET_NAME_BOK_RESIDENTS, BOK_RESIDENT_HEADERS);
        const bokRows = await bokSheet.getRows();
        for (const row of bokRows) {
            const status = String(row.get('status') || '');
            const dismissDateString = String(row.get('dismissDate') || '');

            if ((status === 'active' || status === '' || !status) && dismissDateString) {
                // Support multiple date formats stored in Google Sheets
                let dismissDate = parseISO(dismissDateString);
                if (!isValid(dismissDate)) {
                    dismissDate = dateFnsParse(dismissDateString, 'dd-MM-yyyy HH:mm', new Date());
                }
                if (!isValid(dismissDate)) {
                    dismissDate = dateFnsParse(dismissDateString, 'dd-MM-yyyy', new Date());
                }
                if (!isValid(dismissDate)) {
                    dismissDate = dateFnsParse(dismissDateString, 'dd.MM.yyyy', new Date());
                }
                if (!isValid(dismissDate)) {
                    dismissDate = new Date(dismissDateString);
                }

                if (isValid(dismissDate) && dismissDate < today) {
                    row.set('status', 'dismissed');
                    await withTimeout(row.save(), TIMEOUT_MS, 'row.save(BokResident)');
                    updatedCount++;
                    const originalResident = { ...row.toObject(), ...splitFullName(row.get('fullName')) } as BokResident;
                    await createNotification(actor, 'automatycznie zwolnił', originalResident, settings, undefined, [
                        { field: 'status', oldValue: status || 'active', newValue: 'dismissed' }
                    ], false);
                }
            }
        }

        if (updatedCount > 0) {
            await invalidateEmployeesCache();
            await invalidateNonEmployeesCache();
            await invalidateBokResidentsCache();
            revalidatePath('/dashboard');
        }

        return { updated: updatedCount };
    } catch (e: unknown) {
        console.error("Error updating statuses:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update statuses.");
    }
}


export async function updateSettings(newSettings: Partial<Settings>): Promise<Partial<Settings>> {
    const updateSimpleList = async (sheetName: string, items: string[]) => {
        const sheet = await getSheet(sheetName, ['name']);
        const currentRows = await withTimeout(sheet.getRows(), TIMEOUT_MS, `sheet.getRows(${sheetName})`);
        const existingItems = currentRows.map(r => r.get('name'));

        const toAdd = items.filter(item => !existingItems.includes(item));
        const toDeleteRows = currentRows.filter(r => !items.includes(r.get('name')));

        // Batch deletion
        // Use a separate function for deletion to avoid 'then' on undefined in tests if delete returns void/undefined
        await batchPromises(toDeleteRows.reverse(), 5, async (row) => {
            await withTimeout(row.delete(), TIMEOUT_MS, `row.delete(${sheetName})`);
        }, 100);

        // Batch addition
        if (toAdd.length > 0) {
            await withTimeout(sheet.addRows(toAdd.map(name => ({ name })), { raw: false, insert: true }), TIMEOUT_MS, `sheet.addRows(${sheetName})`);
        }
    };

    try {
        // Parallelize simple lists update with concurrency control (max 3 concurrent)
        const simpleListTasks: (() => Promise<void>)[] = [];
        if (newSettings.nationalities) simpleListTasks.push(() => updateSimpleList(SHEET_NAME_NATIONALITIES, newSettings.nationalities!));
        if (newSettings.departments) simpleListTasks.push(() => updateSimpleList(SHEET_NAME_DEPARTMENTS, newSettings.departments!));
        if (newSettings.genders) simpleListTasks.push(() => updateSimpleList(SHEET_NAME_GENDERS, newSettings.genders!));
        if (newSettings.localities) simpleListTasks.push(() => updateSimpleList(SHEET_NAME_LOCALITIES, newSettings.localities!));
        if (newSettings.paymentTypesNZ) simpleListTasks.push(() => updateSimpleList(SHEET_NAME_PAYMENT_TYPES_NZ, newSettings.paymentTypesNZ!));
        if (newSettings.statuses) simpleListTasks.push(() => updateSimpleList(SHEET_NAME_STATUSES, newSettings.statuses!));
        if (newSettings.bokRoles) simpleListTasks.push(() => updateSimpleList(SHEET_NAME_BOK_ROLES, newSettings.bokRoles!));
        if (newSettings.bokReturnOptions) simpleListTasks.push(() => updateSimpleList(SHEET_NAME_BOK_RETURN_OPTIONS, newSettings.bokReturnOptions!));

        await batchPromises(simpleListTasks, 3, async (task) => { await task() }, 0);

        if (newSettings.addresses) {
            await (async () => {
                const addressesSheet = await getSheet(SHEET_NAME_ADDRESSES, ADDRESS_HEADERS);
                const roomsSheet = await getSheet(SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity', 'isActive']);

                const currentAddressRows = await withTimeout(addressesSheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Addresses)');
                const toAddAddr = newSettings.addresses!.filter(a => !currentAddressRows.some(r => r.get('id') === a.id));
                const toDeleteAddrRows = currentAddressRows.filter(r => !newSettings.addresses!.some(a => a.id === r.get('id')));

                // Identify modified addresses only
                const toUpdateAddr = newSettings.addresses!
                    .filter(a => currentAddressRows.some(r => r.get('id') === a.id))
                    .filter(addr => {
                        const row = currentAddressRows.find(r => r.get('id') === addr.id)!;
                        const newCoordinatorIds = (addr.coordinatorIds || []).join(',');

                        const currentName = String(row.get('name') || '');
                        const currentLocality = String(row.get('locality') || '');
                        const currentCoordinatorIds = String(row.get('coordinatorIds') || '');

                        const isActiveRaw = row.get('isActive');
                        // Default to TRUE if missing or empty, otherwise parse the value
                        const currentIsActive = (isActiveRaw === undefined || isActiveRaw === null || String(isActiveRaw).trim() === '')
                            ? true
                            : String(isActiveRaw).toUpperCase() === 'TRUE';

                        const newIsActive = addr.isActive !== false;

                        return (
                            currentName !== addr.name ||
                            currentLocality !== addr.locality ||
                            currentCoordinatorIds !== newCoordinatorIds ||
                            currentIsActive !== newIsActive
                        );
                    });

                // Throttled Deletions
                // Sort by rowNumber descending to avoid index shifting issues during deletion
                const sortedToDeleteAddr = toDeleteAddrRows.sort((a, b) => b.rowNumber - a.rowNumber);
                // Limit the number of deletions to prevent timeouts if there are many orphan rows
                const safeBatchToDeleteAddr = sortedToDeleteAddr.slice(0, 20);

                await batchPromises(safeBatchToDeleteAddr, 1, async (row) => {
                    await withTimeout(row.delete(), TIMEOUT_MS, 'row.delete(Addresses)');
                }, 100);

                // Throttled Updates
                await batchPromises(toUpdateAddr, 5, async (addr) => {
                    const row = currentAddressRows.find(r => r.get('id') === addr.id)!;
                    const newCoordinatorIds = (addr.coordinatorIds || []).join(',');
                    const newIsActive = addr.isActive !== false ? 'TRUE' : 'FALSE';

                    row.set('name', addr.name);
                    row.set('locality', addr.locality);
                    row.set('coordinatorIds', newCoordinatorIds);
                    row.set('isActive', newIsActive);
                    await withTimeout(row.save(), TIMEOUT_MS, 'row.save(Addresses)');
                }, 100);

                if (toAddAddr.length > 0) {
                    await withTimeout(addressesSheet.addRows(toAddAddr.map(addr => ({
                        id: addr.id,
                        name: addr.name,
                        locality: addr.locality,
                        coordinatorIds: (addr.coordinatorIds || []).join(','),
                        isActive: addr.isActive !== false ? 'TRUE' : 'FALSE',
                    })), { raw: false, insert: true }), TIMEOUT_MS, 'sheet.addRows(Addresses)');
                }

                // Differential update for rooms
                const currentRoomRows = await withTimeout(roomsSheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Rooms)');
                const newRooms = newSettings.addresses!.flatMap(addr => addr.rooms.map(room => ({ ...room, addressId: addr.id })));

                const toAddRooms = newRooms.filter(room => !currentRoomRows.some(r => r.get('id') === room.id));
                const toDeleteRoomRows = currentRoomRows.filter(r => !newRooms.some(room => room.id === r.get('id')));

                // Identify modified rooms only
                const toUpdateRooms = newRooms
                    .filter(room => currentRoomRows.some(r => r.get('id') === room.id))
                    .filter(room => {
                        const row = currentRoomRows.find(r => r.get('id') === room.id)!;
                        const newIsActive = room.isActive !== false ? 'TRUE' : 'FALSE';
                        const newCapacity = String(room.capacity);

                        return (
                            row.get('addressId') !== room.addressId ||
                            row.get('name') !== room.name ||
                            String(row.get('capacity')) !== newCapacity ||
                            String(row.get('isActive')).toUpperCase() !== newIsActive
                        );
                    });

                // Throttled Room Deletions
                // Sort by rowNumber descending to avoid index shifting issues during deletion
                const sortedToDeleteRooms = toDeleteRoomRows.sort((a, b) => b.rowNumber - a.rowNumber);
                // Limit the number of deletions to prevent timeouts if there are many orphan rows
                const safeBatchToDeleteRooms = sortedToDeleteRooms.slice(0, 50);

                await batchPromises(safeBatchToDeleteRooms, 1, async (row) => {
                    await withTimeout(row.delete(), TIMEOUT_MS, 'row.delete(Rooms)');
                }, 100);

                // Throttled Room Updates
                await batchPromises(toUpdateRooms, 5, async (room) => {
                    const row = currentRoomRows.find(r => r.get('id') === room.id)!;
                    const newIsActive = room.isActive !== false ? 'TRUE' : 'FALSE';
                    const newCapacity = String(room.capacity);

                    row.set('addressId', room.addressId);
                    row.set('name', room.name);
                    row.set('capacity', newCapacity);
                    row.set('isActive', newIsActive);
                    await withTimeout(row.save(), TIMEOUT_MS, 'row.save(Rooms)');
                }, 100);

                if (toAddRooms.length > 0) {
                    // Add rows in chunks to prevent huge payload
                    const chunkSize = 20;
                    for (let i = 0; i < toAddRooms.length; i += chunkSize) {
                        const chunk = toAddRooms.slice(i, i + chunkSize);
                        await withTimeout(roomsSheet.addRows(chunk.map(room => ({
                            id: room.id,
                            addressId: room.addressId,
                            name: room.name,
                            capacity: String(room.capacity),
                            isActive: room.isActive !== false ? 'TRUE' : 'FALSE',
                        })), { raw: false, insert: true }), TIMEOUT_MS, 'sheet.addRows(Rooms)');
                        if (i + chunkSize < toAddRooms.length) await new Promise(r => setTimeout(r, 200));
                    }
                }
            })();
        }
        if (newSettings.coordinators) {
            await (async () => {
                const sheet = await getSheet(SHEET_NAME_COORDINATORS, COORDINATOR_HEADERS);
                const currentRows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Coordinators)');

                const toUpdate = newSettings.coordinators!.filter(c => currentRows.some(r => r.get('uid') === c.uid));
                const toAdd = newSettings.coordinators!.filter(c => !currentRows.some(r => r.get('uid') === c.uid));
                const toDeleteRows = currentRows.filter(r => !newSettings.coordinators!.some(c => c.uid === r.get('uid')));

                // Throttled Coordinator Deletions
                await batchPromises(toDeleteRows.reverse(), 1, async (row) => {
                    await withTimeout(row.delete(), TIMEOUT_MS, 'row.delete(Coordinators)');
                }, 1000);

                // Throttled Coordinator Updates
                await batchPromises(toUpdate, 1, async (coord) => {
                    const row = currentRows.find(r => r.get('uid') === coord.uid);
                    if (row) {
                        const newIsAdmin = String(coord.isAdmin).toUpperCase();
                        const newIsDriver = String(coord.isDriver || false).toUpperCase();
                        const newDepartments = coord.departments.join(',');
                        const newVisibilityMode = coord.visibilityMode || 'department';

                        let hasChanges = false;
                        if (row.get('name') !== coord.name) hasChanges = true;
                        if (String(row.get('isAdmin')).toUpperCase() !== newIsAdmin) hasChanges = true;
                        if (String(row.get('isDriver') || 'FALSE').toUpperCase() !== newIsDriver) hasChanges = true;
                        if (row.get('departments') !== newDepartments) hasChanges = true;
                        if (row.get('visibilityMode') !== newVisibilityMode) hasChanges = true;
                        if (coord.password && row.get('password') !== coord.password) hasChanges = true;

                        if (hasChanges) {
                            row.set('name', coord.name);
                            row.set('isAdmin', newIsAdmin);
                            row.set('isDriver', newIsDriver);
                            row.set('departments', newDepartments);
                            row.set('visibilityMode', newVisibilityMode);
                            if (coord.password) {
                                row.set('password', coord.password);
                            }
                            await withTimeout(row.save(), TIMEOUT_MS, 'row.save(Coordinators)');
                        }
                    }
                }, 1000);

                if (toAdd.length > 0) {
                    await withTimeout(sheet.addRows(toAdd.map(c => ({
                        ...c,
                        departments: c.departments.join(','),
                        isAdmin: String(c.isAdmin).toUpperCase(),
                        isDriver: String(c.isDriver || false).toUpperCase(),
                        visibilityMode: c.visibilityMode || 'department',
                        pushSubscription: c.pushSubscription || '',
                    })), { raw: false, insert: true }), TIMEOUT_MS, 'sheet.addRows(Coordinators)');
                }
            })();
        }

        await invalidateSettingsCache();
        revalidatePath('/dashboard');
        return newSettings;

    } catch (error: unknown) {
        console.error("Error updating settings:", error);
        if (error instanceof Error && (error.message.includes('429') || error.message.includes('Quota'))) {
            throw new Error("Przekroczono limit zapytań do Google Sheets API. Spróbuj ponownie za chwilę, zapisując mniejszą liczbę zmian na raz.");
        }
        throw new Error(error instanceof Error ? error.message : "Failed to update settings.");
    }
}


export async function updateNotificationReadStatus(notificationId: string, isRead: boolean): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Notifications)');
        const row = rows.find((r) => r.get('id') === notificationId);
        if (row) {
            row.set('isRead', String(isRead).toUpperCase());
            await withTimeout(row.save(), TIMEOUT_MS, 'row.save(Notifications)');
            revalidatePath('/dashboard');
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
        await withTimeout(sheet.clearRows(), TIMEOUT_MS, 'sheet.clearRows(Notifications)');
        revalidatePath('/dashboard');
    } catch (e: unknown) {
        console.error("Could not clear notifications:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to clear notifications.");
    }
}

export async function deleteNotification(notificationId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Notifications)');
        const rowToDelete = rows.find(row => row.get('id') === notificationId);
        if (rowToDelete) {
            await withTimeout(rowToDelete.delete(), TIMEOUT_MS, 'row.delete(Notifications)');
            revalidatePath('/dashboard');
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
        const [employees, settings, addressHistory] = await Promise.all([
            getEmployees(),
            getSettings(),
            getRawAddressHistory()
        ]);
        const coordinatorMap = new Map(settings.coordinators.map((c: { uid: string; name: string; }) => [c.uid, c.name]));

        const reportStart = new Date(year, month - 1, 1);
        const reportEnd = new Date(year, month, 0, 23, 59, 59);

        let filteredEmployees = employees;
        if (coordinatorId !== 'all') {
            filteredEmployees = employees.filter(e => e.coordinatorId === coordinatorId);
        }

        const reportData: Record<string, string | number | null>[] = [];
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

                if (employeeHistory.length === 0) continue;

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
                            "Imię": employee.firstName,
                            "Nazwisko": employee.lastName,
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
                    "Imię": e.firstName,
                    "Nazwisko": e.lastName,
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
        const [nonEmployees, settings] = await Promise.all([getNonEmployees(), getSettings()]);
        const coordinatorMap = new Map(settings.coordinators.map((c: { uid: string; name: string; }) => [c.uid, c.name]));

        const reportStart = new Date(year, month - 1, 1);
        const reportEnd = new Date(year, month, 0, 23, 59, 59);

        let filteredNonEmployees = nonEmployees;
        if (coordinatorId !== 'all') {
            filteredNonEmployees = nonEmployees.filter(ne => ne.coordinatorId === coordinatorId);
        }

        const reportData: Record<string, string | number | null>[] = [];

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
                "Imię": ne.firstName,
                "Nazwisko": ne.lastName,
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
            { wch: 25 }, // Imię
            { wch: 25 }, // Nazwisko
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
    type: 'employee' | 'non-employee' | 'bok-resident',
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
        const recordsToAdd: (Employee | NonEmployee | BokResident)[] = [];
        const notificationsToAdd: Notification[] = [];
        const newLocalities = new Set<string>();

        const coordinatorMap = new Map(settings.coordinators.map(c => [c.name.toLowerCase().trim(), c.uid]));
        const actor = findActor(actorUid, settings);

        for (const [index, row] of data.entries()) {
            const rowNum = index + 2;
            try {
                const normalizedRow: Record<string, unknown> = {};
                for (const key in row) {
                    if (row[key] !== null) {
                        normalizedRow[key.trim().toLowerCase()] = row[key];
                    }
                }

                const employeeRequiredFields = ['imię', 'nazwisko', 'koordynator', 'data zameldowania', 'zakład', 'miejscowość', 'adres', 'pokój', 'narodowość'];
                const nonEmployeeRequiredFields = ['imię', 'nazwisko', 'koordynator', 'data zameldowania', 'miejscowość', 'adres', 'pokój', 'narodowość'];
                const bokRequiredFields = ['imię', 'nazwisko', 'koordynator', 'data zameldowania', 'miejscowość', 'adres', 'pokój', 'narodowość', 'rola', 'zakład'];

                const requiredFields = type === 'employee' ? employeeRequiredFields : (type === 'bok-resident' ? bokRequiredFields : nonEmployeeRequiredFields);

                const missingFields = requiredFields.filter(field => {
                    const value = normalizedRow[field];
                    return value === undefined || value === null || String(value).trim() === '';
                });

                if (missingFields.length > 0) {
                    errors.push(`Wiersz ${rowNum}: Brak wymaganych danych w kolumnach: ${missingFields.join(', ')}.`);
                    continue;
                }

                const firstName = (normalizedRow['imię'] as string)?.trim();
                const lastName = (normalizedRow['nazwisko'] as string)?.trim();

                const coordinatorName = (normalizedRow['koordynator'] as string)?.toLowerCase().trim();
                const coordinatorId = coordinatorName ? coordinatorMap.get(coordinatorName) : '';
                if (!coordinatorId) {
                    errors.push(`Wiersz ${rowNum} (${lastName}): Nie znaleziono koordynatora '${normalizedRow['koordynator']}'.`);
                    continue;
                }

                const checkInDate = safeFormat(normalizedRow['data zameldowania']);
                if (!checkInDate) {
                    errors.push(`Wiersz ${rowNum} (${lastName}): Nieprawidłowy format daty zameldowania.`);
                    continue;
                }

                const locality = (normalizedRow['miejscowość'] as string)?.trim();
                if (locality && !settings.localities.includes(locality)) {
                    newLocalities.add(locality);
                }

                const baseRecord = {
                    id: `${type === 'employee' ? 'emp' : (type === 'bok-resident' ? 'bok' : 'nonemp')}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    firstName,
                    lastName,
                    fullName: `${lastName || ''} ${firstName || ''}`.trim(),
                    coordinatorId,
                    nationality: (normalizedRow['narodowość'] as string)?.trim(),
                    gender: (normalizedRow['płeć'] as string)?.trim(),
                    address: (normalizedRow['adres'] as string)?.trim(),
                    roomNumber: String(normalizedRow['pokój'] || '').trim(),
                    checkInDate,
                    checkOutDate: safeFormat(normalizedRow['data wymeldowania']),
                    departureReportDate: safeFormat(normalizedRow['data zgloszenia wyjazdu']),
                    comments: (normalizedRow['komentarze'] as string)?.trim(),
                    status: 'active' as const,
                };

                let newRecord: Employee | NonEmployee | BokResident;

                if (type === 'employee') {
                    newRecord = {
                        ...baseRecord,
                        zaklad: (normalizedRow['zakład'] as string)?.trim() || null,
                        contractStartDate: safeFormat(normalizedRow['umowa od']),
                        contractEndDate: safeFormat(normalizedRow['umowa do']),
                        ownAddress: null,
                        depositReturned: null,
                        depositReturnAmount: null,
                        deductionRegulation: null,
                        deductionNo4Months: null,
                        deductionNo30Days: null,
                        deductionReason: undefined,
                        deductionEntryDate: null,
                    } as Employee;
                } else if (type === 'bok-resident') {
                    newRecord = {
                        ...baseRecord,
                        role: (normalizedRow['rola'] as string)?.trim() || 'Kierowca',
                        zaklad: (normalizedRow['zakład'] as string)?.trim() || '',
                        returnStatus: (normalizedRow['opcja powrotu'] as string)?.trim() || 'Brak',
                        sendDate: null,
                        dismissDate: null,
                    } as BokResident;
                    // remove non-bok fields to satisfy type if needed
                    if ('departureReportDate' in newRecord) delete (newRecord as any).departureReportDate;
                } else {
                    newRecord = {
                        ...baseRecord,
                        paymentType: (normalizedRow['rodzaj płatności nz'] as string)?.trim() || null,
                        paymentAmount: normalizedRow['kwota'] ? parseFloat(String(normalizedRow['kwota'])) : null,
                    } as NonEmployee;
                }

                recordsToAdd.push(newRecord);

                const { message, type: notificationType } = generateSmartNotificationMessage(actor.name, newRecord, 'dodał');
                notificationsToAdd.push({
                    id: `notif-${Date.now()}-${Math.random()}`,
                    message,
                    entityId: newRecord.id,
                    entityFirstName: newRecord.firstName,
                    entityLastName: newRecord.lastName,
                    actorName: actor.name,
                    recipientId: newRecord.coordinatorId,
                    createdAt: new Date().toISOString(),
                    isRead: false,
                    type: notificationType,
                    changes: []
                });

            } catch (rowError) {
                errors.push(`Wiersz ${rowNum} (${(row['Nazwisko'] as string) || 'Brak Nazwiska'}): ${rowError instanceof Error ? rowError.message : 'Nieznany błąd'}.`);
            }
        }

        if (recordsToAdd.length > 0) {
            if (type === 'employee') {
                const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
                const serializedRecords = (recordsToAdd as Employee[]).map(rec => serializeEmployee(rec));
                await withTimeout(sheet.addRows(serializedRecords), TIMEOUT_MS, 'sheet.addRows(Employees)');
            } else if (type === 'bok-resident') {
                const sheet = await getSheet('BokResidents', BOK_RESIDENT_HEADERS);
                const serializedRecords = (recordsToAdd as BokResident[]).map(rec => serializeBokResident(rec));
                await withTimeout(sheet.addRows(serializedRecords), TIMEOUT_MS, 'sheet.addRows(BokResidents)');
            } else {
                const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
                const serializedRecords = (recordsToAdd as NonEmployee[]).map(rec => serializeNonEmployee(rec));
                await withTimeout(sheet.addRows(serializedRecords), TIMEOUT_MS, 'sheet.addRows(NonEmployees)');
            }
        }

        if (notificationsToAdd.length > 0) {
            const notificationsSheet = await getSheet(SHEET_NAME_NOTIFICATIONS, NOTIFICATION_HEADERS);
            const serializedNotifications = notificationsToAdd.map(serializeNotification);
            await withTimeout(notificationsSheet.addRows(serializedNotifications), TIMEOUT_MS, 'sheet.addRows(Notifications)');
        }

        if (newLocalities.size > 0) {
            const updatedLocalities = [...new Set([...settings.localities, ...Array.from(newLocalities)])];
            await updateSettings({ localities: updatedLocalities });
        }

        if (type === 'employee') {
            await invalidateEmployeesCache();
        } else if (type === 'bok-resident') {
            await invalidateBokResidentsCache();
        } else {
            await invalidateNonEmployeesCache();
        }

        revalidatePath('/dashboard');
        return { importedCount: recordsToAdd.length, totalRows: data.length, errors };

    } catch (e) {
        console.error(`Error importing ${type}s from Excel:`, e);
        if (e instanceof Error) {
            if (e.message.includes('[429]')) {
                throw new Error("Przekroczono limit zapytań do Google Sheets API. Spróbuj ponownie za chwilę lub zaimportuj mniejszy plik.");
            }
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

export async function importBokResidentsFromExcel(fileContent: string, actorUid: string, settings: Settings): Promise<{ importedCount: number; totalRows: number; errors: string[] }> {
    return processImport(fileContent, actorUid, 'bok-resident', settings);
}

export async function deleteAddressHistoryEntry(historyId: string, actorUid: string): Promise<void> {
    try {
        const settings = await getSettings();
        const actor = findActor(actorUid, settings);

        await deleteHistoryFromSheet(historyId);

        await writeToAuditLog(actor.uid, actor.name, 'delete-address-history', 'address-history', historyId, {
            message: `Usunięto wpis z historii adresów.`,
        });
        revalidatePath('/dashboard');
    } catch (e: unknown) {
        console.error("Error deleting address history entry:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to delete address history entry.");
    }
}


export async function migrateFullNames(actorUid: string): Promise<{ migratedEmployees: number; migratedNonEmployees: number }> {
    const settings = await getSettings();
    const actor = findActor(actorUid, settings);

    let migratedEmployees = 0;
    let migratedNonEmployees = 0;

    // Migrate Employees
    const employeeSheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
    const employeeRows = await withTimeout(employeeSheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Employees)');
    for (const row of employeeRows) {
        const fullName = row.get('fullName') as string;
        const firstName = row.get('firstName') as string;
        const lastName = row.get('lastName') as string;
        if (fullName && (!firstName || !lastName)) {
            const { firstName: newFirstName, lastName: newLastName } = splitFullName(fullName);
            row.set('firstName', newFirstName);
            row.set('lastName', newLastName);
            await withTimeout(row.save(), TIMEOUT_MS, 'row.save(Employees)');
            migratedEmployees++;
        }
    }

    // Migrate Non-Employees
    const nonEmployeeSheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
    const nonEmployeeRows = await withTimeout(nonEmployeeSheet.getRows(), TIMEOUT_MS, 'sheet.getRows(NonEmployees)');
    for (const row of nonEmployeeRows) {
        const fullName = row.get('fullName') as string;
        const firstName = row.get('firstName') as string;
        const lastName = row.get('lastName') as string;
        if (fullName && (!firstName || !lastName)) {
            const { firstName: newFirstName, lastName: newLastName } = splitFullName(fullName);
            row.set('firstName', newFirstName);
            row.set('lastName', newLastName);
            await withTimeout(row.save(), TIMEOUT_MS, 'row.save(NonEmployees)');
            migratedNonEmployees++;
        }
    }

    await writeToAuditLog(actor.uid, actor.name, 'migrate-full-names', 'system', 'all', {
        migratedEmployees,
        migratedNonEmployees
    });

    await invalidateEmployeesCache();
    await invalidateNonEmployeesCache();
    revalidatePath('/dashboard');

    return { migratedEmployees, migratedNonEmployees };
}

export async function updateCoordinatorSubscription(coordinatorId: string, subscription: string | null): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_COORDINATORS, COORDINATOR_HEADERS);
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Coordinators)');
        const coordinatorRow = rows.find(row => row.get('uid') === coordinatorId);

        if (coordinatorRow) {
            // Save token directly as string
            coordinatorRow.set('pushSubscription', subscription || '');
            await withTimeout(coordinatorRow.save(), TIMEOUT_MS, 'row.save(Coordinators)');
            await invalidateSettingsCache();
            revalidatePath('/dashboard');
        } else {
            throw new Error('Coordinator not found.');
        }
    } catch (e: unknown) {
        console.error("Error updating coordinator subscription:", e);
        throw new Error(e instanceof Error ? e.message : "Failed to update subscription.");
    }
}

export async function sendPushNotification(
    coordinatorId: string,
    title: string,
    body: string,
    link?: string
): Promise<void> {
    try {
        const settings = await getSettings();
        const coordinator = settings.coordinators.find((c: { uid: string; pushSubscription?: string | null }) => c.uid === coordinatorId);

        if (!coordinator || !coordinator.pushSubscription) {
            return;
        }

        const token = coordinator.pushSubscription;
        if (!token || token.startsWith('{')) {
            console.log('Invalid or legacy token, skipping FCM send.');
            return;
        }

        if (adminMessaging) {
            const message = {
                token: token,
                // Brak pola `notification` — zapobiega podwójnym powiadomieniom.
                // FCM z polem `notification` wyświetla powiadomienie automatycznie,
                // a service worker onBackgroundMessage wyświetlałby je drugi raz.
                // Używamy tylko `data` — service worker sam wyświetla powiadomienie.
                data: {
                    title: title,
                    body: body,
                    url: link || '/dashboard',
                    icon: '/icon-192x192.png',
                    badge: '/icon-192x192.png'
                },
                webpush: {
                    headers: {
                        Urgency: 'high',
                        TTL: '86400'
                    },
                    fcmOptions: {
                        link: link || '/dashboard'
                    }
                }
            };

            await adminMessaging.send(message);
        } else {
            console.warn(`[FCM] adminMessaging is null — push notification NOT sent to coordinator ${coordinatorId}. Check Firebase Admin initialization.`);
        }

    } catch (e: unknown) {
        // Auto-cleanup expired/invalid FCM tokens (410 Gone, token-not-registered)
        const errorCode = (e as { code?: string })?.code;
        if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token'
        ) {
            console.warn(`FCM token expired for coordinator ${coordinatorId}, clearing subscription.`);
            try {
                const sheet = await getSheet('Coordinators', COORDINATOR_HEADERS);
                const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(Coordinators)');
                const coordRow = rows.find(r => r.get('uid') === coordinatorId);
                if (coordRow) {
                    coordRow.set('pushSubscription', '');
                    await withTimeout(coordRow.save(), TIMEOUT_MS, 'row.save(Coordinators)');
                    await invalidateSettingsCache();
                }
            } catch (cleanupErr) {
                console.error("Error cleaning up expired FCM token:", cleanupErr);
            }
        } else {
            console.error("Error sending push notification:", e);
        }
    }
}
