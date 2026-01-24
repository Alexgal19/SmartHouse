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
    visibilityMode?: 'department' | 'strict';
    pushSubscription?: string | null;
}

export type Settings = {
    id: 'global-settings';
    addresses: Address[];
    nationalities: string[];
    departments: string[];
    coordinators: Coordinator[];
    genders: string[];
    localities: string[];
    paymentTypesNZ: string[];
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
    firstName: string;
    lastName: string;
    fullName: string;
    coordinatorId: string;
    nationality: string;
    gender: string;
    address: string;
    ownAddress?: string | null;
    roomNumber: string;
    zaklad: string | null; // department
    checkInDate: string | null; // YYYY-MM-DD
    checkOutDate?: string | null; // YYYY-MM-DD
    contractStartDate: string | null;
    contractEndDate: string | null;
    departureReportDate?: string | null; // YYYY-MM-DD
    comments?: string | null;
    status: 'active' | 'dismissed';
    depositReturned: 'Tak' | 'Nie' | 'Nie dotyczy' | null;
    depositReturnAmount: number | null;
    deductionRegulation: number | null; // potracenie_regulamin
    deductionNo4Months: number | null; // potracenie_4_msc
    deductionNo30Days: number | null; // potracenie_30_dni
    deductionReason: DeductionReason[] | undefined;
    deductionEntryDate?: string | null;
};

export type NonEmployee = {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    coordinatorId: string;
    nationality: string;
    gender: string;
    address: string;
    roomNumber: string;
    checkInDate: string | null;
    checkOutDate?: string | null;
    departureReportDate?: string | null; // YYYY-MM-DD
    comments?: string | null;
    status: 'active' | 'dismissed';
    paymentType: string | null;
    paymentAmount: number | null;
};

export type AddressHistory = {
    id: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    coordinatorName: string;
    department: string;
    address: string;
    checkInDate: string | null;
    checkOutDate: string | null;
};

export type AssignmentHistory = {
    id: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    fromCoordinatorId: string;
    toCoordinatorId: string;
    assignedBy: string; // UID of the user who made the assignment
    assignmentDate: string; // ISO date string
}

export type NotificationType = 'success' | 'destructive' | 'warning' | 'info';

export type Notification = {
    id: string;
    message: string;
    entityId: string;
    entityFirstName: string;
    entityLastName: string;
    actorName: string; // Who made the change
    recipientId: string; // Who this notification is for
    createdAt: string; // ISO date string
    isRead: boolean;
    type: NotificationType;
    changes: NotificationChange[];
}

export type NotificationChange = {
    field: string;
    oldValue: string | null;
    newValue: string | null;
};

export type SessionData = {
  isLoggedIn: boolean;
  uid: string;
  name: string;
  isAdmin: boolean;
}
