
"use server";
// src/lib/sheets.ts
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Employee, Settings, Notification, Coordinator, NotificationChange, HousingAddress, Room, Inspection, InspectionCategory, InspectionCategoryItem, Photo, InspectionDetail, NonEmployee, DeductionReason } from '@/types';
import { format, isValid, parse } from 'date-fns';

const SPREADSHEET_ID = '1UYe8N29Q3Eus-6UEOkzCNfzwSKmQ-kpITgj4SWWhpbw';
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


const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

const deserializeEmployee = (row: any): Employee | null => {
    const id = row.get('id');
    const fullName = row.get('fullName');
    
    // Ignore empty rows
    if (!id && !fullName) {
        return null;
    }

    const checkInDate = row.get('checkInDate');
    if (!checkInDate) {
        console.warn(`Invalid or missing checkInDate for employee row, but loading anyway: ${id || fullName}`);
    }

    const deductionReasonRaw = row.get('deductionReason');
    let deductionReason: DeductionReason[] | undefined = undefined;
    if (deductionReasonRaw && typeof deductionReasonRaw === 'string') {
        try {
            const parsed = JSON.parse(deductionReasonRaw);
            if(Array.isArray(parsed)) {
                deductionReason = parsed;
            }
        } catch(e) {
            // It's probably an old string array, try to adapt it
            try {
                const oldArray = JSON.parse(`[${deductionReasonRaw}]`);
                 if(Array.isArray(oldArray)){
                    deductionReason = oldArray.map((name: string) => ({ name, checked: true, amount: null }));
                 }
            } catch (e2) {
                 // Or just a single string
                 if(deductionReasonRaw.trim()) {
                    deductionReason = [{ name: deductionReasonRaw, checked: true, amount: null }];
                 }
            }
        }
    }

    return {
        id: id,
        fullName: fullName,
        coordinatorId: row.get('coordinatorId'),
        nationality: row.get('nationality'),
        gender: row.get('gender') as string,
        address: row.get('address'),
        roomNumber: row.get('roomNumber'),
        zaklad: row.get('zaklad'),
        checkInDate: checkInDate || '',
        checkOutDate: row.get('checkOutDate') || undefined,
        contractStartDate: row.get('contractStartDate') || undefined,
        contractEndDate: row.get('contractEndDate') || undefined,
        departureReportDate: row.get('departureReportDate') || undefined,
        comments: row.get('comments'),
        status: row.get('status') as 'active' | 'dismissed',
        oldAddress: row.get('oldAddress') || undefined,
        depositReturned: row.get('depositReturned') as Employee['depositReturned'] || null,
        depositReturnAmount: row.get('depositReturnAmount') ? parseFloat(row.get('depositReturnAmount')) : null,
        deductionRegulation: row.get('deductionRegulation') ? parseFloat(row.get('deductionRegulation')) : null,
        deductionNo4Months: row.get('deductionNo4Months') ? parseFloat(row.get('deductionNo4Months')) : null,
        deductionNo30Days: row.get('deductionNo30Days') ? parseFloat(row.get('deductionNo30Days')) : null,
        deductionReason: deductionReason,
    };
};

