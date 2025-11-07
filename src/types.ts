// This file contains all the TypeScript type definitions for the application's data structures.

export type View = 'dashboard' | 'employees' | 'settings' | 'housing';

export type Address = {
    id: string;
    locality: string;
    name: string;
    coordinatorIds: string[];
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
    departments: string[];
    password?: string;
}

export type Settings = {
    id: 'global-settings';
    addresses: Address[];
    nationalities: string[];
    departments: string[];
    coordinators: Coordinator[];
    genders: string[];
    localities: string[];
    inspectionTemplate: InspectionTemplateCategory[];
}

export type ChartConfig = {
  [key in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & ({
    color?: string
    theme?: never
  } | {
    color?: never
    theme: {
      light: string
      dark: string
    }
  })
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
    zaklad: string | null; // department
    checkInDate: string | null; // YYYY-MM-DD
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
    deductionReason: DeductionReason[] | undefined;
};

export type NonEmployee = {
    id: string;
    fullName: string;
    coordinatorId: string;
    nationality: string;
    gender: string;
    address: string;
    roomNumber: string;
    checkInDate: string | null; // YYYY-MM-DD
    checkOutDate?: string | null; // YYYY-MM-DD
    departureReportDate?: string | null; // YYYY-MM-DD
    comments: string;
};

export type NotificationChange = {
    field: keyof Employee | keyof NonEmployee;
    oldValue: string;
    newValue: string;
}

export type NotificationType = 'success' | 'destructive' | 'warning' | 'info';

export type Notification = {
    id: string;
    message: string;
    entityId: string;
    entityName: string;
    coordinatorId: string;
    coordinatorName: string;
    createdAt: string; // ISO date string
    isRead: boolean;
    type: NotificationType;
    changes: NotificationChange[];
}

export type SessionData = {
  isLoggedIn: boolean;
  uid: string;
  name: string;
  isAdmin: boolean;
}

export type EquipmentItem = {
    id: string;
    inventoryNumber: string;
    name: string;
    quantity: number;
    description: string;
    addressId: string;
    addressName: string;
}

export type InspectionTemplateCategory = {
    name: string;
    items: {
        label: string;
        type: 'rating' | 'yes_no' | 'text' | 'checkbox_group' | 'select' | 'number';
        options?: string[];
    }[];
}

export type InspectionCategory = {
    name: string;
    items: {
        label: string;
        value: any;
    }[];
    uwagi: string;
    photos: string[]; // base64 encoded images
}

export type Inspection = {
    id: string;
    addressId: string;
    addressName: string;
    date: string; // ISO date string
    coordinatorId: string;
    coordinatorName: string;
    standard: 'Wysoki' | 'Normalny' | 'Niski' | null;
    categories: InspectionCategory[];
}
