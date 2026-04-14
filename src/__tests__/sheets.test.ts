import { getAllSheetsData, getNotifications } from '@/lib/sheets';

// Mock environment variables
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.com';
process.env.GOOGLE_PRIVATE_KEY = 'testkey';

// Mock the 'google-spreadsheet' library
jest.mock('google-spreadsheet', () => {
  const mockRow = (data: Record<string, unknown>) => ({
    ...data,
    get: (key: string) => data[key],
    toObject: () => data,
  });

  const mockSheet = (rows: Record<string, unknown>[]) => ({
    getRows: jest.fn().mockResolvedValue(rows.map(mockRow)),
  });

  return {
    GoogleSpreadsheet: jest.fn().mockImplementation(() => ({
      loadInfo: jest.fn().mockResolvedValue(undefined),
      sheetsByTitle: {
        'Employees': mockSheet([
          { id: 'emp-1', firstName: 'John', lastName: 'Doe', status: 'active', checkInDate: '2024-01-01' },
        ]),
        'NonEmployees': mockSheet([
          { id: 'nonemp-1', firstName: 'Jane', lastName: 'Doe', status: 'active', checkInDate: '2024-02-01' },
        ]),
        'Addresses': mockSheet([]),
        'Rooms': mockSheet([]),
        'Nationalities': mockSheet([{ name: 'Polish' }]),
        'Departments': mockSheet([{ name: 'IT' }]),
        'Coordinators': mockSheet([]),
        'Genders': mockSheet([]),
        'Localities': mockSheet([]),
        'PaymentTypesNZ': mockSheet([]),
        'Statuses': mockSheet([]),
        'AddressHistory': mockSheet([]),
        'BokResidents': mockSheet([]),
        'BokRoles': mockSheet([]),
        'BokReturnOptions': mockSheet([]),
        'BokStatuses': mockSheet([]),
      },
    })),
  };
});

// Mock the 'google-auth-library'
jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({})),
}));

describe('Google Sheets Synchronization', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('should fetch and deserialize data from Google Sheets correctly', async () => {
    const data = await getAllSheetsData();

    // Verify employees data
    expect(data.employees).toHaveLength(1);
    expect(data.employees[0]).toEqual(expect.objectContaining({
      id: 'emp-1',
      firstName: 'John',
      lastName: 'Doe',
      status: 'active',
      checkInDate: '2024-01-01',
    }));

    // Verify non-employees data
    expect(data.nonEmployees).toHaveLength(1);
    expect(data.nonEmployees[0]).toEqual(expect.objectContaining({
      id: 'nonemp-1',
      firstName: 'Jane',
      lastName: 'Doe',
      status: 'active',
      checkInDate: '2024-02-01',
    }));
    
    // Verify settings data
    expect(data.settings.nationalities).toEqual(['Polish']);
    expect(data.settings.departments).toEqual(['IT']);
  });
});

describe('Notification filtering', () => {
  const notifForCoord1 = {
    id: 'n1', message: 'Msg 1', entityId: 'e1', entityFirstName: 'A', entityLastName: 'B',
    actorName: 'Actor', recipientId: 'coord-1', createdAt: new Date().toISOString(),
    isRead: 'FALSE', type: 'warning', changes: '[]',
  };
  const notifForCoord2 = {
    id: 'n2', message: 'Msg 2', entityId: 'e2', entityFirstName: 'C', entityLastName: 'D',
    actorName: 'Actor', recipientId: 'coord-2', createdAt: new Date().toISOString(),
    isRead: 'FALSE', type: 'info', changes: '[]',
  };

  const mockRow = (data: Record<string, unknown>) => ({
    ...data,
    get: (key: string) => data[key],
    toObject: () => data,
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('coordinator sees only their own notifications', async () => {
    jest.mock('google-spreadsheet', () => ({
      GoogleSpreadsheet: jest.fn().mockImplementation(() => ({
        useServiceAccountAuth: jest.fn(),
        loadInfo: jest.fn().mockResolvedValue(undefined),
        sheetsByTitle: {
          'Powiadomienia': { getRows: jest.fn().mockResolvedValue([mockRow(notifForCoord1), mockRow(notifForCoord2)]) },
        },
      })),
    }));

    const { getNotifications: getNotifs } = await import('@/lib/sheets');
    const result = await getNotifs('coord-1', false);
    expect(result.every(n => n.recipientId === 'coord-1')).toBe(true);
    expect(result.find(n => n.id === 'n2')).toBeUndefined();
  });

  test('admin sees all notifications regardless of recipientId', async () => {
    jest.mock('google-spreadsheet', () => ({
      GoogleSpreadsheet: jest.fn().mockImplementation(() => ({
        useServiceAccountAuth: jest.fn(),
        loadInfo: jest.fn().mockResolvedValue(undefined),
        sheetsByTitle: {
          'Powiadomienia': { getRows: jest.fn().mockResolvedValue([mockRow(notifForCoord1), mockRow(notifForCoord2)]) },
        },
      })),
    }));

    const { getNotifications: getNotifs } = await import('@/lib/sheets');
    const result = await getNotifs('coord-admin', true);
    expect(result.length).toBe(2);
  });
});
