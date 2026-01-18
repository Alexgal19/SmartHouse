import { deleteEmployee, bulkDeleteEmployeesByDepartment, importEmployeesFromExcel, addEmployee } from '@/lib/actions';
import * as sheets from '@/lib/sheets';
import * as XLSX from 'xlsx';
import type { Settings } from '@/types';

// Mock the entire sheets module
jest.mock('@/lib/sheets', () => ({
    ...jest.requireActual('@/lib/sheets'), // import and retain default behavior
    getSheet: jest.fn(),
    getAllSheetsData: jest.fn(),
    deleteAddressHistoryEntry: jest.fn(),
    addAddressHistoryEntry: jest.fn(),
    updateAddressHistoryEntry: jest.fn(),
}));

const mockedGetSheet = sheets.getSheet as jest.Mock;
const mockedGetAllSheetsData = sheets.getAllSheetsData as jest.Mock;

// Helper function to create a mock Excel file in memory (as base64)
function createMockExcel(data: any[]): string {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Arkusz1');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer.toString('base64');
}

const mockSettings: Settings = {
  id: 'global-settings',
  coordinators: [
    { uid: 'coord-1', name: 'Jan Kowalski', isAdmin: false, departments: ['IT', 'HR'], visibilityMode: 'department' },
    { uid: 'coord-2', name: 'Anna Nowak', isAdmin: false, departments: ['Marketing'], visibilityMode: 'strict' },
  ],
  localities: ['Warszawa', 'Kraków'],
  departments: ['IT', 'HR', 'Marketing'],
  nationalities: ['Polska', 'Ukraina'],
  genders: ['Mężczyzna', 'Kobieta'],
  addresses: [],
  paymentTypesNZ: [],
  bokStatuses: [],
};


