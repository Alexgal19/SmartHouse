/* global jest */
import '@testing-library/jest-dom';

global.ResizeObserver = class ResizeObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
};

// Global array to track all push notifications sent during tests
// Tests can inspect: global.__sentPushNotifications
// Helper: clearSentPushNotifications() in jest.setup.mjs
if (typeof global !== 'undefined') {
  global.__sentPushNotifications = [];
  global.clearSentPushNotifications = () => { global.__sentPushNotifications = []; };
}

// Mock firebase-admin package
jest.mock('firebase-admin', () => ({
  apps: [],
  credential: { cert: jest.fn() },
  initializeApp: jest.fn(),
  messaging: jest.fn(() => ({
    send: jest.fn((message) => {
      if (typeof global !== 'undefined' && global.__sentPushNotifications) {
        global.__sentPushNotifications.push(message);
      }
      return Promise.resolve({ success: true });
    }),
  })),
  firestore: Object.assign(jest.fn(() => null), {
    FieldValue: { increment: jest.fn((n) => n) },
  }),
}));

// Mock @/lib/firebase-admin wrapper — track sent notifications for assertions
jest.mock('@/lib/firebase-admin', () => ({
  adminMessaging: {
    send: jest.fn((message) => {
      if (typeof global !== 'undefined' && global.__sentPushNotifications) {
        global.__sentPushNotifications.push(message);
      }
      return Promise.resolve({ success: true });
    }),
  },
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
jest.mock('@/components/layouts/main-layout', () => ({
  useMainLayout: jest.fn(() => ({
    allEmployees: [],
    allNonEmployees: [],
    allBokResidents: [],
    allCandidates: null,
    allDemands: null,
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

// Mock i18n — LanguageProvider is not available in jsdom; use real Polish translations.
// IMPORTANT: t must be a stable function reference — components use it in useCallback([t]),
// so returning a new function each render causes infinite effect loops in tests.
jest.mock('@/lib/i18n', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { pl } = require('@/lib/translations/pl');
  function stableT(key, params) {
    let text = pl[key] ?? key;
    if (params) {
      text = Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), text);
    }
    return text;
  }
  return {
    useLanguage: () => ({
      lang: 'pl',
      setLang: jest.fn(),
      t: stableT,
      dateLocale: undefined,
    }),
    LanguageProvider: ({ children }) => children,
  };
});

// Mock react-webcam globally — used by OcrCameraButton in AddCandidateDialog
jest.mock('react-webcam', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');
  const Webcam = React.forwardRef((_props, ref) => {
    React.useImperativeHandle(ref, () => ({
      getScreenshot: () => 'data:image/jpeg;base64,test',
    }));
    return React.createElement('video', { 'data-testid': 'mock-webcam' });
  });
  Webcam.displayName = 'Webcam';
  return { __esModule: true, default: Webcam };
});

// Global fetch mock — jsdom does not provide fetch; tests that need specific
// responses should override via jest.spyOn(global, 'fetch') per test.
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ valid: true }),
});

// Mock scrollIntoView for JSDOM
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  // Mock matchMedia for responsive Tailwind classes in jsdom
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}
