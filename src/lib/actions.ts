
"use server";

import type { Employee, Settings, Notification, Coordinator, NotificationChange, HousingAddress, Room, Inspection, NonEmployee, DeductionReason } from '@/types';
import { getSheet, getEmployeesFromSheet, getSettingsFromSheet, getNotificationsFromSheet, getInspectionsFromSheet, getNonEmployeesFromSheet } from '@/lib/sheets';
import { format, isEqual, isPast, isValid, parse, startOfMonth, endOfMonth } from 'date-fns';
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
        createdAt: notification.createdAt,
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
const ADDRESS_HEADERS = ['id', 'name', 'coordinatorId'];

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

const deserializeEmployee = (row: any): Employee => {
    const plainObject = row;
    
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

export async function getEmployees(coordinatorId?: string): Promise<Employee[]> {
    try {
        const employees = await getEmployeesFromSheet(coordinatorId);
        return employees;
    } catch (error) {
        console.error("Error in getEmployees (actions):", error);
        throw error;
    }
}

export async function getNonEmployees(): Promise<NonEmployee[]> {
  try {
     const nonEmployees = await getNonEmployeesFromSheet();
     return nonEmployees;
  } catch (error) {
    console.error("Error in getNonEmployees (actions):", error);
    throw error;
  }
}

export async function getSettings(): Promise<Settings> {
    try {
        const settings = await getSettingsFromSheet();
        return settings;
    } catch (error) {
        console.error("Error in getSettings (actions):", error);
        throw error;
    }
}

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
        const actor = coordRows.find(r => r.get('uid') === actorUid)?.toObject();
        
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
    } catch (e) {
        console.error("Could not create notification:", e);
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
        };

        const serialized = serializeEmployee(newEmployee);
        await sheet.addRow(serialized, { raw: false, insert: true });
        
        await createNotification(actorUid, 'dodał', newEmployee);
    } catch (e) {
        console.error("Error adding employee:", e);
        throw e;
    }
}


export async function updateEmployee(employeeId: string, updates: Partial<Employee>, actorUid: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 2000 });
        const rowIndex = rows.findIndex(row => row.get('id') === employeeId);

        if (rowIndex === -1) {
            throw new Error('Employee not found');
        }

        const row = rows[rowIndex];
        const originalEmployee = deserializeEmployee(row.toObject());

        if (!originalEmployee) {
            throw new Error('Could not deserialize original employee data.');
        }
        
        const changes: NotificationChange[] = [];
        for (const key in updates) {
            const typedKey = key as keyof Employee;
            const oldValue = originalEmployee[typedKey];
            const newValue = updates[typedKey];
            
            const areDates = ['checkInDate', 'checkOutDate', 'contractStartDate', 'contractEndDate', 'departureReportDate'].includes(key);

            let oldValStr: string = 'Brak';
            let newValStr: string = 'Brak';

            if (oldValue) {
                oldValStr = areDates && isValid(new Date(oldValue as string)) ? format(new Date(oldValue as string), 'dd-MM-yyyy') : String(oldValue);
            }
            if (newValue) {
                newValStr = areDates && isValid(new Date(newValue as string)) ? format(new Date(newValue as string), 'dd-MM-yyyy') : String(newValue);
            }
           
            if (oldValStr !== newValStr) {
                changes.push({ field: typedKey, oldValue: oldValStr, newValue: newValStr });
            }

            row.set(key, serializeEmployee({ [key]: newValue })[key]);
        }

        await row.save();
        
        if (changes.length > 0) {
            await createNotification(actorUid, 'zaktualizował', originalEmployee, changes);
        }

    } catch (e) {
        console.error("Error updating employee:", e);
        throw e;
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
    } catch (e) {
        console.error("Error adding non-employee:", e);
        throw e;
    }
}

export async function updateNonEmployee(id: string, updates: Partial<NonEmployee>): Promise<void> {
     try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 1000 });
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
        console.error("Error updating non-employee:", e);
        throw e;
    }
}

