import { deleteEmployee } from '@/lib/actions';
import * as sheets from '@/lib/sheets';

// Mock the entire sheets module
jest.mock('@/lib/sheets');

const mockedGetSheet = sheets.getSheet as jest.Mock;
const mockedGetAllSheetsData = sheets.getAllSheetsData as jest.Mock;
const mockedDeleteAddressHistoryEntry = sheets.deleteAddressHistoryEntry as jest.Mock;

describe('Server Actions - deleteEmployee', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should delete an employee and their address history', async () => {
        // Arrange
        const mockRow = {
            get: (key: string) => {
                if (key === 'id') return 'emp-123';
                return '';
            },
            delete: jest.fn().mockResolvedValue(undefined),
        };
        
        const mockSheet = {
            getRows: jest.fn().mockResolvedValue([mockRow]),
        };

        mockedGetSheet.mockResolvedValue(mockSheet as any);
        mockedGetAllSheetsData.mockResolvedValue({ 
            addressHistory: [
                { id: 'hist-1', employeeId: 'emp-123' },
                { id: 'hist-2', employeeId: 'emp-456' },
                { id: 'hist-3', employeeId: 'emp-123' },
            ]
        });
        mockedDeleteAddressHistoryEntry.mockResolvedValue(undefined);

        // Act
        await deleteEmployee('emp-123', 'actor-uid');

        // Assert
        expect(mockedGetSheet).toHaveBeenCalledWith('Employees', expect.any(Array));
        expect(mockRow.delete).toHaveBeenCalledTimes(1);
        expect(mockedDeleteAddressHistoryEntry).toHaveBeenCalledTimes(2);
        expect(mockedDeleteAddressHistoryEntry).toHaveBeenCalledWith('hist-1');
        expect(mockedDeleteAddressHistoryEntry).toHaveBeenCalledWith('hist-3');
    });

    it('should throw an error if employee is not found', async () => {
        // Arrange
        const mockSheet = {
            getRows: jest.fn().mockResolvedValue([]),
        };
        mockedGetSheet.mockResolvedValue(mockSheet as any);
        mockedGetAllSheetsData.mockResolvedValue({ addressHistory: [] });

        // Act & Assert
        await expect(deleteEmployee('emp-not-found', 'actor-uid')).rejects.toThrow('Employee not found for deletion.');
    });
    
     it('should handle cases where addressHistory is null or undefined', async () => {
        // Arrange
        const mockRow = {
            get: (key: string) => (key === 'id' ? 'emp-123' : ''),
            delete: jest.fn().mockResolvedValue(undefined),
        };
        const mockSheet = {
            getRows: jest.fn().mockResolvedValue([mockRow]),
        };
        mockedGetSheet.mockResolvedValue(mockSheet as any);
        // Simulate getAllSheetsData returning no addressHistory
        mockedGetAllSheetsData.mockResolvedValue({ addressHistory: undefined });

        // Act
        await deleteEmployee('emp-123', 'actor-uid');

        // Assert
        expect(mockRow.delete).toHaveBeenCalledTimes(1);
        // Crucially, deleteAddressHistoryEntry should not be called
        expect(mockedDeleteAddressHistoryEntry).not.toHaveBeenCalled();
    });
});
