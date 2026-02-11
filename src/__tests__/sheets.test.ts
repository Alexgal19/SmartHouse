import { getAllSheetsData } from '@/lib/sheets';

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
