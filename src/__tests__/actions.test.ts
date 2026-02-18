import {
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addNonEmployee,
    updateNonEmployee,
    deleteNonEmployee,
    bulkDeleteEmployees,
    bulkDeleteEmployeesByCoordinator,
    transferEmployees,
    bulkDeleteEmployeesByDepartment,
    checkAndUpdateStatuses,
    importEmployeesFromExcel,
    updateSettings,
    updateNotificationReadStatus,
    clearAllNotifications,
    deleteNotification,
    generateAccommodationReport,
    generateNzCostsReport,
    importNonEmployeesFromExcel,
    migrateFullNames,
    updateCoordinatorSubscription,
    addBokResident,
    updateBokResident,
    deleteBokResident,
    deleteAddressHistoryEntry,
    sendPushNotification,
} from '@/lib/actions';
import * as sheets from '@/lib/sheets';
import XLSX from 'xlsx';
import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { adminMessaging } from '@/lib/firebase-admin';
import type { Settings, Employee, NonEmployee, BokResident } from '@/types';

// Mock firebase-admin
jest.mock('@/lib/firebase-admin', () => ({
    adminMessaging: {
        send: jest.fn(),
    },
}));

// Mock next/cache
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

// Mock the entire sheets module
jest.mock('@/lib/sheets', () => ({
    ...jest.requireActual('@/lib/sheets'), // import and retain default behavior
    getSheet: jest.fn(),
    getSettings: jest.fn(),
    getEmployees: jest.fn(),
    getNonEmployees: jest.fn(),
    getBokResidents: jest.fn(),
    getRawAddressHistory: jest.fn(),
    getNotifications: jest.fn(),
    addAddressHistoryEntry: jest.fn(),
    updateAddressHistoryEntry: jest.fn(),
    deleteAddressHistoryEntry: jest.fn(),
}));

const mockedGetSheet = sheets.getSheet as jest.Mock;
const mockedGetSettings = sheets.getSettings as jest.Mock;
const mockedGetEmployees = sheets.getEmployees as jest.Mock;
const mockedGetNonEmployees = sheets.getNonEmployees as jest.Mock;
const mockedGetBokResidents = sheets.getBokResidents as jest.Mock;
const mockedGetRawAddressHistory = sheets.getRawAddressHistory as jest.Mock;
const mockedGetNotifications = sheets.getNotifications as jest.Mock;
const mockedDeleteHistory = sheets.deleteAddressHistoryEntry as jest.Mock;

// Helper function to create a mock Excel file in memory (as base64)
function createMockExcel(data: Record<string, unknown>[]): string {
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
    statuses: [],
    bokRoles: [],
    bokReturnOptions: [],
    bokStatuses: [],
};

const mockEmployees: Employee[] = [
    { id: 'emp-1', firstName: 'Adam', lastName: 'Nowak', fullName: 'Nowak Adam', coordinatorId: 'coord-1', status: 'active', checkInDate: '2024-01-01', zaklad: 'IT', nationality: 'Polska', gender: 'Mężczyzna', address: 'Testowa 1', roomNumber: '1', depositReturned: null, depositReturnAmount: null, deductionNo30Days: null, deductionNo4Months: null, deductionRegulation: null, deductionReason: undefined, contractStartDate: null, contractEndDate: null },
    { id: 'emp-2', firstName: 'Ewa', lastName: 'Kowal', fullName: 'Kowal Ewa', coordinatorId: 'coord-1', status: 'active', checkInDate: '2024-02-01', checkOutDate: '2024-02-15', zaklad: 'IT', nationality: 'Polska', gender: 'Kobieta', address: 'Testowa 1', roomNumber: '1', depositReturned: null, depositReturnAmount: null, deductionNo30Days: null, deductionNo4Months: null, deductionRegulation: null, deductionReason: undefined, contractStartDate: null, contractEndDate: null },
    { id: 'emp-3', firstName: 'Piotr', lastName: 'Lis', fullName: 'Lis Piotr', coordinatorId: 'coord-2', status: 'active', checkInDate: '2023-12-01', checkOutDate: '2024-01-10', zaklad: 'Marketing', nationality: 'Ukraina', gender: 'Mężczyzna', address: 'Testowa 2', roomNumber: '2', depositReturned: null, depositReturnAmount: null, deductionNo30Days: null, deductionNo4Months: null, deductionRegulation: null, deductionReason: undefined, contractStartDate: null, contractEndDate: null },
];

