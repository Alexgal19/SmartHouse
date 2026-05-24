/**
 * BOK-specific tests (uproszczony rejestr BOK)
 * Covers: addBokResident, updateBokResident, deleteBokResident.
 */

import {
    addBokResident,
    updateBokResident,
    deleteBokResident,
} from '@/lib/actions';
import * as sheets from '@/lib/sheets';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import type { BokResident, Settings } from '@/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/firebase-admin', () => ({
    adminMessaging: { send: jest.fn() },
}));

jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

jest.mock('@/lib/sheets', () => ({
    ...jest.requireActual('@/lib/sheets'),
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

const mockSettings: Settings = {
    id: 'global-settings',
    coordinators: [{ uid: 'coord-1', name: 'Jan Kowalski', isAdmin: false, departments: [] }],
    localities: [],
    departments: [],
    nationalities: [],
    genders: [],
    addresses: [],
    paymentTypesNZ: [],
    statuses: [],
    bokRoles: [],
    bokReturnOptions: [],
    bokStatuses: [],
};

// ─── Helper: make a Google Sheets row mock ────────────────────────────────────

function makeRow(data: Record<string, string>) {
    return {
        get: (key: string) => data[key] ?? '',
        set: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        toObject: () => ({ ...data }),
    };
}

// ─── 1. addBokResident ────────────────────────────────────────────────────────

describe('addBokResident', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetSettings.mockResolvedValue(mockSettings);
    });

    it('adds a BOK resident and calls addRow with correct fields', async () => {
        const mockAddRow = jest.fn().mockResolvedValue(undefined);
        const notifSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
        const auditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

        mockedGetSheet.mockImplementation((title: string) => {
            if (title === 'BOK') return Promise.resolve({ addRow: mockAddRow, getRows: jest.fn().mockResolvedValue([]) });
            if (title === 'Powiadomienia') return Promise.resolve(notifSheet);
            if (title === 'AuditLog') return Promise.resolve(auditSheet);
            return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
        });

        const data: Omit<BokResident, 'id'> = {
            firstName: 'Jan',
            lastName: 'Tester',
            fullName: 'Tester Jan',
            nationality: 'Polska',
            address: 'Testowa 1',
            roomNumber: '1',
            gender: 'Mężczyzna',
            passportNumber: 'AB123456',
            checkInDate: '2024-01-01',
            comments: '',
        };

        await addBokResident(data, 'coord-1');

        expect(mockAddRow).toHaveBeenCalledTimes(1);
        const added = mockAddRow.mock.calls[0][0];
        expect(added.firstName).toBe('Jan');
        expect(added.lastName).toBe('Tester');
        expect(added.passportNumber).toBe('AB123456');
    });

    it('generates an id for the new BOK resident', async () => {
        const mockAddRow = jest.fn().mockResolvedValue(undefined);
        mockedGetSheet.mockResolvedValue({ addRow: mockAddRow, getRows: jest.fn().mockResolvedValue([]) });

        const data: Omit<BokResident, 'id'> = {
            firstName: 'X', lastName: 'Y', fullName: 'Y X',
            nationality: 'Polska', address: '', roomNumber: '',
            gender: 'Mężczyzna', passportNumber: '', checkInDate: '2024-01-01',
            comments: '',
        };

        const result = await addBokResident(data, 'coord-1');
        expect(result.id).toBeDefined();
        expect(result.id.length).toBeGreaterThan(0);
    });
});

// ─── 2. updateBokResident ─────────────────────────────────────────────────────

describe('updateBokResident', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetSettings.mockResolvedValue(mockSettings);
    });

    it('updates a BOK resident and saves the row', async () => {
        const row = makeRow({ id: 'bok-1', fullName: 'Old Name' });
        const bokSheet = { getRows: jest.fn().mockResolvedValue([row]), addRow: jest.fn() };
        const notifSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
        const auditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

        mockedGetSheet.mockImplementation((title: string) => {
            if (title === 'BOK') return Promise.resolve(bokSheet);
            if (title === 'Powiadomienia') return Promise.resolve(notifSheet);
            if (title === 'AuditLog') return Promise.resolve(auditSheet);
            return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
        });

        await updateBokResident('bok-1', { firstName: 'Nowe', lastName: 'Imie', fullName: 'Imie Nowe' }, 'coord-1');

        expect(row.set).toHaveBeenCalledWith('firstName', 'Nowe');
        expect(row.set).toHaveBeenCalledWith('lastName', 'Imie');
        expect(row.set).toHaveBeenCalledWith('fullName', 'Imie Nowe');
        expect(row.save).toHaveBeenCalledTimes(1);
    });

    it('throws when BOK resident is not found', async () => {
        const bokSheet = { getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() };
        mockedGetSheet.mockResolvedValue(bokSheet);

        await expect(updateBokResident('not-exist', { firstName: 'Test' }, 'coord-1'))
            .rejects.toThrow();
    });
});

// ─── 3. deleteBokResident ─────────────────────────────────────────────────────

describe('deleteBokResident', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetSettings.mockResolvedValue(mockSettings);
    });

    it('deletes the BOK resident row', async () => {
        const row = makeRow({ id: 'bok-1', fullName: 'Test User' });
        const bokSheet = { getRows: jest.fn().mockResolvedValue([row]), addRow: jest.fn() };
        mockedGetSheet.mockResolvedValue(bokSheet);

        await deleteBokResident('bok-1', 'coord-1');

        expect(row.delete).toHaveBeenCalledTimes(1);
    });
});
