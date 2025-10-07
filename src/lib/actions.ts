
"use server";

import type { Employee, Settings, Notification, Coordinator, NotificationChange, HousingAddress, Room, Inspection } from '@/types';
import { getSheet } from '@/lib/sheets';
import { format, isEqual, parseISO, isPast } from 'date-fns';

const SHEET_NAME_EMPLOYEES = 'Employees';
const SHEET_NAME_NOTIFICATIONS = 'Powiadomienia';
const SHEET_NAME_ADDRESSES = 'Addresses';
const SHEET_NAME_ROOMS = 'Rooms';
const SHEET_NAME_NATIONALITIES = 'Nationalities';
const SHEET_NAME_DEPARTMENTS = 'Departments';
const SHEET_NAME_COORDINATORS = 'Coordinators';
const SHEET_NAME_INSPECTIONS = 'Inspections';
const SHEET_NAME_INSPECTION_DETAILS = 'InspectionDetails';


const serializeEmployee = (employee: Partial<Employee>): Record<string, string | number | boolean> => {
    const serialized: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(employee)) {
        if (value instanceof Date) {
            serialized[key] = format(value, 'yyyy-MM-dd');
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
    'departureReportDate', 'comments', 'status', 'oldAddress'
];

const COORDINATOR_HEADERS = ['uid', 'name', 'isAdmin', 'password'];


export async function getEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/employees`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch employees');
    return res.json();
  } catch (error) {
    console.error("Error in getEmployees:", error);
    throw new Error(`Could not fetch employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getSettings(): Promise<Settings> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/settings`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
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
            checkOutDate: null,
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

const formatDate = (date: Date | null | undefined): string => {
    if (!date || isNaN(date.getTime())) return 'N/A';
    return format(date, 'dd-MM-yyyy');
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
    };

    for (const key in newData) {
        if (key === 'id') continue;
        
        const typedKey = key as keyof Omit<Employee, 'id'>;
        const oldValue = oldData[typedKey];
        const newValue = newData[typedKey];
        
        let areEqual = false;
        
        const oldValueIsDate = oldValue instanceof Date;
        const newValueIsDate = newValue instanceof Date;

        if (oldValueIsDate && newValueIsDate) {
            areEqual = isEqual(oldValue, newValue);
        } else if (oldValueIsDate && typeof newValue === 'string') {
             areEqual = isEqual(oldValue, parseISO(newValue));
        } else if (typeof oldValue === 'string' && newValueIsDate) {
             areEqual = isEqual(parseISO(oldValue), newValue);
        } else if ((oldValue === null || oldValue === undefined) && (newValue === null || newValue === undefined)) {
             areEqual = true;
        } else if (oldValue === null || oldValue === undefined || newValue === null || newValue === undefined) {
             areEqual = oldValue === newValue;
        }
        else {
            areEqual = String(oldValue) === String(newValue);
        }

        if (!areEqual) {
             let oldFormatted: string;
             let newFormatted: string;
 
             if (oldValue instanceof Date) {
                 oldFormatted = formatDate(oldValue);
             } else {
                 oldFormatted = String(oldValue ?? 'N/A');
             }
 
             if (newValue instanceof Date) {
                 newFormatted = formatDate(newValue);
             } else if (typeof newValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(newValue)) {
                newFormatted = formatDate(parseDate(newValue));
             }
              else {
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
        
        const allEmployees: Employee[] = await getEmployees();
        const currentData = allEmployees.find(e => e.id === employeeId);
        if (!currentData) throw new Error("Employee not found for change detection");


        const changes = getChanges(currentData, employeeData);
        
        let action = 'zaktualizował(a) dane';
        if (employeeData.status) {
            if (employeeData.status === 'dismissed' && currentData.status !== 'dismissed') action = 'zwolnił(a)';
            if (employeeData.status === 'active' && currentData.status !== 'active') action = 'przywrócił(a)';
        } 
        
        const updatedData = { ...currentData, ...employeeData };
        const serializedData = serializeEmployee(updatedData);

        for (const key of sheet.headerValues) {
            if (key in serializedData) {
                rowToUpdate.set(key, serializedData[key as keyof typeof serializedData]);
            }
        }
        
        await rowToUpdate.save({ raw: false, valueInputOption: 'USER_ENTERED' });

        if(changes.length > 0 && createNotif) { 
            await createNotification(actor, action, updatedData, changes);
        }

        return updatedData;

    } catch (error) {
        console.error("Error updating employee in Google Sheets:", error);
        throw new Error(`Could not update employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/notifications`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch notifications');
        return res.json();
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/inspections`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch inspections');
        return res.json();
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
    
    const allDetailRows = await detailsSheet.getRows();
    const detailsToDelete = allDetailRows.filter(r => r.get('inspectionId') === inspectionId);
    
    const deletePromises = detailsToDelete.map(row => row.delete());
    await Promise.all(deletePromises);


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
        const deletePromises = detailsToDelete.map(row => row.delete());
        await Promise.all(deletePromises);

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


const parseDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
   if (!isNaN(date.getTime())) {
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date;
  }
  return null;
};

export async function checkAndUpdateEmployeeStatuses(): Promise<void> {
    try {
        const allEmployees = await getEmployees();
        const activeEmployees = allEmployees.filter(e => e.status === 'active');
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();

        const updates = [];

        for (const employee of activeEmployees) {
            if (employee.checkOutDate && isPast(employee.checkOutDate)) {
                const rowIndex = rows.findIndex(row => row.get('id') === employee.id);
                if (rowIndex !== -1) {
                    const rowToUpdate = rows[rowIndex];
                    rowToUpdate.set('status', 'dismissed');
                    updates.push(rowToUpdate.save({ raw: false, valueInputOption: 'USER_ENTERED' }));
                }
            }
        }
        await Promise.all(updates);
        if (updates.length > 0) {
            console.log(`Automatically dismissed ${updates.length} employees.`);
        }
    } catch (error) {
        console.error("Error checking and updating employee statuses:", error);
        // We don't throw here to avoid blocking the app load
    }
}
