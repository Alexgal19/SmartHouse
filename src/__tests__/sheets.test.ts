
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getOnlySettings } from '../lib/sheets';
import { GoogleSpreadsheet } from 'google-spreadsheet';

jest.mock('google-spreadsheet');
jest.mock('google-auth-library');

describe('getOnlySettings', () => {
    let mockDoc: any;

    beforeEach(() => {
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.com';
        process.env.GOOGLE_PRIVATE_KEY = 'test-key';

        mockDoc = {
            useServiceAccountAuth: jest.fn(),
            loadInfo: jest.fn(),
            sheetsByTitle: {},
            addSheet: jest.fn(),
        };
        (GoogleSpreadsheet as any).mockImplementation(() => mockDoc);
        
        // Setup mock sheets
        const mockSheets: any = {
            'Addresses': { getRows: jest.fn().mockResolvedValue([{ id: 'addr1', name: 'Address 1', locality: 'Locality 1', coordinatorIds: 'coord1', toObject: () => ({ id: 'addr1', name: 'Address 1', locality: 'Locality 1', coordinatorIds: 'coord1' }) }]) },
            'Rooms': { getRows: jest.fn() },
            'Nationalities': { getRows: jest.fn().mockResolvedValue([]) },
            'Departments': { getRows: jest.fn().mockResolvedValue([]) },
            'Coordinators': { getRows: jest.fn().mockResolvedValue([]) },
            'Genders': { getRows: jest.fn().mockResolvedValue([]) },
            'Localities': { getRows: jest.fn().mockResolvedValue([]) },
            'PaymentTypesNZ': { getRows: jest.fn().mockResolvedValue([]) },
            'Statuses': { getRows: jest.fn().mockResolvedValue([]) },
            'BokRoles': { getRows: jest.fn().mockResolvedValue([]) },
            'BokReturnOptions': { getRows: jest.fn().mockResolvedValue([]) },
            'BokStatuses': { getRows: jest.fn().mockResolvedValue([]) },
        };
        mockDoc.sheetsByTitle = mockSheets;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should correctly parse isActive field', async () => {
        const mockRoomRows = [
            { id: 'room1', addressId: 'addr1', name: '1', capacity: '2', isActive: 'TRUE' },
            { id: 'room2', addressId: 'addr1', name: '2', capacity: '2', isActive: 'FALSE' },
            { id: 'room3', addressId: 'addr1', name: '3', capacity: '2', isActive: 'True' }, // Mixed case
            { id: 'room4', addressId: 'addr1', name: '4', capacity: '2', isActive: 'false' }, // Mixed case
            { id: 'room5', addressId: 'addr1', name: '5', capacity: '2', isActive: undefined }, // Undefined -> True
            { id: 'room6', addressId: 'addr1', name: '6', capacity: '2', isactive: 'FALSE' }, // Lowercase key
            { id: 'room7', addressId: 'addr1', name: '7', capacity: '2', isActive: true as any }, // Boolean true
            { id: 'room8', addressId: 'addr1', name: '8', capacity: '2', isActive: false as any }, // Boolean false
        ];

        mockDoc.sheetsByTitle['Rooms'].getRows.mockResolvedValue(mockRoomRows.map(r => ({ toObject: () => r })));

        const settings = await getOnlySettings();
        const rooms = settings.addresses[0].rooms;

        expect(rooms.find(r => r.id === 'room1')?.isActive).toBe(true);
        expect(rooms.find(r => r.id === 'room2')?.isActive).toBe(false);
        expect(rooms.find(r => r.id === 'room3')?.isActive).toBe(true);
        expect(rooms.find(r => r.id === 'room4')?.isActive).toBe(false);
        expect(rooms.find(r => r.id === 'room5')?.isActive).toBe(true);
        expect(rooms.find(r => r.id === 'room6')?.isActive).toBe(false);
        expect(rooms.find(r => r.id === 'room7')?.isActive).toBe(true);
        expect(rooms.find(r => r.id === 'room8')?.isActive).toBe(false);
    });
});
