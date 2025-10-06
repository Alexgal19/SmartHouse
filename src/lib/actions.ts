
"use server";

import type { Employee, Settings, Notification, Coordinator, NotificationChange, HousingAddress, Room, Inspection, InspectionCategoryItem, Photo, InspectionDetail } from '@/types';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { format, isEqual, parseISO } from 'date-fns';

// --- Credentials - In a real production app, use environment variables ---
const SPREADSHEET_ID = '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';
const SHEET_NAME_EMPLOYEES = 'Employees';
const SHEET_NAME_NOTIFICATIONS = 'Powiadomienia';
const SHEET_NAME_ADDRESSES = 'Addresses';
const SHEET_NAME_ROOMS = 'Rooms';
const SHEET_NAME_NATIONALITIES = 'Nationalities';
const SHEET_NAME_DEPARTMENTS = 'Departments';
const SHEET_NAME_COORDINATORS = 'Coordinators';
const SHEET_NAME_INSPECTIONS = 'Inspections';
const SHEET_NAME_INSPECTION_PHOTOS = 'InspectionPhotos';
const SHEET_NAME_INSPECTION_DETAILS = 'InspectionDetails';


const serviceAccountAuth = new JWT({
  email: "sheets-database-manager@hr-housing-hub-a2udq.iam.gserviceaccount.com",
  key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/Pogjqll3W46c\n3e/ktFVweN2TVq7bPcloNPlbGdIeN72MrjXsdpP8FdMDFywI+hWCQG0ouNnIiFJm\n67Rody5ul43LT0smTsliGkepNeUi6i4JLQL14sZGKvRyOa/Bs8JpIJ0Mb86VZTGY\n7gmgZjYDvkr7yv1UtURZBvzY6USMOCCZR6zvt9THswXgh3PVEhHFjiMHWxuLx/IV\nSaAxR53/kmv3Du17GtiYta2BaQMtYyUf2B8QRcY4aklxLMA8K7RKxTbgR/76b642\n7sFP4SmmTnjXo6YlIUvnAcY+WjLeF0OzKlAjNUX2hVptQP56oS1rd1vRBTLv0X16\nmX748CSVAgMBAAECggEABWlhE9VJs9Fw7ypuk+OweT7KUlWFHCoa7Wp2VegcpINC\nR11UpEzUsjDx6Cf7NIPTIPzuudTFQOHupv/rentI4pNCTWsAfuSC2VZSCc0/HyZO\nSC8wYsHYh3rGsQbF3O7XxP7JwuTVDTAwX5n4xsOtqpxzZb2gPonklbpXZFHxgSA2\n3w9clizXzHNdTNKCA/ooXFwn1snP4cRf2qWnwipbFqUFaUU9HSiSb6Ro9vbXKfNS\nJZsJmGI4txg+3w0EqHtAgryYv1RW7RdjNG2KjWwOBFeIDGPiR25ITQxuceqIzhzQ\nmPbV7SSEkLQRJiRjNlCNT+tom/KtZYn06jbBGm8O3wKBgQD2yMGgL15gwcqEcjdh\nAIyZR8UQm/wtgoZwU46G8wGOOBCv9dew+qUIMbAa8y1BKvmksjCMMf0vp9hn3SLw\nyT/XALTQ7jNMoPAj8ORaxvuU0J4ClRMEKu8nVkQkSLUSWECVWT+Uv1it+my6pkF0\nodEeQ/DlyAfMXk7pP2hRCa6FjwKBgQDGYtEOQ8aUWoF9vzt1ZQcvHoilyaIQZdja\nlY5RGzHw/upul3RWDcpIeExfop8hfqcOI6NnmlKmz2J33aFaLoic5N0vxivaQOIh\ndKpBrrSnWMEKzf9RzNckCVufkJnG6bIjyXbt6qsB+I7PGNo30lt292MMlyJZN6oi\ndefncBjJmwKBgCFwMkwyHuedWoN3tmk+Wc6rGtiVSiYgeXbe24ENjDhpAFnXRdKF\nI7dohCQirw8Vc54NRua4H0ZFx9zK6eEWY8AOKHHm1KydYex8x3RFYfFYExDmgh0e\ndCkwVytTbrV9n8KcxTCyfKGWPQVNYbEb++nN6uY3pFbcsHSKUugoF62hAoGAM8vj\nF11cwKksu/8s8AazrHrFZLvTY4Kj7tYzdTure2ejH8LNbhZlpSw7jJCyCZW+2jM1\n27vwLnthEzi7gwc5RfV/RpTwKCjeoauLNGD/692BcWe9bMcVuOP0lyGy9LtZdnyI\nX6/wfDBAYRP1DbQPi20l4EipgC/HbP3p0YR0BFcCgYEAil55HwxqHwKZO5tGgSFB\numU1tM3b6rpOvfIer9dUPqZN7+Pef9GaWQs2NvPIlSn0bEZnjevLk0QOnACLOwfk\nBDv783BdHhTbwPMH+TjKu4n2GwrHRF6T5bNgeGqVe8jvD+mzXe/KQO402s6r5Ue1\n9JhV9GM9wVmbgjsXlOfVxCg=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

const parseDate = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
   if (!isNaN(date.getTime())) {
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date;
  }
  return null;
};


const serializeEmployee = (employee: Partial<Employee>): Record<string, string | number | boolean> => {
    const serialized: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(employee)) {
        if (value instanceof Date) {
            serialized[key] = value.toISOString().split('T')[0];
        } else if (value !== null && value !== undefined) {
            serialized[key] = value.toString();
        } else {
            serialized[key] = '';
        }
    }
    return serialized;
};

