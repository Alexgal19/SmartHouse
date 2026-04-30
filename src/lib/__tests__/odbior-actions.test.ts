import * as actions from '../actions';
import * as sheets from '../sheets';
import * as auth from '../auth';

// Mock the dependencies
jest.mock('../sheets');
jest.mock('../auth');
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

describe('Odbiór Actions', () => {
  const mockSession = {
    isLoggedIn: true,
    uid: 'user-1',
    name: 'Test Driver',
    isAdmin: false,
    isDriver: true,
    isRekrutacja: false,
  };

  const mockSettings = {
    id: 'global-settings',
    coordinators: [
      { uid: 'user-1', name: 'Test Driver', isAdmin: false, isDriver: true, departments: [] },
    ],
    addresses: [
      { id: 'addr-1', name: 'Chopina 11a', locality: 'Warszawa', coordinatorIds: [], rooms: [{ id: 'room-1', name: '101', capacity: 2, isActive: true }], isActive: true }
    ],
    nationalities: ['Kolumbia'],
    departments: ['BOK'],
    genders: ['Mężczyzna'],
    localities: [],
    paymentTypesNZ: [],
    statuses: [],
    bokRoles: [],
    bokReturnOptions: [],
    bokStatuses: [],
  };

  const mockSheet = {
    addRow: jest.fn().mockResolvedValue({}),
    getRows: jest.fn().mockResolvedValue([]),
    saveUpdatedCells: jest.fn().mockResolvedValue({}),
    loadHeaderRow: jest.fn().mockResolvedValue({}),
    getCell: jest.fn().mockReturnValue({ value: '' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (auth.getSession as jest.Mock).mockResolvedValue(mockSession);
    (sheets.getSettings as jest.Mock).mockResolvedValue(mockSettings);
    (sheets.withTimeout as jest.Mock).mockImplementation((p) => p);
    (sheets.getSheet as jest.Mock).mockResolvedValue(mockSheet);
  });

  describe('addOdbiorEntryAction', () => {
    it('successfully adds a new odbior entry', async () => {
      const input = {
        type: 'zakwaterowanie' as const,
        firstName: 'Juan',
        lastName: 'Carlos',
        nationality: 'Kolumbia',
        gender: 'Mężczyzna',
        passportNumber: 'EP123456',
        addressId: 'addr-1',
        addressName: 'Chopina 11a',
        roomNumber: '101',
        date: '2024-04-28',
        createdBy: 'Test Driver',
        createdById: 'user-1',
      };

      const result = await actions.addOdbiorEntryAction(input);

      expect(result.success).toBe(true);
      expect(sheets.addOdbiorEntry).toHaveBeenCalledWith(expect.objectContaining({
        firstName: 'Juan',
        lastName: 'Carlos',
        status: 'nowy',
        createdById: 'user-1',
      }));
    });
  });

  describe('convertOdbiorToBokAction', () => {
    it('successfully converts odbior entry to BOK resident', async () => {
      const mockEntry = {
        id: 'odb-1',
        type: 'zakwaterowanie',
        status: 'nowy',
        firstName: 'Juan',
        lastName: 'Carlos',
        nationality: 'Kolumbia',
        gender: 'Mężczyzna',
        passportNumber: 'EP123456',
        addressId: 'addr-1',
        addressName: 'Chopina 11a',
        roomNumber: '101',
        date: '2024-04-28',
      };

      const extra = {
        role: 'Mieszkaniec',
        coordinatorId: 'coord-1',
        zaklad: 'BOK',
        status: 'Aktywny',
        returnStatus: 'Brak',
      };

      (sheets.getOdbiorEntries as jest.Mock).mockResolvedValue([mockEntry]);
      
      const result = await actions.convertOdbiorToBokAction('odb-1', extra, 'user-1');

      if (!result.success) {
        console.error('convertOdbiorToBokAction failed with:', result.error);
      }

      expect(result.success).toBe(true);
      expect(sheets.updateOdbiorEntry).toHaveBeenCalledWith('odb-1', expect.objectContaining({
        status: 'przekonwertowany',
      }));
    });
  });
});