describe('Server Actions', () => {

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Default mock for getAllSheetsData to avoid undefined errors in actions
        mockedGetAllSheetsData.mockResolvedValue({
            settings: mockSettings,
            employees: [],
            nonEmployees: [],
            addressHistory: [],
        });
    });

    describe('addEmployee', () => {
        it('should correctly serialize and add an employee', async () => {
            const mockAddRow = jest.fn().mockResolvedValue(undefined);
            const mockSheet = {
                addRow: mockAddRow,
            };
            mockedGetSheet.mockResolvedValue(mockSheet as any);

            const employeeData = {
                firstName: 'Jan',
                lastName: 'Nowak',
                coordinatorId: 'coord-1',
                checkInDate: '2024-01-10',
            };

            await addEmployee(employeeData, 'admin-uid');

            expect(mockedGetSheet).toHaveBeenCalledWith('Employees', expect.any(Array));
            expect(mockAddRow).toHaveBeenCalledTimes(1);
            
            // Check if the data passed to addRow is correctly serialized
            const addedData = mockAddRow.mock.calls[0][0];
            expect(addedData.firstName).toBe('Jan');
            expect(addedData.lastName).toBe('Nowak');
            expect(addedData.fullName).toBe('Nowak Jan'); // Crucial check
            expect(addedData.status).toBe('active');
        });
    });

    describe('deleteEmployee', () => {
        it('should delete an employee and their address history', async () => {
            const mockRow = {
                get: (key: string) => (key === 'id' ? 'emp-123' : ''),
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
            (sheets.deleteAddressHistoryEntry as jest.Mock).mockResolvedValue(undefined);

            await deleteEmployee('emp-123', 'actor-uid');

            expect(mockedGetSheet).toHaveBeenCalledWith('Employees', expect.any(Array));
            expect(mockRow.delete).toHaveBeenCalledTimes(1);
            expect(sheets.deleteAddressHistoryEntry).toHaveBeenCalledTimes(2);
            expect(sheets.deleteAddressHistoryEntry).toHaveBeenCalledWith('hist-1');
            expect(sheets.deleteAddressHistoryEntry).toHaveBeenCalledWith('hist-3');
        });

        it('should throw an error if employee is not found', async () => {
            const mockSheet = { getRows: jest.fn().mockResolvedValue([]) };
            mockedGetSheet.mockResolvedValue(mockSheet as any);
            mockedGetAllSheetsData.mockResolvedValue({ addressHistory: [] });

            await expect(deleteEmployee('emp-not-found', 'actor-uid')).rejects.toThrow('Employee not found for deletion.');
        });
        
        it('should handle cases where addressHistory is null or undefined gracefully', async () => {
            const mockRow = {
                get: (key: string) => (key === 'id' ? 'emp-123' : ''),
                delete: jest.fn().mockResolvedValue(undefined),
            };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]) };
            mockedGetSheet.mockResolvedValue(mockSheet as any);
            // Simulate getAllSheetsData returning no addressHistory
            mockedGetAllSheetsData.mockResolvedValue({ addressHistory: undefined });

            await deleteEmployee('emp-123', 'actor-uid');

            expect(mockRow.delete).toHaveBeenCalledTimes(1);
            expect(sheets.deleteAddressHistoryEntry).not.toHaveBeenCalled();
        });
    });

    describe('bulkDeleteEmployeesByDepartment', () => {
        it('should delete only the employees from the specified department', async () => {
            const mockRows = [
                { get: (key: string) => (key === 'zaklad' ? 'IT' : 'some-other-value'), delete: jest.fn().mockResolvedValue(undefined) },
                { get: (key: string) => (key === 'zaklad' ? 'HR' : 'some-other-value'), delete: jest.fn().mockResolvedValue(undefined) },
                { get: (key: string) => (key === 'zaklad' ? 'IT' : 'some-other-value'), delete: jest.fn().mockResolvedValue(undefined) },
            ];
            
            const mockSheet = { getRows: jest.fn().mockResolvedValue(mockRows) };
            mockedGetSheet.mockResolvedValue(mockSheet as any);

            await bulkDeleteEmployeesByDepartment('IT', 'actor-uid');

            expect(mockedGetSheet).toHaveBeenCalledWith('Employees', expect.any(Array));
            expect(mockRows[0].delete).toHaveBeenCalledTimes(1);
            expect(mockRows[1].delete).not.toHaveBeenCalled();
            expect(mockRows[2].delete).toHaveBeenCalledTimes(1);
        });
    });

    describe('importEmployeesFromExcel', () => {
        
        // We need to mock addEmployee from the same module
        const originalAddEmployee = jest.requireActual('@/lib/actions').addEmployee;
        let mockAddEmployee: jest.Mock;

        beforeAll(() => {
            jest.mock('@/lib/actions', () => {
                const original = jest.requireActual('@/lib/actions');
                return {
                    __esModule: true,
                    ...original,
                    addEmployee: jest.fn(),
                };
            });
            // Re-import after mocking
            mockAddEmployee = require('@/lib/actions').addEmployee;
        });

        afterAll(() => {
            jest.unmock('@/lib/actions');
        });

        beforeEach(() => {
            mockAddEmployee.mockClear();
            // Default implementation that does nothing but resolves
            mockAddEmployee.mockImplementation(originalAddEmployee);
        });


        it('should correctly import a valid employee record', async () => {
            const excelData = [{
                'Imię': 'Adam',
                'Nazwisko': 'Testowy',
                'Koordynator': 'Jan Kowalski',
                'Narodowość': 'Polska',
                'Zakład': 'IT',
                'Miejscowość': 'Warszawa',
                'Adres': 'ul. Testowa 1',
                'Pokój': '101',
                'Data zameldowania': '01.01.2024',
            }];
            const base64Content = createMockExcel(excelData);
    
            const result = await importEmployeesFromExcel(base64Content, 'admin-uid', mockSettings);
    
            expect(result.importedCount).toBe(1);
            expect(result.totalRows).toBe(1);
            expect(result.errors).toHaveLength(0);
            expect(mockAddEmployee).toHaveBeenCalledTimes(1);
            expect(mockAddEmployee).toHaveBeenCalledWith(
                expect.objectContaining({
                    firstName: 'Adam',
                    lastName: 'Testowy',
                    coordinatorId: 'coord-1',
                    zaklad: 'IT',
                    checkInDate: '2024-01-01',
                }),
                'admin-uid'
            );
        });

        it('should report an error for a row with a non-existent coordinator', async () => {
            const excelData = [{
                'Imię': 'Adam',
                'Nazwisko': 'Błędny',
                'Koordynator': 'Nieistniejący Koordynator',
                'Narodowość': 'Polska',
                'Zakład': 'IT',
                'Miejscowość': 'Warszawa',
                'Adres': 'ul. Testowa 1',
                'Pokój': '101',
                'Data zameldowania': '01.01.2024',
            }];
            const base64Content = createMockExcel(excelData);

            const result = await importEmployeesFromExcel(base64Content, 'admin-uid', mockSettings);

            expect(result.importedCount).toBe(0);
            expect(result.totalRows).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain("Nie znaleziono koordynatora 'nieistniejący koordynator'");
            expect(mockAddEmployee).not.toHaveBeenCalled();
        });

        it('should report an error for a row with missing required fields', async () => {
            const excelData = [{
                'Imię': 'Jan',
                'Nazwisko': 'Niewystarczający',
                'Koordynator': 'Jan Kowalski',
                // Missing "Data zameldowania" and other required fields
            }];
            const base64Content = createMockExcel(excelData);

            const result = await importEmployeesFromExcel(base64Content, 'admin-uid', mockSettings);

            expect(result.importedCount).toBe(0);
            expect(result.totalRows).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain("Brak wymaganych danych w kolumnach:");
            expect(result.errors[0]).toContain("data zameldowania");
            expect(mockAddEmployee).not.toHaveBeenCalled();
        });
    });
});