const deserializeEmployee = (row: any): Employee => {
    const checkInDate = parseDate(row.get('checkInDate'));
    if (!checkInDate) {
        throw new Error(`Invalid or missing checkInDate for employee row: ${row.get('id')}`);
    }

    return {
        id: row.get('id'),
        fullName: row.get('fullName'),
        coordinatorId: row.get('coordinatorId'),
        nationality: row.get('nationality'),
        gender: row.get('gender') as 'Mężczyzna' | 'Kobieta',
        address: row.get('address'),
        roomNumber: row.get('roomNumber'),
        zaklad: row.get('zaklad'),
        checkInDate: checkInDate,
        checkOutDate: parseDate(row.get('checkOutDate')),
        contractStartDate: parseDate(row.get('contractStartDate')),
        contractEndDate: parseDate(row.get('contractEndDate')),
        departureReportDate: parseDate(row.get('departureReportDate')),
        comments: row.get('comments'),
        status: row.get('status') as 'active' | 'dismissed',
        oldAddress: row.get('oldAddress') || null,
    };
};

const deserializeNotification = (row: any): Notification => {
    const createdAtString = row.get('createdAt');
    const createdAt = new Date(createdAtString);
    if (isNaN(createdAt.getTime())) {
        console.error(`Invalid date string for notification: ${createdAtString}`);
    }
    const changesString = row.get('changes');
    return {
        id: row.get('id'),
        message: row.get('message'),
        employeeId: row.get('employeeId'),
        employeeName: row.get('employeeName'),
        coordinatorId: row.get('coordinatorId'),
        coordinatorName: row.get('coordinatorName'),
        createdAt: createdAt,
        isRead: row.get('isRead') === 'TRUE',
        changes: changesString ? JSON.parse(changesString) : [],
    };
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

async function getSheet(title: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        sheet = await doc.addSheet({ title, headerValues: headers });
    } else {
        const currentHeaders = sheet.headerValues;
        const missingHeaders = headers.filter(h => !currentHeaders.includes(h));
        if(missingHeaders.length > 0) {
            await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
        }
    }
    await sheet.loadHeaderRow();
    return sheet;
}


