/**
 * BOK-specific comprehensive tests
 * Covers: checkAndUpdateStatuses (dismissDate logic), addBokResident,
 * updateBokResident, deleteBokResident, handleRestoreBokResident logic,
 * and sub-tab filtering logic.
 *
 * These tests run as part of `npm run build` via jest typecheck.
 */

import {
    checkAndUpdateStatuses,
    addBokResident,
    updateBokResident,
    deleteBokResident,
} from '@/lib/actions';
import * as sheets from '@/lib/sheets';
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

// ─── 1. checkAndUpdateStatuses — BOK auto-dismiss via dismissDate ─────────────

describe('checkAndUpdateStatuses — BOK auto-dismiss via dismissDate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetSettings.mockResolvedValue(mockSettings);
        (sheets.getEmployees as jest.Mock).mockResolvedValue([]);
        (sheets.getNonEmployees as jest.Mock).mockResolvedValue([]);
        (sheets.getRawAddressHistory as jest.Mock).mockResolvedValue([]);
        (sheets.getNotifications as jest.Mock).mockResolvedValue([]);
    });

    function makeBokSheet(bokRows: ReturnType<typeof makeRow>[]) {
        const employeeSheet = { getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() };
        const nonEmployeeSheet = { getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() };
        const bokSheet = { getRows: jest.fn().mockResolvedValue(bokRows), addRow: jest.fn() };
        const notifSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
        const auditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

        mockedGetSheet.mockImplementation((title: string) => {
            if (title === 'Employees') return Promise.resolve(employeeSheet);
            if (title === 'NonEmployees') return Promise.resolve(nonEmployeeSheet);
            if (title === 'BokResidents') return Promise.resolve(bokSheet);
            if (title === 'Powiadomienia') return Promise.resolve(notifSheet);
            if (title === 'AuditLog') return Promise.resolve(auditSheet);
            return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
        });
    }

    it('dismisses a BOK resident whose dismissDate is in the past', async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 2);
        const pastDateStr = pastDate.toISOString().split('T')[0];

        const row = makeRow({ id: 'bok-1', status: 'active', fullName: 'Kowalski Jan', dismissDate: pastDateStr });
        makeBokSheet([row]);

        const result = await checkAndUpdateStatuses('system');

        expect(result.updated).toBe(1);
        expect(row.set).toHaveBeenCalledWith('status', 'dismissed');
        expect(row.save).toHaveBeenCalledTimes(1);
    });

    it('does NOT dismiss a BOK resident whose dismissDate is in the future', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 5);
        const futureDateStr = futureDate.toISOString().split('T')[0];

        const row = makeRow({ id: 'bok-2', status: 'active', dismissDate: futureDateStr });
        makeBokSheet([row]);

        const result = await checkAndUpdateStatuses('system');

        expect(result.updated).toBe(0);
        expect(row.set).not.toHaveBeenCalled();
    });

    it('does NOT dismiss a BOK resident when dismissDate is empty (even if checkOutDate is in the past)', async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 3);
        const pastDateStr = pastDate.toISOString().split('T')[0];

        // checkOutDate is in past but dismissDate is empty — should NOT be dismissed (new logic)
        const row = makeRow({ id: 'bok-3', status: 'active', checkOutDate: pastDateStr, dismissDate: '' });
        makeBokSheet([row]);

        const result = await checkAndUpdateStatuses('system');

        expect(result.updated).toBe(0);
        expect(row.set).not.toHaveBeenCalled();
    });

    it('skips a BOK resident that is already dismissed', async () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 2);
        const pastDateStr = pastDate.toISOString().split('T')[0];

        const row = makeRow({ id: 'bok-4', status: 'dismissed', dismissDate: pastDateStr });
        makeBokSheet([row]);

        const result = await checkAndUpdateStatuses('system');

        expect(result.updated).toBe(0);
        expect(row.set).not.toHaveBeenCalled();
    });

    it('handles legacy date format dd-MM-yyyy for dismissDate', async () => {
        const row = makeRow({ id: 'bok-5', status: 'active', fullName: 'Test Row', dismissDate: '01-01-2020 00:00' });
        makeBokSheet([row]);

        const result = await checkAndUpdateStatuses('system');

        // 01-01-2020 is in the past → should dismiss
        expect(result.updated).toBe(1);
        expect(row.set).toHaveBeenCalledWith('status', 'dismissed');
    });

    it('dismisses multiple BOK residents at once', async () => {
        const pastDateStr = new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0];

        const row1 = makeRow({ id: 'bok-6', status: 'active', fullName: 'A B', dismissDate: pastDateStr });
        const row2 = makeRow({ id: 'bok-7', status: 'active', fullName: 'C D', dismissDate: pastDateStr });
        makeBokSheet([row1, row2]);

        const result = await checkAndUpdateStatuses('system');

        expect(result.updated).toBe(2);
        expect(row1.set).toHaveBeenCalledWith('status', 'dismissed');
        expect(row2.set).toHaveBeenCalledWith('status', 'dismissed');
    });
});

