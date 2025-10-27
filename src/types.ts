// This file contains all the TypeScript type definitions for the application's data structures.

export type View = 'dashboard' | 'employees' | 'settings' | 'inspections' | 'equipment';

export type Address = {
    id: string;
    name: string;
    coordinatorId: string;
    rooms: Room[];
}

export type Room = {
    id: string;
    name: string;
    capacity: number;
}

export type Coordinator = {
    uid: string;
    name: string;
    isAdmin: boolean;
    password?: string;
}

export interface TemporaryAccess {
  token: string;
  coordinatorId: string;
  coordinatorName: string;
  expires: string; // ISO date string
}

export type Settings = {
    id: 'global-settings';
    addresses: Address[];
    nationalities: string[];
    departments: string[];
    coordinators: Coordinator[];
    genders: string[];
    temporaryAccess: TemporaryAccess[];
}

export type DeductionReason = {
    id: string;
    label: string;
    amount: number | null;
    checked: boolean;
}

export type Employee = {
    id: string;
    fullName: string;
    coordinatorId: string;
    nationality: string;
    gender: string;
    address: string;
    roomNumber: string;
    zaklad: string; // department
    checkInDate: string; // YYYY-MM-DD
    checkOutDate?: string | null; // YYYY-MM-DD
    contractStartDate: string | null;
    contractEndDate: string | null;
    departureReportDate?: string | null; // YYYY-MM-DD
    comments?: string | null;
    status: 'active' | 'dismissed';
    oldAddress?: string;
    addressChangeDate?: string | null;
    depositReturned: 'Tak' | 'Nie' | 'Nie dotyczy' | null;
    depositReturnAmount: number | null;
    deductionRegulation: number | null; // potracenie_regulamin
    deductionNo4Months: number | null; // potracenie_4_msc
    deductionNo30Days: number | null; // potracenie_30_dni
    deductionReason?: DeductionReason[];
};

export type NonEmployee = {
    id: string;
    fullName: string;
    address: string;
    roomNumber: string;
    checkInDate: string; // YYYY-MM-DD
    checkOutDate?: string | null; // YYYY-MM-DD
    comments: string;
};

export type NotificationChange = {
    field: keyof Employee;
    oldValue: string;
    newValue: string;
}

export type Notification = {
    id: string;
    message: string;
    employeeId: string;
    employeeName: string;
    coordinatorId: string;
    coordinatorName: string;
    createdAt: string; // ISO date string
    isRead: boolean;
    changes: NotificationChange[];
}

export type SessionData = {
  isLoggedIn: boolean;
  uid: string;
  name: string;
  isAdmin: boolean;
}

export type InspectionCategoryItem = {
    label: string;
    value: any;
    type: 'text' | 'number' | 'select' | 'yes_no' | 'rating' | 'checkbox_group';
    options?: string[];
}

export type InspectionCategory = {
    name: string;
    items: InspectionCategoryItem[];
    uwagi: string;

    photos?: string[];
}

export type Inspection = {
    id: string;
    addressId: string;
    addressName: string;
    date: string; // YYYY-MM-DD
    coordinatorId: string;
    coordinatorName: string;
    standard: 'Wysoki' | 'Normalny' | 'Niski' | null;
    categories: InspectionCategory[];
};

export type EquipmentItem = {
    id: string;
    inventoryNumber: string;
    name: string;
    quantity: number;
    description: string;
    addressId: string;
    addressName: string;
}

export type ImportStatus = {
    jobId: string;
    fileName: string;
    status: 'processing' | 'completed' | 'failed';
    message: string;
    processedRows: number;
    totalRows: number;
    createdAt: string;
    actorName: string;
};