describe('Server Actions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetSettings.mockResolvedValue(mockSettings);
        mockedGetEmployees.mockResolvedValue(mockEmployees);
        mockedGetNonEmployees.mockResolvedValue([]);
        mockedGetBokResidents.mockResolvedValue([]);
        mockedGetRawAddressHistory.mockResolvedValue([]);
        mockedGetNotifications.mockResolvedValue([]);
    });

    describe('addEmployee', () => {
        it('should correctly serialize and add an employee, and create a notification', async () => {
            const mockAddRowEmployee = jest.fn().mockResolvedValue(undefined);
            const mockAddRowNotification = jest.fn().mockResolvedValue(undefined);
            const mockAddRowAudit = jest.fn().mockResolvedValue(undefined);

            const mockEmployeeSheet = { addRow: mockAddRowEmployee, getRows: jest.fn().mockResolvedValue([]) };
            const mockNotificationSheet = { addRow: mockAddRowNotification, getRows: jest.fn().mockResolvedValue([]) };
            const mockAuditSheet = { addRow: mockAddRowAudit, getRows: jest.fn().mockResolvedValue([]) };

            mockedGetSheet.mockImplementation((title) => {
                if (title === 'Employees') return Promise.resolve(mockEmployeeSheet);
                if (title === 'Powiadomienia') return Promise.resolve(mockNotificationSheet);
                if (title === 'AuditLog') return Promise.resolve(mockAuditSheet);
                return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() }); // Fallback with addRow
            });

            const employeeData: Partial<Employee> = {
                firstName: 'Nowy',
                lastName: 'Pracownik',
                coordinatorId: 'coord-1',
                checkInDate: '2024-05-10',
            };

            await addEmployee(employeeData, 'coord-1');

            expect(mockedGetSheet).toHaveBeenCalledWith('Employees', expect.any(Array));
            expect(mockAddRowEmployee).toHaveBeenCalledTimes(1);

            const addedData = mockAddRowEmployee.mock.calls[0][0];
            expect(addedData.firstName).toBe('Nowy');
            expect(addedData.lastName).toBe('Pracownik');
            expect(addedData.fullName).toBe('Pracownik Nowy');
            expect(addedData.status).toBe('active');

            expect(mockedGetSheet).toHaveBeenCalledWith('Powiadomienia', expect.any(Array));
            expect(mockAddRowNotification).toHaveBeenCalledTimes(1);
        });
    });

    describe('updateEmployee', () => {
        it('should update an employee and create a notification for changes', async () => {
            const mockRow = {
                get: (key: string) => mockEmployees[0][key as keyof Employee],
                set: jest.fn(),
                save: jest.fn().mockResolvedValue(undefined),
                toObject: () => mockEmployees[0],
            };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]), addRow: jest.fn() };
            const mockNotificationSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
            const mockAuditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

            mockedGetSheet.mockImplementation((sheetName: string) => {
                if (sheetName === 'Employees') return Promise.resolve(mockSheet);
                if (sheetName === 'Powiadomienia') return Promise.resolve(mockNotificationSheet);
                if (sheetName === 'AuditLog') return Promise.resolve(mockAuditSheet);
                return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
            });

            await updateEmployee('emp-1', { comments: 'Nowy komentarz' }, 'coord-1');

            expect(mockRow.set).toHaveBeenCalledWith('comments', 'Nowy komentarz');
            expect(mockRow.save).toHaveBeenCalledTimes(1);
            expect(mockNotificationSheet.addRow).toHaveBeenCalledTimes(1);

            const notificationData = mockNotificationSheet.addRow.mock.calls[0][0];
            expect(notificationData.message).toContain('Zaktualizował dane');
            expect(notificationData.changes).toContain('comments');
            expect(notificationData.changes).toContain('Nowy komentarz');
        });
    });

    describe('deleteEmployee', () => {
        it('should delete an employee and their address history', async () => {
            const mockRow = {
                get: (key: string) => (key === 'id' ? 'emp-1' : ''),
                delete: jest.fn().mockResolvedValue(undefined),
            };

            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]), addRow: jest.fn() };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

            mockedGetRawAddressHistory.mockResolvedValue([
                { id: 'hist-1', employeeId: 'emp-1' },
                { id: 'hist-2', employeeId: 'emp-2' },
                { id: 'hist-3', employeeId: 'emp-1' },
            ]);
            mockedDeleteHistory.mockResolvedValue(undefined);

            await deleteEmployee('emp-1', 'coord-1');

            expect(mockedGetSheet).toHaveBeenCalledWith('Employees', expect.any(Array));
            expect(mockRow.delete).toHaveBeenCalledTimes(1);
            expect(mockedDeleteHistory).toHaveBeenCalledTimes(2);
            expect(mockedDeleteHistory).toHaveBeenCalledWith('hist-1');
            expect(mockedDeleteHistory).toHaveBeenCalledWith('hist-3');
        });

        it('should throw an error if employee is not found', async () => {
            const mockSheet = { getRows: jest.fn().mockResolvedValue([]) };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);
            mockedGetRawAddressHistory.mockResolvedValue([]);

            await expect(deleteEmployee('emp-not-found', 'coord-1')).rejects.toThrow('Employee not found for deletion.');
        });
    });

    describe('bulkDeleteEmployees', () => {
        it('should delete all employees with the specified status', async () => {
            const mockRows = [
                { get: (key: string) => (key === 'status' ? 'active' : 'value'), delete: jest.fn().mockResolvedValue(undefined) },
                { get: (key: string) => (key === 'status' ? 'dismissed' : 'value'), delete: jest.fn().mockResolvedValue(undefined) },
                { get: (key: string) => (key === 'status' ? 'active' : 'value'), delete: jest.fn().mockResolvedValue(undefined) },
            ];

            const mockSheet = { getRows: jest.fn().mockResolvedValue(mockRows) };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

            await bulkDeleteEmployees('active', 'coord-1');

            expect(mockRows[0].delete).toHaveBeenCalledTimes(1);
            expect(mockRows[1].delete).not.toHaveBeenCalled();
            expect(mockRows[2].delete).toHaveBeenCalledTimes(1);
        });
    });

    describe('bulkDeleteEmployeesByCoordinator', () => {
        it('should delete all employees assigned to the specified coordinator', async () => {
            const mockRows = [
                { get: (key: string) => (key === 'coordinatorId' ? 'coord-1' : 'value'), delete: jest.fn().mockResolvedValue(undefined) },
                { get: (key: string) => (key === 'coordinatorId' ? 'coord-2' : 'value'), delete: jest.fn().mockResolvedValue(undefined) },
            ];

            const mockSheet = { getRows: jest.fn().mockResolvedValue(mockRows), addRow: jest.fn().mockResolvedValue(undefined) };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

            await bulkDeleteEmployeesByCoordinator('coord-1', 'coord-1');

            expect(mockRows[0].delete).toHaveBeenCalledTimes(1);
            expect(mockRows[1].delete).not.toHaveBeenCalled();
        });
    });

    describe('transferEmployees', () => {
        it('should transfer employees from one coordinator to another', async () => {
            const mockRows = [
                { get: (key: string) => (key === 'coordinatorId' ? 'coord-1' : 'value'), set: jest.fn(), save: jest.fn().mockResolvedValue(undefined) },
                { get: (key: string) => (key === 'coordinatorId' ? 'coord-2' : 'value'), set: jest.fn(), save: jest.fn().mockResolvedValue(undefined) },
            ];

            const mockSheet = { getRows: jest.fn().mockResolvedValue(mockRows) };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);
            mockedGetSettings.mockResolvedValue(mockSettings);

            await transferEmployees('coord-1', 'coord-2');

            expect(mockRows[0].set).toHaveBeenCalledWith('coordinatorId', 'coord-2');
            expect(mockRows[0].save).toHaveBeenCalledTimes(1);
            expect(mockRows[1].set).not.toHaveBeenCalled();
        });
    });

    describe('bulkDeleteEmployeesByDepartment', () => {
        it('should delete only employees from the specified department', async () => {
            const mockRows = [
                { get: (key: string) => (key === 'zaklad' ? 'IT' : 'some-other-value'), delete: jest.fn().mockResolvedValue(undefined) },
                { get: (key: string) => (key === 'zaklad' ? 'HR' : 'some-other-value'), delete: jest.fn().mockResolvedValue(undefined) },
                { get: (key: string) => (key === 'zaklad' ? 'IT' : 'some-other-value'), delete: jest.fn().mockResolvedValue(undefined) },
            ];

            const mockSheet = { getRows: jest.fn().mockResolvedValue(mockRows), addRow: jest.fn().mockResolvedValue(undefined) };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

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

            const mockEmployeeSheet = { getRows: jest.fn().mockResolvedValue([mockEmployeeRow]), addRow: jest.fn() };
            const mockNonEmployeeSheet = { getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() };
            const mockNotificationSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
            const mockAuditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

            mockedGetSheet.mockImplementation((title) => {
                if (title === 'Employees') return Promise.resolve(mockEmployeeSheet);
                if (title === 'NonEmployees') return Promise.resolve(mockNonEmployeeSheet);
                if (title === 'Powiadomienia') return Promise.resolve(mockNotificationSheet);
                if (title === 'AuditLog') return Promise.resolve(mockAuditSheet);
                return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
            });

            const result = await checkAndUpdateStatuses('system');

            expect(result.updated).toBe(1);
            expect(mockEmployeeRow.set).toHaveBeenCalledWith('status', 'dismissed');
            expect(mockEmployeeRow.save).toHaveBeenCalledTimes(1);
        });
    });



    describe('addNonEmployee', () => {
        it('should correctly serialize and add a non-employee', async () => {
            const mockAddRowNonEmployee = jest.fn().mockResolvedValue(undefined);
            const mockAddRowNotification = jest.fn().mockResolvedValue(undefined);
            const mockAddRowAudit = jest.fn().mockResolvedValue(undefined);

            const mockNonEmployeeSheet = { addRow: mockAddRowNonEmployee, getRows: jest.fn().mockResolvedValue([]) };
            const mockNotificationSheet = { addRow: mockAddRowNotification, getRows: jest.fn().mockResolvedValue([]) };
            const mockAuditSheet = { addRow: mockAddRowAudit, getRows: jest.fn().mockResolvedValue([]) };

            mockedGetSheet.mockImplementation((title) => {
                if (title === 'NonEmployees') return Promise.resolve(mockNonEmployeeSheet);
                if (title === 'Powiadomienia') return Promise.resolve(mockNotificationSheet);
                if (title === 'AuditLog') return Promise.resolve(mockAuditSheet);
                return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
            });

            const nonEmployeeData: Omit<NonEmployee, 'id' | 'status'> = {
                firstName: 'Nowy',
                lastName: 'Mieszkaniec',
                fullName: 'Mieszkaniec Nowy',
                coordinatorId: 'coord-1',
                checkInDate: '2024-05-10',
                nationality: 'Polska',
                gender: 'Mężczyzna',
                address: 'Testowa 1',
                roomNumber: '101',
                paymentType: 'Miesięczny',
                paymentAmount: 1000,
            };

            await addNonEmployee(nonEmployeeData, 'coord-1');

            expect(mockedGetSheet).toHaveBeenCalledWith('NonEmployees', expect.any(Array));
            expect(mockAddRowNonEmployee).toHaveBeenCalledTimes(1);

            const addedData = mockAddRowNonEmployee.mock.calls[0][0];
            expect(addedData.firstName).toBe('Nowy');
            expect(addedData.lastName).toBe('Mieszkaniec');
            expect(addedData.status).toBe('active');
        });
    });

    describe('updateNonEmployee', () => {
        it('should update a non-employee', async () => {
            const mockRow = {
                get: (key: string) => (key === 'id' ? 'nonemp-1' : (key === 'firstName' ? 'Old' : 'Test')),
                set: jest.fn(),
                save: jest.fn().mockResolvedValue(undefined),
                toObject: () => ({ id: 'nonemp-1', firstName: 'Old', lastName: 'Test' }),
            };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]), addRow: jest.fn() };
            const mockNotificationSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
            const mockAuditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

            mockedGetSheet.mockImplementation((title) => {
                if (title === 'NonEmployees') return Promise.resolve(mockSheet);
                if (title === 'Powiadomienia') return Promise.resolve(mockNotificationSheet);
                if (title === 'AuditLog') return Promise.resolve(mockAuditSheet);
                return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
            });

            await updateNonEmployee('nonemp-1', { comments: 'New comment' }, 'coord-1');

            expect(mockRow.set).toHaveBeenCalledWith('comments', 'New comment');
            expect(mockRow.save).toHaveBeenCalledTimes(1);
        });
    });

    describe('deleteNonEmployee', () => {
        it('should delete a non-employee', async () => {
            const mockRow = {
                get: (key: string) => (key === 'id' ? 'nonemp-1' : ''),
                delete: jest.fn().mockResolvedValue(undefined),
            };

            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]), addRow: jest.fn() };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

            mockedGetRawAddressHistory.mockResolvedValue([]);

            await deleteNonEmployee('nonemp-1', 'coord-1');

            expect(mockRow.delete).toHaveBeenCalledTimes(1);
        });
    });

    describe('importEmployeesFromExcel', () => {
        it('should correctly parse valid rows and report errors for invalid ones', async () => {
            const excelData = [
                { 'Imię': 'Adam', 'Nazwisko': 'Testowy', 'Koordynator': 'Jan Kowalski', 'Data zameldowania': '01.01.2024', 'Zakład': 'IT', 'Miejscowość': 'Warszawa', 'Adres': 'Testowa 1', 'Pokój': '101', 'Narodowość': 'Polska' },
                { 'Imię': 'Ewa', 'Nazwisko': 'Błędna', 'Koordynator': 'Nieistniejący', 'Data zameldowania': '02.01.2024', 'Zakład': 'HR', 'Miejscowość': 'Kraków', 'Adres': 'Testowa 2', 'Pokój': '102', 'Narodowość': 'Ukraina' },
                { 'Imię': 'Jan', 'Nazwisko': 'Niewystarczający' /* Missing fields */ },
            ];
            const base64Content = createMockExcel(excelData);

            const mockAddRowsEmployee = jest.fn().mockResolvedValue(undefined);
            const mockAddRowsNotification = jest.fn().mockResolvedValue(undefined);

            mockedGetSheet.mockImplementation((title) => {
                if (title === 'Employees') return Promise.resolve({ addRows: mockAddRowsEmployee });
                if (title === 'Powiadomienia') return Promise.resolve({ addRows: mockAddRowsNotification });
                return Promise.resolve({ addRows: jest.fn() });
            });

            const result = await importEmployeesFromExcel(base64Content, 'coord-1', mockSettings);

            expect(result.importedCount).toBe(1);
            expect(result.totalRows).toBe(3);
            expect(result.errors).toHaveLength(2);
            expect(result.errors[0]).toContain("Wiersz 3 (Błędna): Nie znaleziono koordynatora 'Nieistniejący'.");
            expect(result.errors[1]).toContain("Wiersz 4: Brak wymaganych danych w kolumnach: koordynator, data zameldowania, zakład, miejscowość, adres, pokój, narodowość.");

            expect(mockAddRowsEmployee).toHaveBeenCalledTimes(1);

            const addedRecords = mockAddRowsEmployee.mock.calls[0][0];
            expect(addedRecords).toHaveLength(1);
            expect(addedRecords[0]).toEqual(expect.objectContaining({
                firstName: 'Adam',
                lastName: 'Testowy',
                coordinatorId: 'coord-1',
                checkInDate: '2024-01-01',
            }));
        });
    });

    describe('importNonEmployeesFromExcel', () => {
        it('should correctly parse and import non-employees', async () => {
            const nonEmployeeData = [
                { 'Imię': 'Jan', 'Nazwisko': 'Kowalski', 'Koordynator': 'Jan Kowalski', 'Data zameldowania': '01.01.2024', 'Miejscowość': 'Warszawa', 'Adres': 'Testowa 1', 'Pokój': '101', 'Narodowość': 'Polska', 'Rodzaj płatności nz': 'Miesięczny', 'Kwota': 1000 },
            ];
            const base64Content = createMockExcel(nonEmployeeData);

            const mockAddRowsNonEmployee = jest.fn().mockResolvedValue(undefined);
            const mockAddRowsNotification = jest.fn().mockResolvedValue(undefined);

            const mockSheetNonEmployee = { addRows: mockAddRowsNonEmployee };
            const mockSheetNotification = { addRows: mockAddRowsNotification };

            mockedGetSheet.mockImplementation((title) => {
                if (title === 'NonEmployees') return Promise.resolve(mockSheetNonEmployee);
                if (title === 'Powiadomienia') return Promise.resolve(mockSheetNotification);
                return Promise.resolve({ addRows: jest.fn() });
            });

            const result = await importNonEmployeesFromExcel(base64Content, 'coord-1', mockSettings);

            expect(result.importedCount).toBe(1);
            expect(result.totalRows).toBe(1);
            expect(result.errors).toHaveLength(0);
            expect(mockAddRowsNonEmployee).toHaveBeenCalledTimes(1);

            const addedRecords = mockAddRowsNonEmployee.mock.calls[0][0];
            expect(addedRecords[0]).toEqual(expect.objectContaining({
                firstName: 'Jan',
                lastName: 'Kowalski',
                coordinatorId: 'coord-1',
                checkInDate: '2024-01-01',
                paymentType: 'Miesięczny',
                paymentAmount: "1000",
            }));
        });
    });

    describe('updateSettings', () => {
        it('should update nationalities', async () => {
            const mockRows = [
                { get: (_key: 'name') => 'Polska', delete: jest.fn().mockResolvedValue(undefined) },
                { get: (_key: 'name') => 'Ukraina', delete: jest.fn().mockResolvedValue(undefined) },
            ];
            const mockSheet = {
                getRows: jest.fn().mockResolvedValue(mockRows),
                addRows: jest.fn().mockResolvedValue(undefined),
            };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

            await updateSettings({ nationalities: ['Polska', 'Niemcy'] });

            expect(mockSheet.getRows).toHaveBeenCalled();
            expect(mockRows[0].delete).not.toHaveBeenCalled(); // Polska exists
            expect(mockRows[1].delete).toHaveBeenCalled(); // Ukraina is removed
            expect(mockSheet.addRows).toHaveBeenCalledWith([{ name: 'Niemcy' }], { raw: false, insert: true }); // Niemcy is added
        });

        it('should update coordinators', async () => {
            const mockSheet = {
                getRows: jest.fn().mockResolvedValue([]),
                clearRows: jest.fn().mockResolvedValue(undefined),
                addRows: jest.fn().mockResolvedValue(undefined),
            };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

            const newCoordinators = [{ uid: 'coord-1', name: 'Jan', isAdmin: false, departments: ['IT'] }];
            await updateSettings({ coordinators: newCoordinators });

            expect(mockSheet.addRows).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        uid: 'coord-1',
                        name: 'Jan',
                        isAdmin: 'FALSE',
                        departments: 'IT',
                    })
                ]),
                { raw: false, insert: true }
            );
        });
    });

    describe('updateNotificationReadStatus', () => {
        it('should update the read status of a notification', async () => {
            const mockRow = { get: (key: string) => (key === 'id' ? 'notif-1' : 'FALSE'), set: jest.fn(), save: jest.fn().mockResolvedValue(undefined) };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]) };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

            await updateNotificationReadStatus('notif-1', true);

            expect(mockRow.set).toHaveBeenCalledWith('isRead', 'TRUE');
            expect(mockRow.save).toHaveBeenCalledTimes(1);
        });
    });

    describe('clearAllNotifications', () => {
        it('should clear all notifications', async () => {
            const mockSheet = { clearRows: jest.fn().mockResolvedValue(undefined) };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

            await clearAllNotifications();

            expect(mockSheet.clearRows).toHaveBeenCalledTimes(1);
        });
    });

    describe('deleteNotification', () => {
        it('should delete a notification', async () => {
            const mockRow = { get: (key: string) => (key === 'id' ? 'notif-1' : ''), delete: jest.fn().mockResolvedValue(undefined) };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]) };
            mockedGetSheet.mockResolvedValue(mockSheet as unknown as GoogleSpreadsheetWorksheet);

            await deleteNotification('notif-1');

            expect(mockRow.delete).toHaveBeenCalledTimes(1);
        });
    });

    describe('generateAccommodationReport', () => {
        it('should generate accommodation report successfully', async () => {
            mockedGetEmployees.mockResolvedValue(mockEmployees);
            mockedGetSettings.mockResolvedValue(mockSettings);
            mockedGetRawAddressHistory.mockResolvedValue([]);

            const result = await generateAccommodationReport(2024, 1, 'all', false);

            expect(result.success).toBe(true);
            expect(result.fileContent).toBeDefined();
            expect(result.fileName).toContain('Raport_Zakwaterowania');
        });
    });

    describe('generateNzCostsReport', () => {
        it('should generate NZ costs report successfully', async () => {
            const mockNonEmployees: NonEmployee[] = [
                {
                    id: 'nonemp-1',
                    firstName: 'Jan',
                    lastName: 'Kowalski',
                    fullName: 'Kowalski Jan',
                    coordinatorId: 'coord-1',
                    nationality: 'Polska',
                    gender: 'Mężczyzna',
                    address: 'Testowa 1',
                    roomNumber: '1',
                    checkInDate: '2024-01-01',
                    checkOutDate: null,
                    departureReportDate: null,
                    comments: '',
                    paymentType: 'Miesięczny',
                    paymentAmount: 1000,
                    status: 'active',
                },
            ];

            mockedGetNonEmployees.mockResolvedValue(mockNonEmployees);
            mockedGetSettings.mockResolvedValue(mockSettings);

            const result = await generateNzCostsReport(2024, 1, 'all');

            expect(result.success).toBe(true);
            expect(result.fileContent).toBeDefined();
            expect(result.fileName).toContain('Raport_Koszty_NZ');
        });
    });

    describe('migrateFullNames', () => {
        it('should migrate full names to separate first and last names', async () => {
            const mockEmployeeRows = [
                {
                    get: (key: string) => key === 'fullName' ? 'Kowalski Jan' : '',
                    set: jest.fn(),
                    save: jest.fn().mockResolvedValue(undefined)
                },
                {
                    get: () => '',
                    set: jest.fn(),
                    save: jest.fn().mockResolvedValue(undefined)
                },
            ];
            const mockNonEmployeeRows = [
                {
                    get: (key: string) => key === 'fullName' ? 'Nowak Anna' : '',
                    set: jest.fn(),
                    save: jest.fn().mockResolvedValue(undefined)
                },
            ];

            mockedGetSheet.mockImplementation((sheetName) => {
                if (sheetName === 'Employees') return Promise.resolve({ getRows: () => Promise.resolve(mockEmployeeRows), addRow: jest.fn() });
                if (sheetName === 'NonEmployees') return Promise.resolve({ getRows: () => Promise.resolve(mockNonEmployeeRows), addRow: jest.fn() });
                return Promise.resolve({ getRows: () => Promise.resolve([]), addRow: jest.fn().mockResolvedValue(undefined) });
            });

            const result = await migrateFullNames('coord-1');

            expect(result.migratedEmployees).toBe(1);
            expect(result.migratedNonEmployees).toBe(1);
            expect(mockEmployeeRows[0].set).toHaveBeenCalledWith('firstName', 'Jan');
            expect(mockEmployeeRows[0].set).toHaveBeenCalledWith('lastName', 'Kowalski');
        });
    });

    describe('updateCoordinatorSubscription', () => {
        it('should update coordinator push subscription', async () => {
            const mockRow = { get: () => 'coord-1', set: jest.fn(), save: jest.fn().mockResolvedValue(undefined) };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]) };
            mockedGetSheet.mockResolvedValue(mockSheet);

            const subscription = { endpoint: 'test-endpoint' };
            await updateCoordinatorSubscription('coord-1', JSON.stringify(subscription));

            expect(mockRow.set).toHaveBeenCalledWith('pushSubscription', JSON.stringify(subscription));
            expect(mockRow.save).toHaveBeenCalledTimes(1);
        });

        it('should clear subscription if null provided', async () => {
            const mockRow = { get: () => 'coord-1', set: jest.fn(), save: jest.fn().mockResolvedValue(undefined) };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]) };
            mockedGetSheet.mockResolvedValue(mockSheet);

            await updateCoordinatorSubscription('coord-1', null);

            expect(mockRow.set).toHaveBeenCalledWith('pushSubscription', '');
            expect(mockRow.save).toHaveBeenCalledTimes(1);
        });
    });

    describe('BokResident Actions', () => {
        it('should add a BOK resident', async () => {
            const mockAddRow = jest.fn().mockResolvedValue(undefined);
            const mockNotificationSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
            const mockAuditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

            mockedGetSheet.mockImplementation((title) => {
                if (title === 'BokResidents') return Promise.resolve({ addRow: mockAddRow, getRows: jest.fn().mockResolvedValue([]) });
                if (title === 'Powiadomienia') return Promise.resolve(mockNotificationSheet);
                if (title === 'AuditLog') return Promise.resolve(mockAuditSheet);
                return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
            });

            const residentData: Omit<BokResident, 'id'> = {
                firstName: 'Bok',
                lastName: 'Resident',
                fullName: 'Resident Bok',
                role: 'Kierowca',
                coordinatorId: 'coord-1',
                nationality: 'Polska',
                address: 'Testowa 1',
                roomNumber: '1',
                zaklad: 'Transport',
                gender: 'Mężczyzna',
                checkInDate: '2024-01-01',
                checkOutDate: null,
                returnStatus: '',
                status: 'active',
                comments: ''
            };

            await addBokResident(residentData, 'coord-1');

            expect(mockedGetSheet).toHaveBeenCalledWith('BokResidents', expect.any(Array));
            expect(mockAddRow).toHaveBeenCalledTimes(1);
            expect(mockAddRow.mock.calls[0][0].firstName).toBe('Bok');
        });

        it('should update a BOK resident', async () => {
            const mockRow = {
                get: (key: string) => (key === 'id' ? 'bok-1' : 'old-val'),
                set: jest.fn(),
                save: jest.fn().mockResolvedValue(undefined),
                toObject: () => ({ id: 'bok-1', firstName: 'Old' }),
            };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]), addRow: jest.fn() };
            const mockNotificationSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
            const mockAuditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

            mockedGetSheet.mockImplementation((title) => {
                if (title === 'BokResidents') return Promise.resolve(mockSheet);
                if (title === 'Powiadomienia') return Promise.resolve(mockNotificationSheet);
                if (title === 'AuditLog') return Promise.resolve(mockAuditSheet);
                return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
            });

            await updateBokResident('bok-1', { comments: 'Updated' }, 'coord-1');

            expect(mockRow.set).toHaveBeenCalledWith('comments', 'Updated');
            expect(mockRow.save).toHaveBeenCalledTimes(1);
        });

        it('should delete a BOK resident', async () => {
            const mockRow = {
                get: (key: string) => (key === 'id' ? 'bok-1' : ''),
                delete: jest.fn().mockResolvedValue(undefined),
            };
            const mockSheet = { getRows: jest.fn().mockResolvedValue([mockRow]) };
            mockedGetSheet.mockResolvedValue(mockSheet);

            await deleteBokResident('bok-1', 'coord-1');

            expect(mockRow.delete).toHaveBeenCalledTimes(1);
        });
    });

    describe('deleteAddressHistoryEntry', () => {
        it('should delete address history entry via action', async () => {
            mockedDeleteHistory.mockResolvedValue(undefined);
            const mockAuditSheet = { addRow: jest.fn().mockResolvedValue(undefined), getRows: jest.fn().mockResolvedValue([]) };
            mockedGetSheet.mockResolvedValue(mockAuditSheet);

            await deleteAddressHistoryEntry('hist-1', 'coord-1');

            expect(mockedDeleteHistory).toHaveBeenCalledWith('hist-1');
            expect(mockAuditSheet.addRow).toHaveBeenCalled();
        });
    });

    describe('sendPushNotification', () => {
        it('should send push notification if token exists', async () => {
            const mockCoordinator = { uid: 'coord-1', name: 'Coord', isAdmin: false, departments: [], pushSubscription: 'valid-token' };
            mockedGetSettings.mockResolvedValue({ coordinators: [mockCoordinator] });

            await sendPushNotification('coord-1', 'Test Title', 'Test Body');

            expect(adminMessaging!.send).toHaveBeenCalledTimes(1);
            expect(adminMessaging!.send).toHaveBeenCalledWith(expect.objectContaining({
                token: 'valid-token',
                data: expect.objectContaining({ title: 'Test Title', body: 'Test Body' })
            }));
        });

        it('should skip sending if token is missing', async () => {
            const mockCoordinator = { uid: 'coord-1', name: 'Coord', isAdmin: false, departments: [], pushSubscription: '' };
            mockedGetSettings.mockResolvedValue({ coordinators: [mockCoordinator] });

            (adminMessaging!.send as jest.Mock).mockClear();

            await sendPushNotification('coord-1', 'Test', 'Test');

            expect(adminMessaging!.send).not.toHaveBeenCalled();
        });
    });
});
