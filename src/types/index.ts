
export type User = {
  uid: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
};

export type DeductionReason = {
  name: string;
  checked: boolean;
  amount?: number | null;
};

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
  checkOutDate?: string | null; 
  contractStartDate?: string | null; 
  contractEndDate?: string | null; 
  departureReportDate?: string | null; 
  comments?: string;
  status: 'active' | 'dismissed';
  oldAddress?: string | null;
  // Financial fields
  depositReturned?: 'Tak' | 'Nie' | 'Nie dotyczy' | null;
  depositReturnAmount?: number | null;
  deductionRegulation?: number | null;
  deductionNo4Months?: number | null;
  deductionNo30Days?: number | null;
  deductionReason?: DeductionReason[];
};

export type NonEmployee = {
  id: string;
  fullName:string;
  address: string;
  roomNumber: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate?: string | null; // YYYY-MM-DD
  comments?: string;
};

export type Room = {
  id: string;
  name: string;
  capacity: number;
};

export type HousingAddress = {
  id: string;
  name: string;
  rooms: Room[];
};

export type InspectionCategoryItem = {
    label: string;
    type: 'rating' | 'yes_no' | 'text' | 'info' | 'select' | 'checkbox_group' | 'number';
    value?: any; // Can be number, boolean, string, string[] or null
    options?: string[];
};

export type InspectionCategory = {
    name: string;
    items: InspectionCategoryItem[];
    uwagi: string;
    photos?: string[];
};

export type Inspection = {
  id: string;
  addressId: string;
  addressName: string;
  date: Date;
  coordinatorId: string;
  coordinatorName: string;
  standard: 'Wysoki' | 'Normalny' | 'Niski' | null;
  categories: InspectionCategory[];
};

export type Photo = {
  id: string;
  inspectionId: string;
  categoryId: string; // Category name for simplicity
  photoData: string;
}

export type InspectionDetail = {
    id: string;
    inspectionId: string;
    addressName: string;
    date: string;
    coordinatorName: string;
    category: string;
    itemLabel: string | null;
    itemValue: string | null;
    uwagi: string | null;
    photoData?: string | null;
}

export type EquipmentItem = {
  id: string;
  name: string;
  quantity: number;
  address: string;
  roomNumber: string;
  condition: 'new' | 'used' | 'damaged';
};

export type Settings = {
  id: 'global-settings';
  addresses: HousingAddress[];
  nationalities: string[];
  departments: string[];
  coordinators: Coordinator[];
  genders: string[];
};

export type Coordinator = {
  uid: string;
  name: string;
  isAdmin: boolean;
  password?: string;
};

export type NotificationChange = {
  field: string;
  oldValue: string;
  newValue: string;
};

export type Notification = {
  id: string;
  message: string;
  employeeId: string;
  employeeName: string;
  coordinatorId: string;
  coordinatorName: string;
  createdAt: Date;
  isRead: boolean;
  changes?: NotificationChange[];
};

export type View = 'dashboard' | 'employees' | 'settings' | 'inspections';