export async function getEmployees(): Promise<Employee[]> {
  try {
    const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
    const rows = await sheet.getRows();
    return rows.map(deserializeEmployee);
  } catch (error) {
    console.error("Error in getEmployees:", error);
    throw new Error(`Could not fetch employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getSettings(): Promise<Settings> {
  try {
    const nationalitiesSheet = await getSheet(SHEET_NAME_NATIONALITIES, ['name']);
    const departmentsSheet = await getSheet(SHEET_NAME_DEPARTMENTS, ['name']);
    const coordinatorsSheet = await getSheet(SHEET_NAME_COORDINATORS, ['uid', 'name']);
    const addressesSheet = await getSheet(SHEET_NAME_ADDRESSES, ['id', 'name']);
    const roomsSheet = await getSheet(SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity']);

    const [nationalityRows, departmentRows, coordinatorRows, addressRows, roomRows] = await Promise.all([
        nationalitiesSheet.getRows(),
        departmentsSheet.getRows(),
        coordinatorsSheet.getRows(),
        addressesSheet.getRows(),
        roomsSheet.getRows()
    ]);
    
    const allRooms: (Room & { addressId: string })[] = roomRows.map(row => ({
        id: row.get('id'),
        addressId: row.get('addressId'),
        name: row.get('name'),
        capacity: parseInt(row.get('capacity'), 10) || 0,
    }));
    
    const addresses: HousingAddress[] = addressRows.map(row => {
        const addressId = row.get('id');
        return {
            id: addressId,
            name: row.get('name'),
            rooms: allRooms.filter(room => room.addressId === addressId).map(({ addressId, ...rest }) => rest),
        };
    });
    
    const settings: Settings = {
      id: 'global-settings',
      addresses: addresses,
      nationalities: nationalityRows.map(row => row.get('name')),
      departments: departmentRows.map(row => row.get('name')),
      coordinators: coordinatorRows.map(row => ({
        uid: row.get('uid'),
        name: row.get('name'),
      })),
      genders: ['Mężczyzna', 'Kobieta'],
    };

    return settings;
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

        await sheet.addRow(serializeNotification(newNotification));
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
        const row = await sheet.addRow(serialized);
        const createdEmployee = deserializeEmployee(row);
        
        await createNotification(actor, 'dodał(a) nowego', createdEmployee);

        return createdEmployee;
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
        departureReportDate: 'Data zgłoszenia wyjazdu',
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

export async function updateEmployee(employeeId: string, employeeData: Partial<Omit<Employee, 'id'>>, actor: Coordinator): Promise<Employee> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(row => row.get('id') === employeeId);

        if (rowIndex === -1) {
            throw new Error("Employee not found");
        }
        
        const rowToUpdate = rows[rowIndex];
        const currentData = deserializeEmployee(rowToUpdate);
        
        const changes = getChanges(currentData, employeeData);
        if(changes.length === 0 && !('status' in employeeData)) { 
              return currentData;
        }
        
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
        
        await rowToUpdate.save();

        const savedRows = await sheet.getRows();
        const finalEmployee = deserializeEmployee(savedRows[rowIndex]);
        
        await createNotification(actor, action, finalEmployee, changes);

        return finalEmployee;

    } catch (error) {
        console.error("Error updating employee in Google Sheets:", error);
        throw new Error(`Could not update employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function syncSheet<T extends Record<string, any>>(
    sheetName: string,
    headers: string[],
    newData: T[],
    idKey: keyof T,
    serializeFn: (item: T) => Record<string, any> = (item) => item
) {
    const sheet = await getSheet(sheetName, headers);
    await sheet.clearRows();
    if (newData.length > 0) {
        const serializedData = newData.map(serializeFn);
        await sheet.addRows(serializedData);
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
            await syncSheet(SHEET_NAME_ADDRESSES, ['id', 'name'], updatedSettings.addresses, 'id', item => ({ id: item.id, name: item.name }));
            await syncSheet(SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity'], allRooms, 'id');
        }
        if (newSettings.nationalities) {
            await syncSheet(SHEET_NAME_NATIONALITIES, ['name'], updatedSettings.nationalities.map(name => ({ name })), 'name');
        }
        if (newSettings.departments) {
            await syncSheet(SHEET_NAME_DEPARTMENTS, ['name'], updatedSettings.departments.map(name => ({ name })), 'name');
        }
        if (newSettings.coordinators) {
            await syncSheet(SHEET_NAME_COORDINATORS, ['uid', 'name'], updatedSettings.coordinators, 'uid');
        }
        
        return getSettings();
    } catch (error) {
        console.error("Error updating settings in Google Sheets:", error);
        throw new Error("Could not update settings.");
    }
}


export async function getNotifications(): Promise<Notification[]> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const rows = await sheet.getRows();
        return rows.map(deserializeNotification).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
            await rowToUpdate.save();
        }
    } catch (error) {
        console.error("Error marking notification as read:", error);
    }
}

