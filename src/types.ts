// This file contains all the TypeScript type definitions for the application's data structures.

export type View = 'dashboard' | 'employees' | 'settings' | 'housing' | 'control-cards' | 'odbior';

export type Address = {
  id: string;
  locality: string;
  name: string;
  coordinatorIds: string[];
  rooms: Room[];
  isActive: boolean;
  noMetersRequired?: boolean;
}

export type Room = {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  isLocked?: boolean;
}

export type Coordinator = {
  uid: string;
  name: string;
  isAdmin: boolean;
  isDriver?: boolean;
  isRekrutacja?: boolean;
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
  statuses: string[];
  bokRoles: string[];
  bokReturnOptions: string[];
  bokStatuses: string[];
}

export type BokResident = {
  id: string;
  role: string;
  firstName: string;
  lastName: string;
  fullName: string;
  coordinatorId: string;
  nationality: string;
  address: string;
  roomNumber: string;
  zaklad: string;
  gender: string;
  passportNumber?: string;
  checkInDate: string | null;
  checkOutDate: string | null;
  sendDate: string | null;
  sendTime?: string | null;
  sendReason?: string | null;
  dismissDate: string | null;
  returnStatus: string;
  status: string;
  comments?: string | null;
};

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
  isDriver: boolean;
  isRekrutacja: boolean;
}

export type CleanlinessRating = number; // 1-10 scale

export type RoomRating = {
  roomId: string;
  roomName: string;
  rating: CleanlinessRating;
  comment?: string;
  photoUrls?: string[];
}

export type ControlCard = {
  id: string;
  addressId: string;
  addressName: string;
  coordinatorId: string;
  coordinatorName: string;
  controlMonth: string; // format: YYYY-MM
  fillDate: string;     // ISO date: YYYY-MM-DD
  roomRatings: RoomRating[]; // per-room ratings stored as JSON in sheet
  cleanKitchen: CleanlinessRating;
  cleanBathroom: CleanlinessRating;
  kitchenPhotoUrls?: string[];
  bathroomPhotoUrls?: string[];
  meterPhotoUrls?: string[];
  appliancesWorking: boolean;
  comments: string;
  deleted?: boolean;
}

export type StartListHousingType = 'Hostel' | 'Dom' | 'Kwatera';
export type StartListTransport = 'Pieszo' | 'Komunikacja miejska' | 'Samochód SMARTWORK';
export type StartListStandard = 'Wysoki' | 'Normalny' | 'Niski';
export type StartListHeating =
  | 'Piec gazowy'
  | 'Centralne'
  | 'Piec elektryczny'
  | 'Piec węglowy'
  | 'Inne';

export type StartList = {
  addressId: string;
  addressName: string;
  housingType: StartListHousingType;
  distanceToWork: string;
  transport: StartListTransport[];
  distanceToShop: string;
  floorsCount: number;        // dla domu — liczba pięter
  floorInBuilding: number;    // dla kwatery — na którym piętrze (0 = parter)
  roomsCount: number;
  kitchensCount: number;
  bathroomsCount: number;
  placesCount: number;
  hasBalcony: boolean;
  standard: StartListStandard;
  heating: StartListHeating;
  heatingOther: string;
  kitchenPhotoUrls: string[];
  bathroomPhotoUrls: string[];
  roomsPhotoUrls: string[];
  hallwayPhotoUrls: string[];
  updatedAt: string;          // ISO date-time
  updatedBy: string;          // coordinator name
  updatedById: string;        // coordinator uid
}

export type OdbiorType = 'zakwaterowanie' | 'rozmowa_rekrutacyjna' | 'badania';
// ─── OdbiorZgloszenia (moduł zgłoszeń odbioru) ───────────────────────────────

export type OdbiorZgloszenieStatus = 'Nieprzyjęte' | 'W trakcie' | 'Zakończone' | 'Dostarczone';
export type OdbiorZgloszenieSkad = 'autobusowa' | 'pociagowa' | 'inne';
export type NastepnyKrok = 'zakwaterowanie' | 'badania' | 'rozmowa' | '';
export type OsobaWOdbiorze = { imie: string; nazwisko: string; paszport: string };

export type OdbiorZgloszenie = {
    id: string;
    dataZgloszenia: string;
    numerTelefonu: string;
    skad: OdbiorZgloszenieSkad;
    komentarzSkad: string;
    iloscOsob: number;
    komentarz: string;
    zdjeciaUrls: string;
    rekruterId: string;
    rekruterNazwa: string;
    status: OdbiorZgloszenieStatus;
    kierowcaId: string;
    kierowcaNazwa: string;
    osoby: string;
    nastepnyKrok: string;
    dataZakonczenia: string;
};

export type OdbiorStatus = 'nowy' | 'przekonwertowany';

export type OdbiorEntry = {
  id: string;
  type: OdbiorType;
  status: OdbiorStatus;
  firstName: string;
  lastName: string;
  nationality: string;
  gender: string;
  passportNumber: string;
  addressId: string;
  addressName: string;
  roomNumber: string;
  date: string;               // YYYY-MM-DD
  createdAt: string;          // ISO date-time
  createdBy: string;          // coordinator name (kierowca/rekrutacja)
  createdById: string;        // coordinator uid
  convertedToBokId?: string | null;
}
