import { deleteEmployee, bulkDeleteEmployeesByDepartment, importEmployeesFromExcel, addEmployee, updateEmployee, checkAndUpdateStatuses, generateMonthlyReport } from '@/lib/actions';
import * as sheets from '@/lib/sheets';
import * as XLSX from 'xlsx';
import type { Settings, Employee } from '@/types';

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

const mockEmployees: Employee[] = [
    { id: 'emp-1', firstName: 'Adam', lastName: 'Nowak', coordinatorId: 'coord-1', status: 'active', checkInDate: '2024-01-01', zaklad: 'IT', nationality: 'Polska', gender: 'Mężczyzna', address: 'Testowa 1', roomNumber: '1' },
    { id: 'emp-2', firstName: 'Ewa', lastName: 'Kowal', coordinatorId: 'coord-1', status: 'active', checkInDate: '2024-02-01', checkOutDate: '2024-02-15', zaklad: 'IT', nationality: 'Polska', gender: 'Kobieta', address: 'Testowa 1', roomNumber: '1' },
    { id: 'emp-3', firstName: 'Piotr', lastName: 'Lis', coordinatorId: 'coord-2', status: 'active', checkInDate: '2023-12-01', checkOutDate: '2024-01-10', zaklad: 'Marketing', nationality: 'Ukraina', gender: 'Mężczyzna', address: 'Testowa 2', roomNumber: '2' },
];