// ─── 2. addBokResident ────────────────────────────────────────────────────────

describe('addBokResident', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetSettings.mockResolvedValue(mockSettings);
    });

    it('adds a BOK resident and calls addRow with correct fields including dismissDate', async () => {
        const mockAddRow = jest.fn().mockResolvedValue(undefined);
        const notifSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
        const auditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

        mockedGetSheet.mockImplementation((title: string) => {
            if (title === 'BokResidents') return Promise.resolve({ addRow: mockAddRow, getRows: jest.fn().mockResolvedValue([]) });
            if (title === 'Powiadomienia') return Promise.resolve(notifSheet);
            if (title === 'AuditLog') return Promise.resolve(auditSheet);
            return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
        });

        const data: Omit<BokResident, 'id'> = {
            firstName: 'Jan',
            lastName: 'Tester',
            fullName: 'Tester Jan',
            role: 'Kierowca',
            coordinatorId: 'coord-1',
            nationality: 'Polska',
            address: 'Testowa 1',
            roomNumber: '1',
            zaklad: 'IT',
            gender: 'Mężczyzna',
            checkInDate: '2024-01-01',
            checkOutDate: null,
            sendDate: null,
            dismissDate: null,
            returnStatus: '',
            status: 'active',
            comments: '',
        };

        await addBokResident(data, 'coord-1');

        expect(mockAddRow).toHaveBeenCalledTimes(1);
        const added = mockAddRow.mock.calls[0][0];
        expect(added.firstName).toBe('Jan');
        expect(added.lastName).toBe('Tester');
        expect(added.status).toBe('active');
        expect(added.dismissDate).toBe('');  // null → serialized as empty string
    });

    it('generates an id for the new BOK resident', async () => {
        const mockAddRow = jest.fn().mockResolvedValue(undefined);
        mockedGetSheet.mockResolvedValue({ addRow: mockAddRow, getRows: jest.fn().mockResolvedValue([]) });

        const data: Omit<BokResident, 'id'> = {
            firstName: 'X', lastName: 'Y', fullName: 'Y X', role: 'Kierowca',
            coordinatorId: 'coord-1', nationality: 'Polska', address: '', roomNumber: '',
            zaklad: '', gender: 'Mężczyzna', checkInDate: '2024-01-01',
            checkOutDate: null, sendDate: null, dismissDate: null,
            returnStatus: '', status: 'active', comments: '',
        };

        const result = await addBokResident(data, 'coord-1');
        expect(result.id).toBeDefined();
        expect(result.id.length).toBeGreaterThan(0);
    });
});

// ─── 3. updateBokResident ─────────────────────────────────────────────────────

describe('updateBokResident', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetSettings.mockResolvedValue(mockSettings);
    });

    it('sets status to dismissed and dismissDate when updating a BOK resident', async () => {
        const row = makeRow({ id: 'bok-1', status: 'active', dismissDate: '', fullName: 'Old Name' });
        const bokSheet = { getRows: jest.fn().mockResolvedValue([row]), addRow: jest.fn() };
        const notifSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
        const auditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

        mockedGetSheet.mockImplementation((title: string) => {
            if (title === 'BokResidents') return Promise.resolve(bokSheet);
            if (title === 'Powiadomienia') return Promise.resolve(notifSheet);
            if (title === 'AuditLog') return Promise.resolve(auditSheet);
            return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
        });

        await updateBokResident('bok-1', { status: 'dismissed', dismissDate: '2026-03-01' }, 'coord-1');

        expect(row.set).toHaveBeenCalledWith('status', 'dismissed');
        expect(row.set).toHaveBeenCalledWith('dismissDate', '2026-03-01');
        expect(row.save).toHaveBeenCalledTimes(1);
    });

    it('clears dismissDate and checkOutDate when restoring a BOK resident (status=active)', async () => {
        const row = makeRow({ id: 'bok-2', status: 'dismissed', dismissDate: '2026-01-01', checkOutDate: '2026-02-01', fullName: 'Test' });
        const bokSheet = { getRows: jest.fn().mockResolvedValue([row]), addRow: jest.fn() };
        const notifSheet = { addRow: jest.fn().mockResolvedValue(undefined) };
        const auditSheet = { addRow: jest.fn().mockResolvedValue(undefined) };

        mockedGetSheet.mockImplementation((title: string) => {
            if (title === 'BokResidents') return Promise.resolve(bokSheet);
            if (title === 'Powiadomienia') return Promise.resolve(notifSheet);
            if (title === 'AuditLog') return Promise.resolve(auditSheet);
            return Promise.resolve({ getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() });
        });

        await updateBokResident('bok-2', { status: 'active', dismissDate: null, checkOutDate: null }, 'coord-1');

        expect(row.set).toHaveBeenCalledWith('status', 'active');
        expect(row.set).toHaveBeenCalledWith('dismissDate', '');
        expect(row.set).toHaveBeenCalledWith('checkOutDate', '');
        expect(row.save).toHaveBeenCalledTimes(1);
    });

    it('throws when BOK resident is not found', async () => {
        const bokSheet = { getRows: jest.fn().mockResolvedValue([]), addRow: jest.fn() };
        mockedGetSheet.mockResolvedValue(bokSheet);

        await expect(updateBokResident('not-exist', { status: 'active' }, 'coord-1'))
            .rejects.toThrow();
    });
});