const deserializeNonEmployee = (row: any): NonEmployee | null => {
    const id = row.get('id');
    const fullName = row.get('fullName');
    
    if (!id && !fullName) {
        return null;
    }

    const checkInDate = row.get('checkInDate');
    if (!checkInDate) {
        return null;
    }

    return {
        id: id,
        fullName: fullName,
        address: row.get('address'),
        roomNumber: row.get('roomNumber'),
        checkInDate: checkInDate,
        checkOutDate: row.get('checkOutDate') || undefined,
        comments: row.get('comments'),
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

export async function getSheet(title: string, headers: string[]): Promise<GoogleSpreadsheetWorksheet> {
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        sheet = await doc.addSheet({ title, headerValues: headers });
    } else {
        await sheet.loadHeaderRow();
        const currentHeaders = sheet.headerValues;
        const missingHeaders = headers.filter(h => !currentHeaders.includes(h));
        if(missingHeaders.length > 0) {
            await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
        }
    }
    return sheet;
}


export async function getEmployeesFromSheet({
    page = 1,
    limit = 50,
    filters = {},
    searchTerm = '',
    status = 'all',
    all = false
}: {
    page?: number;
    limit?: number;
    filters?: Record<string, string>;
    searchTerm?: string;
    status?: 'active' | 'dismissed' | 'all';
    all?: boolean;
} = {}): Promise<{ employees: Employee[], total: number }> {
    try {
        const sheet = await getSheet(SHEET_NAME_EMPLOYEES, EMPLOYEE_HEADERS);
        const rows = await sheet.getRows();
        
        const allEmployees = rows.map(deserializeEmployee).filter((e): e is Employee => e !== null);

        if (all) {
            return { employees: allEmployees, total: allEmployees.length };
        }

        const filtered = allEmployees.filter(employee => {
            const statusMatch = status === 'all' || employee.status === status;
            const searchMatch = searchTerm === '' || employee.fullName.toLowerCase().includes(searchTerm.toLowerCase());
            
            const filterMatch = Object.entries(filters).every(([key, value]) => {
                if (value === 'all') return true;
                return employee[key as keyof Employee] === value;
            });

            return statusMatch && searchMatch && filterMatch;
        });

        const total = filtered.length;
        const paginated = filtered.slice((page - 1) * limit, page * limit);
        
        return { employees: paginated, total };

    } catch (error) {
        console.error("Error in getEmployees from sheets.ts:", error);
        throw new Error(`Could not fetch employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function getNonEmployeesFromSheet(): Promise<NonEmployee[]> {
  try {
    const sheet = await getSheet(SHEET_NAME_NON_EMPLOYEES, NON_EMPLOYEE_HEADERS);
    const rows = await sheet.getRows();
    return rows.map(deserializeNonEmployee).filter((ne): ne is NonEmployee => ne !== null);
  } catch (error) {
    console.error("Error in getNonEmployees from sheets.ts:", error);
    throw new Error(`Could not fetch non-employees: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getSettingsFromSheet(): Promise<Settings> {
  try {
    const nationalitiesSheet = await getSheet(SHEET_NAME_NATIONALITIES, ['name']);
    const departmentsSheet = await getSheet(SHEET_NAME_DEPARTMENTS, ['name']);
    const coordinatorsSheet = await getSheet(SHEET_NAME_COORDINATORS, COORDINATOR_HEADERS);
    const addressesSheet = await getSheet(SHEET_NAME_ADDRESSES, ['id', 'name']);
    const roomsSheet = await getSheet(SHEET_NAME_ROOMS, ['id', 'addressId', 'name', 'capacity']);
    const gendersSheet = await getSheet(SHEET_NAME_GENDERS, ['name']);

    const [nationalityRows, departmentRows, coordinatorRows, addressRows, roomRows, genderRows] = await Promise.all([
        nationalitiesSheet.getRows(),
        departmentsSheet.getRows(),
        coordinatorsSheet.getRows(),
        addressesSheet.getRows(),
        roomsSheet.getRows(),
        gendersSheet.getRows()
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
    
    const genders = genderRows.map(row => row.get('name'));

    const settings: Settings = {
      id: 'global-settings',
      addresses: addresses,
      nationalities: nationalityRows.map(row => row.get('name')),
      departments: departmentRows.map(row => row.get('name')),
      coordinators: coordinatorRows.map(row => ({
        uid: row.get('uid'),
        name: row.get('name'),
        isAdmin: row.get('isAdmin') === 'TRUE',
        password: row.get('password') || '',
      })),
      genders: genders.length > 0 ? genders : ['Mężczyzna', 'Kobieta'],
    };

    return settings;
  } catch (error) {
    console.error("Error in getSettings:", error);
    throw new Error(`Could not fetch settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getNotificationsFromSheet(): Promise<Notification[]> {
    try {
        const sheet = await getSheet(SHEET_NAME_NOTIFICATIONS, ['id', 'message', 'employeeId', 'employeeName', 'coordinatorId', 'coordinatorName', 'createdAt', 'isRead', 'changes']);
        const rows = await sheet.getRows();
        return rows.map(deserializeNotification).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return [];
    }
}

const INSPECTION_HEADERS = ['id', 'addressId', 'addressName', 'date', 'coordinatorId', 'coordinatorName', 'standard'];
const INSPECTION_DETAILS_HEADERS = ['id', 'inspectionId', 'addressName', 'date', 'coordinatorName', 'category', 'itemLabel', 'itemValue', 'uwagi', 'photoData'];

const cleanlinessOptions = ["Bardzo czysto", "Czysto", "Brudno", "Bardzo brudno"];

const getInitialChecklist = (): InspectionCategory[] => [
    {
        name: "Kuchnia", uwagi: "", items: [
            { label: "Czystość kuchnia", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość lodówki", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość płyty gazowej, elektrycznej i piekarnika", type: "select", value: null, options: cleanlinessOptions }
        ], photos: []
    },
    {
        name: "Łazienka", uwagi: "", items: [
            { label: "Czystość łazienki", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość toalety", type: "select", value: null, options: cleanlinessOptions },
            { label: "Czystość brodzika", type: "select", value: null, options: cleanlinessOptions },
        ], photos: []
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
        ], photos: []
    },
    {
        name: "Instalacja", uwagi: "", items: [
            { label: "Instalacja gazowa działa", type: "yes_no", value: null },
            { label: "Instalacja internetowa działa", type: "yes_no", value: null },
            { label: "Instalacja elektryczna działa", type: "yes_no", value: null },
            { label: "Instalacja wodno-kanalizacyjna działa", type: "yes_no", value: null },
            { label: "Ogrzewania", type: "text", value: "" },
            { label: "Temperatura w pomieszczeniu", type: "text", value: "" }
        ], photos: []
    },
     {
        name: "Liczniki", uwagi: "", items: [], photos: []
    },
];

const deserializeInspection = (row: any, allDetails: InspectionDetail[]): Inspection | null => {
    const inspectionId = row.get('id');
    const addressName = row.get('addressName');

    if (!inspectionId && !addressName) {
        return null;
    }
    
    const detailsForInspection = allDetails.filter(d => d.inspectionId === inspectionId);
    
    const categoriesMap = detailsForInspection.reduce((acc, detail) => {
        if (!acc[detail.category]) {
            acc[detail.category] = { name: detail.category, items: [], uwagi: '', photos: [] };
        }

        if(detail.itemLabel === 'Photo' && detail.photoData) {
            acc[detail.category].photos!.push(detail.photoData);
        }
        else if (detail.itemLabel) {
            const valueStr = detail.itemValue;
            let value: any = valueStr;
            
            if (valueStr === 'true') value = true;
            else if (valueStr === 'false') value = false;
            else if (valueStr && valueStr.startsWith('[') && valueStr.endsWith(']')) {
                try { value = JSON.parse(valueStr); } catch (e) { value = []; }
            }
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
    }, {} as Record<string, {name: string, items: InspectionCategoryItem[], uwagi: string, photos?: string[]}>);

    const checklistCategories = getInitialChecklist();
    const finalCategories = checklistCategories.map(checklistCategory => {
        const foundCategory = categoriesMap[checklistCategory.name];
        if (foundCategory) {
            const finalItems = checklistCategory.items.map(checklistItem => {
                const foundItem = foundCategory.items.find(i => i.label === checklistItem.label);
                return foundItem || checklistItem;
            });
            return { ...checklistCategory, items: finalItems, uwagi: foundCategory.uwagi || '', photos: foundCategory.photos || [] };
        }
        return checklistCategory;
    });

    return {
        id: inspectionId,
        addressId: row.get('addressId'),
        addressName: addressName,
        date: new Date(row.get('date')),
        coordinatorId: row.get('coordinatorId'),
        coordinatorName: row.get('coordinatorName'),
        standard: (row.get('standard') as 'Wysoki' | 'Normalny' | 'Niski') || null,
        categories: finalCategories,
    }
};

export async function getInspectionsFromSheet(): Promise<Inspection[]> {
    try {
        const inspectionsSheet = await getSheet(SHEET_NAME_INSPECTIONS, INSPECTION_HEADERS);
        const detailsSheet = await getSheet(SHEET_NAME_INSPECTION_DETAILS, INSPECTION_DETAILS_HEADERS);
        
        const [inspectionRows, detailRows] = await Promise.all([
            inspectionsSheet.getRows(),
            detailsSheet.getRows(),
        ]);
        
        const allDetails: InspectionDetail[] = detailRows.map(row => ({
            id: row.get('id'),
            inspectionId: row.get('inspectionId'),
            addressName: row.get('addressName'),
            date: row.get('date'),
            coordinatorName: row.get('coordinatorName'),
            category: row.get('category'),
            itemLabel: row.get('itemLabel') || null,
            itemValue: row.get('itemValue') || null,
            uwagi: row.get('uwagi') || null,
            photoData: row.get('photoData') || null,
        }));


        return inspectionRows
            .map(row => deserializeInspection(row, allDetails))
            .filter((i): i is Inspection => i !== null)
            .sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
        console.error("Error fetching inspections:", error);
        return [];
    }
}
