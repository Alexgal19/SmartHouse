import { importEmployeesFromExcel, importNonEmployeesFromExcel } from '@/lib/actions';
import * as actions from '@/lib/actions';
import * as XLSX from 'xlsx';
import type { Settings } from '@/types';

// Mockowanie modułu 'actions', aby móc śledzić wywołania funkcji podrzędnych
jest.mock('@/lib/actions', () => {
  const originalModule = jest.requireActual('@/lib/actions');
  return {
    __esModule: true,
    ...originalModule, // Eksportujemy oryginalne implementacje
    addEmployee: jest.fn().mockResolvedValue(undefined), // Ale mockujemy funkcje, które chcemy śledzić/kontrolować
    addNonEmployee: jest.fn().mockResolvedValue(undefined),
    updateSettings: jest.fn().mockResolvedValue(undefined),
  };
});

// Typowanie mockowanych funkcji dla bezpieczeństwa typów w testach
const mockedAddEmployee = actions.addEmployee as jest.Mock;
const mockedAddNonEmployee = actions.addNonEmployee as jest.Mock;
const mockedUpdateSettings = actions.updateSettings as jest.Mock;

// Pomocnicza funkcja do tworzenia pliku Excel w pamięci (jako base64)
function createMockExcel(data: any[]): string {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Arkusz1');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer.toString('base64');
}

// Przygotowanie mockowych ustawień, na których będą bazować testy
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

describe('Import z Plików Excel', () => {
  // Resetowanie mocków przed każdym testem, aby zapewnić izolację
  beforeEach(() => {
    mockedAddEmployee.mockClear();
    mockedAddNonEmployee.mockClear();
    mockedUpdateSettings.mockClear();
  });

  describe('Import Pracowników (Employees)', () => {
    it('powinien poprawnie zaimportować prawidłowe dane pracownika', async () => {
      const excelData = [
        {
          'Imię i nazwisko': 'Testowy Adam',
          'Koordynator': 'Jan Kowalski',
          'Narodowość': 'Polska',
          'Płeć': 'Mężczyzna',
          'Adres': 'ul. Testowa 1',
          'Pokój': '101',
          'Zakład': 'IT',
          'Data zameldowania': '01.01.2024',
        },
      ];
      const base64Content = createMockExcel(excelData);

      const result = await importEmployeesFromExcel(base64Content, 'admin-uid', mockSettings);

      expect(result.importedCount).toBe(1);
      expect(result.totalRows).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockedAddEmployee).toHaveBeenCalledTimes(1);
      expect(mockedAddEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          lastName: 'Testowy',
          firstName: 'Adam',
          coordinatorId: 'coord-1',
          zaklad: 'IT',
          checkInDate: '2024-01-01',
        }),
        'admin-uid'
      );
    });

    it('powinien zignorować wiersz z nieistniejącym koordynatorem i zaraportować błąd', async () => {
      const excelData = [
        { 'Imię i nazwisko': 'Poprawny Jan', 'Koordynator': 'Jan Kowalski', 'Data zameldowania': '01.01.2024' },
        { 'Imię i nazwisko': 'Błędny Adam', 'Koordynator': 'Nieistniejący Koordynator', 'Data zameldowania': '01.01.2024' },
      ];
      const base64Content = createMockExcel(excelData);

      const result = await importEmployeesFromExcel(base64Content, 'admin-uid', mockSettings);

      expect(result.importedCount).toBe(1);
      expect(result.totalRows).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Nie znaleziono koordynatora 'nieistniejący koordynator'");
      expect(mockedAddEmployee).toHaveBeenCalledTimes(1);
    });

    it('powinien zignorować wiersz bez imienia i nazwiska lub daty zameldowania', async () => {
        const excelData = [
            { 'Imię i nazwisko': '', 'Koordynator': 'Jan Kowalski', 'Data zameldowania': '01.01.2024' },
            { 'Imię i nazwisko': 'Testowy Jan', 'Koordynator': 'Jan Kowalski', 'Data zameldowania': '' },
        ];
        const base64Content = createMockExcel(excelData);

        const result = await importEmployeesFromExcel(base64Content, 'admin-uid', mockSettings);

        expect(result.importedCount).toBe(0);
        expect(result.totalRows).toBe(2);
        expect(mockedAddEmployee).not.toHaveBeenCalled();
    });

    it('powinien wykryć i dodać nową miejscowość do ustawień', async () => {
      const excelData = [
        {
          'Imię i nazwisko': 'Nowacki Jan',
          'Koordynator': 'Jan Kowalski',
          'Miejscowość': 'Gdańsk', // Nowa miejscowość
          'Data zameldowania': '01.01.2024',
        },
      ];
      const base64Content = createMockExcel(excelData);

      await importEmployeesFromExcel(base64Content, 'admin-uid', mockSettings);

      expect(mockedUpdateSettings).toHaveBeenCalledTimes(1);
      expect(mockedUpdateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          localities: expect.arrayContaining(['Warszawa', 'Kraków', 'Gdańsk']),
        })
      );
    });
  });

  describe('Import Mieszkańców (NZ)', () => {
    it('powinien poprawnie zaimportować mieszkańca (NZ)', async () => {
        const excelData = [
            {
              'Imię i nazwisko': 'Niezatrudniony Zenon',
              'Koordynator': 'Anna Nowak',
              'Adres': 'ul. Wolna 5',
              'Data zameldowania': '2024-02-10',
              'Rodzaj płatności NZ': 'Miesięcznie',
              'Kwota': 500.50
            },
        ];
        const base64Content = createMockExcel(excelData);

        const result = await importNonEmployeesFromExcel(base64Content, 'admin-uid', mockSettings);

        expect(result.importedCount).toBe(1);
        expect(result.totalRows).toBe(1);
        expect(result.errors).toHaveLength(0);
        expect(mockedAddNonEmployee).toHaveBeenCalledTimes(1);
        expect(mockedAddNonEmployee).toHaveBeenCalledWith(
            expect.objectContaining({
                lastName: 'Niezatrudniony',
                firstName: 'Zenon',
                coordinatorId: 'coord-2',
                paymentType: 'Miesięcznie',
                paymentAmount: 500.50
            }),
            'admin-uid'
        );
    });
  });
});
