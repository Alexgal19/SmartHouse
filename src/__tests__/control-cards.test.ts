import { addControlCard, updateControlCard } from '@/lib/sheets';
import { ControlCard } from '@/types';

// Mock environment variables
process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.com';
process.env.GOOGLE_PRIVATE_KEY = 'testkey';

const mockControlCard: ControlCard = {
  id: 'card-1',
  addressId: 'addr-1',
  addressName: 'Test Address',
  coordinatorId: 'coord-1',
  coordinatorName: 'Test Coordinator',
  controlMonth: '2024-03',
  fillDate: '2024-03-28',
  roomRatings: [
    { roomId: 'room-1', roomName: 'Room 1', rating: 8, comment: 'Clean', photoUrls: ['url1'] }
  ],
  cleanKitchen: 9,
  cleanBathroom: 7,
  kitchenPhotoUrls: ['kurl1'],
  bathroomPhotoUrls: ['burl1'],
  appliancesWorking: true,
  comments: [],
};

// Mock the 'google-spreadsheet' library
const mockSheet = {
    getRows: jest.fn().mockResolvedValue([]),
    addRow: jest.fn(),
    loadHeaderRow: jest.fn().mockResolvedValue(undefined),
    loadCells: jest.fn().mockResolvedValue(undefined),
    getCell: jest.fn(() => ({ value: null, save: jest.fn().mockResolvedValue(undefined) })),
    saveUpdatedCells: jest.fn().mockResolvedValue(undefined),
    headerValues: []
};

jest.mock('google-spreadsheet', () => {
    class GoogleSpreadsheet {
        loadInfo = jest.fn().mockResolvedValue(undefined);
        sheetsByTitle = { 'ControlCards': mockSheet };
        addSheet = jest.fn().mockResolvedValue(mockSheet);
    }
    return { GoogleSpreadsheet };
});

// Mock the 'google-auth-library'
jest.mock('google-auth-library', () => {
    class JWT {
        constructor() {}
    }
    return { JWT };
});

describe('Control Cards Backend Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should add a control card with correctly serialized JSON fields', async () => {
    (mockSheet.addRow as jest.Mock).mockResolvedValue({ save: jest.fn() });
    
    await addControlCard(mockControlCard);
    
    expect(mockSheet.addRow).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.any(String),
      roomRatings: JSON.stringify(mockControlCard.roomRatings),
      kitchenPhotoUrls: JSON.stringify(mockControlCard.kitchenPhotoUrls),
      bathroomPhotoUrls: JSON.stringify(mockControlCard.bathroomPhotoUrls),
      appliancesWorking: 'TRUE'
    }));
  });

  test('should update a control card correctly', async () => {
    // Mock existing row
    const mockRowInstance = {
        get: jest.fn((key) => {
            if (key === 'id') return 'card-1';
            return undefined;
        }),
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined)
    };
    (mockSheet.getRows as jest.Mock).mockResolvedValue([mockRowInstance]);

    await updateControlCard('card-1', { cleanKitchen: 10 });
    
    expect(mockRowInstance.set).toHaveBeenCalledWith('cleanKitchen', 10);
    expect(mockRowInstance.save).toHaveBeenCalled();
  });
});