// --- Inspections Actions ---

const INSPECTION_HEADERS = ['id', 'addressId', 'addressName', 'date', 'coordinatorId', 'coordinatorName', 'standard'];
const PHOTO_HEADERS = ['id', 'inspectionId', 'photoData'];
const INSPECTION_DETAILS_HEADERS = ['id', 'inspectionId', 'category', 'itemLabel', 'itemValue', 'uwagi'];

const serializeRaw = (value: any): string | number | boolean => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return value;
};

const serializeInspection = (inspection: Omit<Inspection, 'photos' | 'categories'>): Record<string, string | number | boolean> => ({
    id: inspection.id,
    addressId: inspection.addressId,
    addressName: inspection.addressName,
    date: inspection.date.toISOString(),
    coordinatorId: inspection.coordinatorId,
    coordinatorName: inspection.coordinatorName,
    standard: serializeRaw(inspection.standard),
});

const deserializeInspection = (row: any, allDetails: InspectionDetail[], allPhotos: Photo[]): Inspection => {
    const inspectionId = row.get('id');
    const detailsForInspection = allDetails.filter(d => d.inspectionId === inspectionId);
    
    const categoriesMap = detailsForInspection.reduce((acc, detail) => {
        if (!acc[detail.category]) {
            acc[detail.category] = { name: detail.category, items: [], uwagi: '' };
        }
        if (detail.itemLabel) {
            const valueStr = detail.itemValue;
            let value: any = valueStr;
            
            if (valueStr === 'true') value = true;
            else if (valueStr === 'false') value = false;
            else if (valueStr && !isNaN(Number(valueStr)) && valueStr.trim() !== '') value = Number(valueStr);
            else if (valueStr === null || valueStr === '') value = null;

            const existingItem = acc[detail.category].items.find(i => i.label === detail.itemLabel);
            if (!existingItem) {
                 const itemFromChecklist = getInitialChecklist().flatMap(c => c.items).find(i => i.label === detail.itemLabel);
                 acc[detail.category].items.push({
                    type: itemFromChecklist?.type || 'info',
                    label: detail.itemLabel, 
                    value: value,
                    options: itemFromChecklist?.options
                });
            }
        }
        if (detail.uwagi && !acc[detail.category].uwagi) {
            acc[detail.category].uwagi = detail.uwagi;
        }
        return acc;
    }, {} as Record<string, {name: string, items: InspectionCategoryItem[], uwagi: string}>);

    const checklistCategories = getInitialChecklist();
    const finalCategories = checklistCategories.map(checklistCategory => {
        const foundCategory = categoriesMap[checklistCategory.name];
        if (foundCategory) {
            const finalItems = checklistCategory.items.map(checklistItem => {
                const foundItem = foundCategory.items.find(i => i.label === checklistItem.label);
                return foundItem || checklistItem;
            });
            return { ...checklistCategory, items: finalItems, uwagi: foundCategory.uwagi || '' };
        }
        return checklistCategory;
    });

    return {
        id: inspectionId,
        addressId: row.get('addressId'),
        addressName: row.get('addressName'),
        date: new Date(row.get('date')),
        coordinatorId: row.get('coordinatorId'),
        coordinatorName: row.get('coordinatorName'),
        standard: (row.get('standard') as 'Wysoki' | 'Normalny' | 'Niski') || null,
        categories: finalCategories,
        photos: allPhotos.filter(p => p.inspectionId === inspectionId).map(p => p.photoData),
    }
};

