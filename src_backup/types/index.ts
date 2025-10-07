
export type User = {
  uid: string;
  name: string;
  email: string;
  avatarUrl: string;
  isAdmin: boolean;
};

export type Employee = {
  id: string;
  fullName: string;
  coordinatorId: string;
  nationality: string;
  gender: 'Mężczyzna' | 'Kobieta';
  address: string;
  roomNumber: string;
  zaklad: string; // department
  checkInDate: Date;
  checkOutDate: Date | null;
  contractStartDate?: Date | null;
  contractEndDate?: Date | null;
  departureReportDate?: Date | null;
  comments?: string;
  status: 'active' | 'dismissed';
  oldAddress?: string | null;
};

export type NonEmployee = {
  id: string;
  fullName:string;
  address: string;
  roomNumber: string;
  checkInDate: Date;
  checkOutDate: Date | null;
  relationshipToEmployee: string; // e.g., 'Spouse', 'Child'
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
    type: 'rating' | 'yes_no' | 'text' | 'info' | 'select';
    value: number | boolean | string | null;
    options?: string[];
};

export type InspectionCategory = {
    name: string;
    items: InspectionCategoryItem[];
    uwagi: string;
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
  photos: string[];
};

export type Photo = {
  id: string;
  inspectionId: string;
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
  genders: ('Mężczyzna' | 'Kobieta')[];
};

export type Coordinator = {
  uid: string;
  name: string;
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