describe('Server Actions', () => {

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Default mock for getAllSheetsData to avoid undefined errors in actions
        mockedGetAllSheetsData.mockResolvedValue({
            settings: mockSettings,
            employees: mockEmployees,
            nonEmployees: [],
            addressHistory: [],
        });
    });

    describe('addEmployee', () => {
        it('should correctly serialize and add an employee', async () => {
            const mockAddRow = jest.fn().mockResolvedValue(undefined);
            const mockSheet = { addRow: mockAddRow };
            mockedGetSheet.mockResolvedValue(mockSheet as any);

            const employeeData = {
                firstName: 'Nowy',
                lastName: 'Pracownik',
                coordinatorId: 'coord-1',
                checkInDate: '2024-05-10',
            };

            await addEmployee(employeeData, 'coord-1');

            expect(mockedGetSheet).toHaveBeenCalledWith('Employees', expect.any(Array));
            expect(mockAddRow).toHaveBeenCalledTimes(1);
            
            // Check if the data passed to addRow is correctly serialized
            const addedData = mockAddRow.mock.calls[0][0];
            expect(addedData.firstName).toBe('Nowy');
            expect(addedData.lastName).toBe('Pracownik');
            expect(addedData.fullName).toBe('Pracownik Nowy'); // Crucial check
            expect(addedData.status).toBe('active');
        });
    });
    
    describe('updateEmployee', () => {
        it('should update an employee and create a notification', async () => {
            const mockRow = {
                get: (key: string) => mockEmployees[0][key as keyof Employee],
                set: jest.fn(),
                save: jest.fn().mockResolvedValue(undefined),
                toObject: () => mockEmployees[0],
            };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]) };
            const mockNotificationSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
            
            mockedGetSheet.mockImplementation((sheetName: string) => {
                if (sheetName === 'Employees') return Promise.resolve(mockSheet);
                if (sheetName === 'Powiadomienia') return Promise.resolve(mockNotificationSheet);
                return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]) });
            });

            await updateEmployee('emp-1', { comments: 'Nowy komentarz' }, 'coord-1');
            
            expect(mockRow.set).toHaveBeenCalledWith('comments', 'Nowy komentarz');
            expect(mockRow.save).toHaveBeenCalledTimes(1);
            expect(mockNotificationSheet.addRow).toHaveBeenCalledTimes(1);

            const notificationData = mockNotificationSheet.addRow.mock.calls[0][0];
            expect(notificationData.message).toContain('Zaktualizował dane');
            expect(notificationData.changes).toContain('Nowy komentarz');
        });
    });

    describe('deleteEmployee', () => {
        it('should delete an employee and their address history', async () => {
            const mockRow = {
                get: (key: string) => (key === 'id' ? 'emp-1' : ''),
                delete: jest.fn().mockResolvedValue(undefined),
                toObject: () => ({ id: 'emp-1' }),
            };
            
            const mockSheet = {
                getRows: jest.fn().mockResolvedValue([mockRow]),
            };

            mockedGetSheet.mockResolvedValue(mockSheet as any);
            mockedGetAllSheetsData.mockResolvedValue({ 
                addressHistory: [
                    { id: 'hist-1', employeeId: 'emp-1' },
                    { id: 'hist-2', employeeId: 'emp-2' },
                    { id: 'hist-3', employeeId: 'emp-1' },
                ],
                settings: mockSettings,
            });
            (sheets.deleteAddressHistoryEntry as jest.Mock).mockResolvedValue(undefined);

            await deleteEmployee('emp-1', 'coord-1');

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

            await expect(deleteEmployee('emp-not-found', 'coord-1')).rejects.toThrow('Employee not found for deletion.');
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

            await bulkDeleteEmployeesByDepartment('IT', 'coord-1');

            expect(mockedGetSheet).toHaveBeenCalledWith('Employees', expect.any(Array));
            expect(mockRows[0].delete).toHaveBeenCalledTimes(1);
            expect(mockRows[1].delete).not.toHaveBeenCalled();
            expect(mockRows[2].delete).toHaveBeenCalledTimes(1);
        });
    });
    
    describe('checkAndUpdateEmployeeStatuses', () => {
        it('should dismiss an employee whose checkout date is in the past', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 5);
            const pastDateStr = pastDate.toISOString().split('T')[0];

            const mockEmployeeRow = {
                get: (key: string) => {
                    if (key === 'status') return 'active';
                    if (key === 'checkOutDate') return pastDateStr;
                    return 'some-value';
                },
                set: jest.fn(),
                save: jest.fn().mockResolvedValue(undefined),
                toObject: () => ({ status: 'active', checkOutDate: pastDateStr }),
            };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockEmployeeRow]) };
            mockedGetSheet.mockResolvedValue(mockSheet as any);

            const result = await checkAndUpdateStatuses('system');
            
            expect(result.updated).toBe(1);
            expect(mockEmployeeRow.set).toHaveBeenCalledWith('status', 'dismissed');
            expect(mockEmployeeRow.save).toHaveBeenCalledTimes(1);
        });
    });

    describe('generateMonthlyReport', () => {
        it('should correctly calculate days in month for an employee', async () => {
             mockedGetAllSheetsData.mockResolvedValue({
                settings: mockSettings,
                employees: [
                    // Stays the whole month
                    { id: 'emp-1', checkInDate: '2024-01-01', checkOutDate: '2024-01-31', coordinatorId: 'coord-1', fullName: 'Test User 1' },
                    // Starts mid-month, leaves next month
                    { id: 'emp-2', checkInDate: '2024-01-15', checkOutDate: '2024-02-10', coordinatorId: 'coord-1', fullName: 'Test User 2' },
                    // Starts before, leaves mid-month
                    { id: 'emp-3', checkInDate: '2023-12-10', checkOutDate: '2024-01-10', coordinatorId: 'coord-1', fullName: 'Test User 3' },
                     // Not in this month at all
                    { id: 'emp-4', checkInDate: '2024-02-01', coordinatorId: 'coord-1', fullName: 'Test User 4' },
                ],
            });

            const result = await generateMonthlyReport(2024, 1, 'all');
            
            const sheetData = XLSX.read(result.fileContent, { type: 'base64' });
            const jsonData = XLSX.utils.sheet_to_json(sheetData.Sheets[sheetData.SheetNames[0]]);

            expect(jsonData).toHaveLength(3);
            expect(jsonData[0]).toHaveProperty('Dni w miesiącu', 31); // Jan 1 to 31 -> 31 days
            expect(jsonData[1]).toHaveProperty('Dni w miesiącu', 17); // Jan 15 to 31 -> 17 days
            expect(jsonData[2]).toHaveProperty('Dni w miesiącu', 10); // Jan 1 to 10 -> 10 days
        });
    });

    describe('importEmployeesFromExcel', () => {
        it('should correctly parse and prepare valid employee records for batch insertion', async () => {
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
    
            const mockAddRows = jest.fn().mockResolvedValue(undefined);
            const mockSheet = { addRows: mockAddRows };
            mockedGetSheet.mockResolvedValue(mockSheet as any);

            const result = await importEmployeesFromExcel(base64Content, 'coord-1', mockSettings);
    
            expect(result.importedCount).toBe(1);
            expect(result.totalRows).toBe(1);
            expect(result.errors).toHaveLength(0);
            expect(mockAddRows).toHaveBeenCalledTimes(1); // One batch call
            
            const addedRecords = mockAddRows.mock.calls[0][0];
            expect(addedRecords).toHaveLength(1);
            expect(addedRecords[0]).toEqual(expect.objectContaining({
                firstName: 'Adam',
                lastName: 'Testowy',
                coordinatorId: 'coord-1',
                zaklad: 'IT',
                checkInDate: '2024-01-01',
            }));
        });

        it('should report an error for a row with a non-existent coordinator', async () => {
            const excelData = [{
                'Imię': 'Adam', 'Nazwisko': 'Błędny', 'Koordynator': 'Nieistniejący Koordynator',
                'Narodowość': 'Polska', 'Zakład': 'IT', 'Miejscowość': 'Warszawa', 'Adres': 'ul. Testowa 1',
                'Pokój': '101', 'Data zameldowania': '01.01.2024',
            }];
            const base64Content = createMockExcel(excelData);
            
            const mockAddRows = jest.fn();
            mockedGetSheet.mockResolvedValue({ addRows: mockAddRows });

            const result = await importEmployeesFromExcel(base64Content, 'coord-1', mockSettings);

            expect(result.importedCount).toBe(0);
            expect(result.totalRows).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain("Nie znaleziono koordynatora 'nieistniejący koordynator'");
            expect(mockAddRows).not.toHaveBeenCalled();
        });

        it('should report an error for a row with missing required fields', async () => {
            const excelData = [{
                'Imię': 'Jan',
                'Nazwisko': 'Niewystarczający',
                'Koordynator': 'Jan Kowalski',
                // Missing "Data zameldowania" and other required fields
            }];
            const base64Content = createMockExcel(excelData);

            const mockAddRows = jest.fn();
            mockedGetSheet.mockResolvedValue({ addRows: mockAddRows });

            const result = await importEmployeesFromExcel(base64Content, 'coord-1', mockSettings);

            expect(result.importedCount).toBe(0);
            expect(result.totalRows).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain("Brak wymaganych danych w kolumnach:");
            expect(result.errors[0]).toContain("data zameldowania");
            expect(mockAddRows).not.toHaveBeenCalled();
        });
    });
});