const cleanlinessOptions = ["Bardzo czysto", "Czysto", "Brudno", "Bardzo brudno"];

const getInitialChecklist = (): InspectionCategory[] => [
    {
        name: "Kuchnia", uwagi: "", items: [
            { label: "Czystość kuchnia", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość lodówki", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość płyty gazowej, elektrycznej i piekarnika", type: "select", value: null, options: cleanlinessOptions }
        ]
    },
    {
        name: "Łazienka", uwagi: "", items: [
            { label: "Czystość łazienki", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość toalety", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość brodzika", type: "select", value: null, options: cleanlinessOptions },
        ]
    },
    {
        name: "Pokoje", uwagi: "", items: [
            { label: "Czystość pokoju", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czy niema pleśni w pomieszczeniach?", type: "yes_no", value: null },
            { label: "Łóżka niepołamane", type: "yes_no", value: null },
            { label: "Sciany czyste", type: "yes_no", value: null },
            { label: "Szafy i szafki czyste", type: "yes_no", value: null },
            { label: "Stare rzeczy wyrzucane", type: "yes_no", value: null },
            { label: "Pościel czysta", type: "yes_no", value: null },
            { label: "Wyposażenia niezniszczone", type: "yes_no", value: null },
        ]
    },
    {
        name: "Instalacja", uwagi: "", items: [
            { label: "Instalacja gazowa działa", type: "yes_no", value: null },
            { label: "Instalacja internetowa działa", type: "yes_no", value: null },
            { label: "Instalacja elektryczna działa", type: "yes_no", value: null },
            { label: "Instalacja wodno-kanalizacyjna działa", type: "yes_no", value: null },
            { label: "Ogrzewania", type: "text", value: "" },
            { label: "Temperatura w pomieszczeniu", type: "text", value: "" }
        ]
    },
];

export async function getInspections(): Promise<Inspection[]> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, INSPECTION_HEADERS);
        const photosSheet = await getSheet(SHEET_NAME_INSPECTION_PHOTOS, PHOTO_HEADERS);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, INSPECTION_DETAILS_HEADERS);
        
        const [inspectionRows, photoRows, detailRows] = await Promise.all([
            inspectionsSheet.getRows(),
            photosSheet.getRows(),
            detailsSheet.getRows(),
        ]);

        const allPhotos: Photo[] = photoRows.map(row => ({
            id: row.get('id'),
            inspectionId: row.get('inspectionId'),
            photoData: row.get('photoData'),
        }));
        
        const allDetails: InspectionDetail[] = detailRows.map(row => ({
            id: row.get('id'),
            inspectionId: row.get('inspectionId'),
            category: row.get('category'),
            itemLabel: row.get('itemLabel') || null,
            itemValue: row.get('itemValue') || null,
            uwagi: row.get('uwagi') || null,
        }));


        return inspectionRows
            .map(row => deserializeInspection(row, allDetails, allPhotos))
            .sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
        console.error("Error fetching inspections:", error);
        return [];
    }
}

