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
  address: string;
  roomNumber: string;
  zaklad: string; // department
  checkInDate: Date;
  checkOutDate: Date | null;
  contractStartDate?: Date | null;
  contractEndDate?: Date | null;
  comments?: string;
  status: 'active' | 'dismissed';
};

export type NonEmployee = {
  id: string;
  fullName: string;
  address: string;
  roomNumber: string;
  checkInDate: Date;
  checkOutDate: Date | null;
  relationshipToEmployee: string; // e.g., 'Spouse', 'Child'
};

export type HousingAddress = {
  id: string;
  name: string;
  capacity: number;
};

export type Inspection = {
  id: string;
  address: string;
  date: Date;
  inspector: string;
  cleanlinessScore: number; // 1-5
  maintenanceScore: number; // 1-5
  comments: string;
  photoUrls: string[];
};

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
};

export type Coordinator = {
  uid: string;
  name: string;
};

export type Notification = {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  createdAt: Date;
  isRead: boolean;
};

export type View = 'dashboard' | 'employees' | 'settings' | 'inspections';