// ─── 4. deleteBokResident ─────────────────────────────────────────────────────

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

// ─── 5. Sub-tab filtering logic (pure JS) ────────────────────────────────────

describe('BOK sub-tab filtering logic', () => {
    const makeResident = (overrides: Partial<BokResident>): BokResident => ({
        id: 'r1',
        firstName: 'Jan',
        lastName: 'Test',
        fullName: 'Test Jan',
        role: 'Kierowca',
        coordinatorId: 'coord-1',
        nationality: 'Polska',
        address: '',
        roomNumber: '',
        zaklad: '',
        gender: 'Mężczyzna',
        checkInDate: '2024-01-01',
        checkOutDate: null,
        sendDate: null,
        dismissDate: null,
        returnStatus: '',
        status: 'active',
        comments: '',
        ...overrides,
    });

    // Replicate the filtering logic from entity-view.tsx
    const isAktywny = (r: BokResident) =>
        r.status !== 'dismissed' && !r.dismissDate && !r.checkOutDate;

    const isWyslany = (r: BokResident) =>
        r.status !== 'dismissed' && !r.dismissDate && !!r.checkOutDate;

    const isZwolniony = (r: BokResident) =>
        r.status === 'dismissed' || !!r.dismissDate;

    it('active resident with no dates → Aktywni', () => {
        const r = makeResident({});
        expect(isAktywny(r)).toBe(true);
        expect(isWyslany(r)).toBe(false);
        expect(isZwolniony(r)).toBe(false);
    });

    it('resident with checkOutDate and status active → Wyslani', () => {
        const r = makeResident({ checkOutDate: '2026-02-01' });
        expect(isAktywny(r)).toBe(false);
        expect(isWyslany(r)).toBe(true);
        expect(isZwolniony(r)).toBe(false);
    });

    it('resident with checkOutDate AND dismissDate → Zwolnieni (not Wyslani)', () => {
        const r = makeResident({ checkOutDate: '2026-02-01', dismissDate: '2026-03-01' });
        expect(isAktywny(r)).toBe(false);
        expect(isWyslany(r)).toBe(false);
        expect(isZwolniony(r)).toBe(true);
    });

    it('resident with status=dismissed → Zwolnieni', () => {
        const r = makeResident({ status: 'dismissed' });
        expect(isAktywny(r)).toBe(false);
        expect(isWyslany(r)).toBe(false);
        expect(isZwolniony(r)).toBe(true);
    });

    it('resident with dismissDate set (past date) → Zwolnieni', () => {
        const r = makeResident({ dismissDate: '2026-01-01' });
        expect(isAktywny(r)).toBe(false);
        expect(isWyslany(r)).toBe(false);
        expect(isZwolniony(r)).toBe(true);
    });

    it('dismissed resident with checkOutDate → Zwolnieni (not Wyslani)', () => {
        const r = makeResident({ status: 'dismissed', checkOutDate: '2026-02-01' });
        expect(isWyslany(r)).toBe(false);
        expect(isZwolniony(r)).toBe(true);
    });

    it('each resident appears in exactly ONE sub-tab', () => {
        const residents = [
            makeResident({}),
            makeResident({ checkOutDate: '2026-02-01' }),
            makeResident({ dismissDate: '2026-01-01' }),
            makeResident({ status: 'dismissed' }),
            makeResident({ checkOutDate: '2026-02-01', dismissDate: '2026-03-01' }),
        ];

        for (const r of residents) {
            const tabs = [isAktywny(r), isWyslany(r), isZwolniony(r)];
            const trueCount = tabs.filter(Boolean).length;
            expect(trueCount).toBe(1);
        }
    });
});