async function saveInspectionData(inspectionData: Omit<Inspection, 'id'>, id?: string) {
    const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, INSPECTION_HEADERS);
    const photosSheet = await getSheet(SHEET_NAME_INSPECTION_PHOTOS, PHOTO_HEADERS);
    const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, INSPECTION_DETAILS_HEADERS);

    const inspectionId = id || `insp-${Date.now()}`;
    const { photos, categories, ...restOfData } = inspectionData;

    const mainInspectionData = serializeInspection({ ...restOfData, id: inspectionId });

    if (id) {
        const allRows = await inspectionsSheet.getRows();
        const rowToUpdate = allRows.find(row => row.get('id') === id);
        if (rowToUpdate) {
             Object.keys(mainInspectionData).forEach(key => {
                rowToUpdate.set(key, mainInspectionData[key as keyof typeof mainInspectionData]);
            });
            await rowToUpdate.save();
        } else {
            throw new Error("Inspection to update not found");
        }
    } else {
        await inspectionsSheet.addRow(mainInspectionData, { raw: true });
    }

    const allDetailRows = await detailsSheet.getRows();
    const detailsToDelete = allDetailRows.filter(r => r.get('inspectionId') === inspectionId);
    await Promise.all(detailsToDelete.map(row => row.delete()));
    
    const detailPayload = [];
    for (const category of categories) {
        if (category.items.length === 0 && category.uwagi) {
             detailPayload.push({
                id: `detail-${Date.now()}-${Math.random()}`,
                inspectionId: inspectionId,
                category: category.name,
                itemLabel: null,
                itemValue: null,
                uwagi: category.uwagi,
            });
        } else {
            for (const item of category.items) {
                 detailPayload.push({
                    id: `detail-${Date.now()}-${Math.random()}`,
                    inspectionId: inspectionId,
                    category: category.name,
                    itemLabel: item.label,
                    itemValue: serializeRaw(item.value),
                    uwagi: category.uwagi || null,
                });
            }
        }
    }
     if(detailPayload.length > 0) await detailsSheet.addRows(detailPayload, { raw: true });
    
    const allPhotoRows = await photosSheet.getRows();
    const photosToDelete = allPhotoRows.filter(r => r.get('inspectionId') === inspectionId);
    await Promise.all(photosToDelete.map(row => row.delete()));
    
    if (photos && photos.length > 0) {
        const photoPayload = photos.map(photoData => ({
             id: `photo-${Date.now()}-${Math.random()}`,
             inspectionId: inspectionId,
             photoData: photoData,
        }));
        await photosSheet.addRows(photoPayload, {raw: false});
    }
}

export async function addInspection(inspectionData: Omit<Inspection, 'id'>): Promise<void> {
    try {
        await saveInspectionData(inspectionData);
    } catch (error) {
        console.error("Error in addInspection:", error);
        if (error instanceof Error && (error.message.includes('exceeds the maximum size') || error.message.includes('request entity too large'))) {
             throw new Error("One of the photos is too large to be saved. Please use smaller image files.");
        }
        throw new Error("Could not add inspection.");
    }
}

export async function updateInspection(id: string, inspectionData: Omit<Inspection, 'id'>): Promise<void> {
    try {
        await saveInspectionData(inspectionData, id);
    } catch (error) {
        console.error("Error in updateInspection:", error);
        if (error instanceof Error && (error.message.includes('exceeds the maximum size') || error.message.includes('request entity too large'))) {
             throw new Error("One of the photos is too large to be saved. Please use smaller image files.");
        }
        throw new Error("Could not update inspection.");
    }
}

export async function deleteInspection(id: string): Promise<void> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, INSPECTION_HEADERS);
        const photosSheet = await getSheet(SHEET_NAME_INSPECTION_PHOTOS, PHOTO_HEADERS);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, INSPECTION_DETAILS_HEADERS);

        const allInspectionRows = await inspectionsSheet.getRows();
        const inspectionRow = allInspectionRows.find(r => r.get('id') === id);
        if (inspectionRow) {
            await inspectionRow.delete();
        }

        const allDetailRows = await detailsSheet.getRows();
        const detailsToKeep = allDetailRows.filter(r => r.get('inspectionId') !== id);
        await detailsSheet.clearRows();
        if(detailsToKeep.length > 0) {
            await detailsSheet.addRows(detailsToKeep.map(r => r.toObject()));
        }


        const allPhotoRows = await photosSheet.getRows();
        const photosToKeep = allPhotoRows.filter(r => r.get('inspectionId') !== id);
        await photosSheet.clearRows();
        if(photosToKeep.length > 0) {
            await photosSheet.addRows(photosToKeep.map(r => r.toObject()));
        }

    } catch (error) {
        console.error("Error in deleteInspection:", error);
        throw new Error(`Could not delete inspection. ${error instanceof Error ? error.message : ''}`);
    }
}