export async function deleteNonEmployee(id: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 1000 });
        const row = rows.find(row => row.get('id') === id);
        if (row) {
            await row.delete();
        } else {
            throw new Error('Non-employee not found');
        }
    } catch (e) {
        console.error("Error deleting non-employee:", e);
        throw e;
    }
}


export async function bulkDeleteEmployees(status: 'active' | 'dismissed', actorUid: string): Promise<void> {
    try {
        const { coordinators } = await getSettings();
        const actor = coordinators.find(c => c.uid === actorUid);
        if (!actor?.isAdmin) {
            throw new Error("Only admins can bulk delete employees.");
        }
    
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 2000 });
        const rowsToDelete = rows.filter(row => row.get('status') === status);
        
        if (rowsToDelete.length === 0) {
            return;
        }

        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            await rowsToDelete[i].delete();
        }
    } catch (e) {
        console.error("Error bulk deleting employees:", e);
        throw e;
    }
}

export async function transferEmployees(fromCoordinatorId: string, toCoordinatorId: string, actor: Coordinator): Promise<void> {
    try {
        if (!actor?.isAdmin) {
            throw new Error("Only admins can transfer employees.");
        }
    
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows({ limit: 2000 });
        const rowsToTransfer = rows.filter(row => row.get('coordinatorId') === fromCoordinatorId);

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
    } catch (e) {
        console.error("Error transferring employees:", e);
        throw e;
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
    } catch (e) {
        console.error("Error updating statuses:", e);
        throw e;
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
            const addressesSheet = await getSheet(SHEET_NAME_ADDRESSES, ADDRESS_HEADERS);
            const roomsSheet = await getSheet(SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity']);
            
            const coordinatorsSheet = await getSheet(SHEET_NAME_COORDINATORS, ['uid', 'name']);
            const coordinatorRows = await coordinatorsSheet.getRows({ limit: 100 });
            const coordinator = coordinatorRows.find(row => row.get('name') === 'Holiadynets Oleksandr');
            const coordinatorId = coordinator ? coordinator.get('uid') : null;

            const addressesToUpdate = newSettings.addresses.map(addr => {
                if (!addr.coordinatorId && coordinatorId) {
                    addr.coordinatorId = coordinatorId;
                }
                return addr;
            });
            
            await addressesSheet.clearRows();
            await roomsSheet.clearRows();

            const allRooms: (Room & {addressId: string})[] = [];
            const addressesData = addressesToUpdate.map(addr => {
                addr.rooms.forEach(room => {
                    allRooms.push({ ...room, addressId: addr.id });
                });
                return { id: addr.id, name: addr.name, coordinatorId: addr.coordinatorId || '' };
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
        console.error("Error updating settings:", error);
        throw error;
    }
}


export async function getNotifications(): Promise<Notification[]> {
    try {
        const notifications = await getNotificationsFromSheet();
        return notifications;
    } catch (error) {
        console.error("Error in getNotifications (actions):", error);
        throw error;
    }
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const rows = await sheet.getRows({ limit: 200 });
        const row = rows.find(r => r.get('id') === notificationId);
        if (row) {
            row.set('isRead', 'TRUE');
            await row.save();
        }
    } catch (e) {
        console.error("Could not mark notification as read:", e);
        throw e;
    }
}

export async function clearAllNotifications(): Promise<void> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        await sheet.clearRows();
    } catch (e) {
        console.error("Could not clear notifications:", e);
        throw e;
    }
}


export async function getInspections(coordinatorId?: string): Promise<Inspection[]> {
    try {
        const inspections = await getInspectionsFromSheet(coordinatorId);
        return inspections;
    } catch (error) {
        console.error("Error in getInspections (actions):", error);
        throw error;
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
    } catch (e) {
        console.error("Error adding inspection:", e);
        throw e;
    }
}

