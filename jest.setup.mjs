/* global jest */
import '@testing-library/jest-dom';

global.ResizeObserver = class ResizeObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
};



// Mock firebase-admin package
jest.mock('firebase-admin', () => ({
  apps: [],
  credential: { cert: jest.fn() },
  initializeApp: jest.fn(),
  messaging: jest.fn(() => ({ send: jest.fn() })),
  firestore: Object.assign(jest.fn(() => null), {
    FieldValue: { increment: jest.fn((n) => n) },
  }),
}));

// Mock @/lib/firebase-admin wrapper — ensures adminDb and adminMessaging are
// always available in tests without needing the real Firebase credentials
jest.mock('@/lib/firebase-admin', () => ({
  adminMessaging: { send: jest.fn() },
  adminDb: null,
}));

// Mock @/lib/auth — Server Actions call requireSession() which calls cookies(),
// which throws outside Next.js request scope. Global mock prevents this in
// every test file without needing per-file boilerplate.
jest.mock('@/lib/auth', () => ({
  getSession: jest.fn().mockResolvedValue({
    isLoggedIn: true,
    uid: 'coord-1',
    name: 'Jan Kowalski',
    isAdmin: true,
    isDriver: false,
    isRekrutacja: false,
  }),
}));

// Mock Next.js Navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '',
  redirect: jest.fn(),
}));

// Mock Next.js Cache
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// Mock MainLayout Context
jest.mock('@/components/main-layout', () => ({
  useMainLayout: jest.fn(() => ({
    allEmployees: [],
    allNonEmployees: [],
    allBokResidents: [],
    settings: {
      coordinators: [],
      nationalities: [],
      departments: [],
      genders: [],
      localities: [],
      addresses: [],
      statuses: [],
    },
    currentUser: { isAdmin: true, uid: 'test-user', name: 'Test' },
    handleDismissEmployee: jest.fn(),
    handleDeleteEmployee: jest.fn(),
    handleRestoreEmployee: jest.fn(),
    handleEditEmployeeClick: jest.fn(),
    handleAddEmployeeClick: jest.fn(),
    handleRefreshStatuses: jest.fn(),
    refreshData: jest.fn(),
    handleImportEmployees: jest.fn(),
    handleImportNonEmployees: jest.fn(),
    handleMigrateFullNames: jest.fn(),
    handleBulkDeleteEmployees: jest.fn(),
    handleBulkDeleteEmployeesByCoordinator: jest.fn(),
    handleBulkDeleteEmployeesByDepartment: jest.fn(),
    handleDeleteNonEmployee: jest.fn(),
    handleDeleteBokResident: jest.fn(),
    handleDeleteAddressHistory: jest.fn(),
    handleSaveAddress: jest.fn(),
    handleUpdateSettings: jest.fn(),
    handleAddNonEmployeeClick: jest.fn(),
    handleEditNonEmployeeClick: jest.fn(),
    handleAddBokResidentClick: jest.fn(),
    handleEditBokResidentClick: jest.fn(),
    handleDismissNonEmployee: jest.fn(),
    handleRestoreNonEmployee: jest.fn(),
    handleToggleNotificationReadStatus: jest.fn(),
    handleUpdateCoordinatorSubscription: jest.fn(),
    pushSubscription: null,
    setPushSubscription: jest.fn(),
    hasNewCheckouts: false,
    setHasNewCheckouts: jest.fn(),
    selectedCoordinatorId: 'all',
    setSelectedCoordinatorId: jest.fn(),
  })),
}));

// Mock scrollIntoView for JSDOM
window.HTMLElement.prototype.scrollIntoView = jest.fn();