export async function updateInspection(id: string, inspectionData: Omit<Inspection, 'id'>): Promise<void> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id', 'addressId', 'addressName', 'date', 'coordinatorId', 'coordinatorName', 'standard']);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['id', 'inspectionId', 'addressName', 'date', 'coordinatorName', 'category', 'itemLabel', 'itemValue', 'uwagi', 'photoData']);
        
        const inspectionRows = await inspectionsSheet.getRows({ limit: 1000 });
        const inspectionRow = inspectionRows.find(r => r.get('id') === id);
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
        const oldDetailRows = detailRows.filter(r => r.get('inspectionId') === id);
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
    } catch(e) {
        console.error("Error updating inspection:", e);
        throw e;
    }
}

export async function deleteInspection(id: string): Promise<void> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, ['id']);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, ['inspectionId']);

        const inspectionRows = await inspectionsSheet.getRows({ limit: 1000 });
        const inspectionRow = inspectionRows.find(r => r.get('id') === id);
        if (inspectionRow) {
            await inspectionRow.delete();
        }

        const detailRows = await detailsSheet.getRows({ limit: 5000 });
        const oldDetailRows = detailRows.filter(r => r.get('inspectionId') === id);
        for (let i = oldDetailRows.length - 1; i >= 0; i--) {
            await oldDetailRows[i].delete();
        }
    } catch(e) {
         console.error("Error deleting inspection:", e);
         throw e;
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


export async function bulkImportEmployees(fileData: ArrayBuffer, actorUid: string): Promise<{success: boolean, message: string}> {
    try {
        const settings = await getSettings();
        const actor = settings.coordinators.find(c => c.uid === actorUid);
        if (!actor?.isAdmin) {
            return { success: false, message: "Brak uprawnień do importu." };
        }
        
        const workbook = XLSX.read(fileData, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

        const requiredHeaders = ['fullName', 'coordinatorName', 'nationality', 'gender', 'address', 'roomNumber', 'zaklad', 'checkInDate'];
        const headers = Object.keys(json[0] || {});
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            return { success: false, message: `Brakujące kolumny w pliku: ${missingHeaders.join(', ')}` };
        }
        
        const employeesToAdd: (Partial<Employee>)[] = [];
        
        for (const row of json) {
            const coordinator = settings.coordinators.find(c => c.name.toLowerCase() === String(row.coordinatorName).toLowerCase());
            if (!coordinator) {
                console.warn(`Koordynator "${row.coordinatorName}" nie znaleziony, pomijanie pracownika ${row.fullName}.`);
                continue;
            }

            const checkInDate = parseAndFormatDate(row.checkInDate);
            
             if (!checkInDate) {
                console.warn(`Nieprawidłowa lub pusta data zameldowania dla ${row.fullName}, pomijanie.`);
                continue;
            }

            const employee: Partial<Employee> = {
                fullName: String(row.fullName),
                coordinatorId: coordinator.uid,
                nationality: String(row.nationality),
                gender: String(row.gender),
                address: String(row.address),
                roomNumber: String(row.roomNumber),
                zaklad: String(row.zaklad),
                checkInDate,
                contractStartDate: parseAndFormatDate(row.contractStartDate),
                contractEndDate: parseAndFormatDate(row.contractEndDate),
                departureReportDate: parseAndFormatDate(row.departureReportDate),
                comments: row.comments ? String(row.comments) : undefined,
            };
            employeesToAdd.push(employee);
        }
        
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const newRows = employeesToAdd.map(emp => serializeEmployee({ ...emp, id: `emp-${Date.now()}-${Math.random()}`, status: 'active' }));
        if (newRows.length > 0) {
            await sheet.addRows(newRows, { raw: false, insert: true });
        }

        return { success: true, message: `Pomyślnie zaimportowano ${employeesToAdd.length} pracowników.` };

    } catch (e: any) {
         return { success: false, message: e.message || "Wystąpił nieznany błąd podczas przetwarzania pliku." };
    }
}

export async function generateMonthlyReport(year: number, month: number): Promise<{ success: boolean; message?: string; fileContent?: string; fileName?: string }> {
    try {
        const startDate = startOfMonth(new Date(year, month - 1));
        const endDate = endOfMonth(new Date(year, month - 1));

        const allEmployees = await getEmployeesFromSheet();
        const allNonEmployees = await getNonEmployeesFromSheet();
        const allInspections = await getInspectionsFromSheet();
        const settings = await getSettingsFromSheet();
        
        const coordinatorMap = new Map(settings.coordinators.map(c => [c.uid, c.name]));

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

        const employeesHeaders = ["ID", "Imię i nazwisko", "Koordynator", "Adres", "Pokój", "Data zameldowania", "Data wymeldowania", "Status", "Potrącenia (zł)"];
        const employeesData = employeesInMonth.map(e => {
            const deductionReasonTotal = e.deductionReason?.reduce((sum, r) => sum + (r.checked && r.amount ? r.amount : 0), 0) || 0;
            const totalDeductions = (e.deductionRegulation || 0) + (e.deductionNo4Months || 0) + (e.deductionNo30Days || 0) + deductionReasonTotal;
            return [
                e.id, e.fullName, coordinatorMap.get(e.coordinatorId) || e.coordinatorId, e.address, e.roomNumber, e.checkInDate, e.checkOutDate || '', e.status, totalDeductions
            ];
        });
        const ws_employees = XLSX.utils.aoa_to_sheet([employeesHeaders, ...employeesData]);
        XLSX.utils.book_append_sheet(wb, ws_employees, "Pracownicy");

        const inspectionsHeaders = ["ID Inspekcji", "Adres", "Data", "Koordynator", "Standard"];
        const inspectionsData = inspectionsInMonth.map(i => [i.id, i.addressName, format(new Date(i.date), 'yyyy-MM-dd'), i.coordinatorName, i.standard || '']);
        const ws_inspections = XLSX.utils.aoa_to_sheet([inspectionsHeaders, ...inspectionsData]);
        XLSX.utils.book_append_sheet(wb, ws_inspections, "Inspekcje");
        
        const financeHeaders = ["Pracownik", "Zwrot kaucji", "Kwota zwrotu", "Potrącenie (regulamin)", "Potrącenie (4 msc)", "Potrącenie (30 dni)", "Potrącenia (inne)", "Suma potrąceń"];
        const financeData = employeesInMonth.filter(e => e.depositReturnAmount || e.deductionRegulation || e.deductionNo4Months || e.deductionNo30Days || e.deductionReason?.some(r => r.checked)).map(e => {
            const deductionReasonTotal = e.deductionReason?.reduce((sum, r) => sum + (r.checked && r.amount ? r.amount : 0), 0) || 0;
            const totalDeductions = (e.deductionRegulation || 0) + (e.deductionNo4Months || 0) + (e.deductionNo30Days || 0) + deductionReasonTotal;
            return [
                e.fullName, e.depositReturned || 'Nie dotyczy', e.depositReturnAmount || 0, e.deductionRegulation || 0, e.deductionNo4Months || 0, e.deductionNo30Days || 0, deductionReasonTotal, totalDeductions
            ];
        });
        const ws_finance = XLSX.utils.aoa_to_sheet([financeHeaders, ...financeData]);
        XLSX.utils.book_append_sheet(wb, ws_finance, "Finanse");

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const fileContent = buf.toString('base64');
        const fileName = `raport_miesieczny_${year}_${String(month).padStart(2, '0')}.xlsx`;

        return { success: true, fileContent, fileName };

    } catch (error) {
        console.error("Error generating monthly report:", error);
        if (error instanceof Error) {
            return { success: false, message: error.message };
        }
        return { success: false, message: "An unknown error occurred" };
    }
}
