/**
 * Testy jednostkowe dla brakujących server actions:
 * - updateControlCardCommentStatusAction
 * - deleteControlCardAction
 * - saveStartListAction
 * - setAddressNoMetersRequiredAction
 * - generateDeductionsReport
 * - acknowledgeCandidateDemandAction
 * - retryCandidateDemandsAction
 * - addOdbiorZakwaterowanieAction
 */

import {
    updateControlCardCommentStatusAction,
    deleteControlCardAction,
    saveStartListAction,
    setAddressNoMetersRequiredAction,
    generateDeductionsReport,
    acknowledgeCandidateDemandAction,
    retryCandidateDemandsAction,
    addOdbiorZakwaterowanieAction,
} from '@/lib/actions';
import * as sheets from '@/lib/sheets';
import type { StartList } from '@/types';

// firebase-admin and auth are mocked globally in jest.setup.mjs

// Mock next/cache
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

// Mock the entire sheets module
jest.mock('@/lib/sheets', () => ({
    ...jest.requireActual('@/lib/sheets'),
    getSheet: jest.fn(),
    getSettings: jest.fn(),
    getControlCards: jest.fn(),
    updateControlCard: jest.fn(),
    getStartLists: jest.fn(),
    upsertStartList: jest.fn(),
    getOdbiorEntries: jest.fn(),
    addOdbiorEntry: jest.fn(),
    updateOdbiorEntry: jest.fn(),
    addBokResident: jest.fn(),
    getBokResidents: jest.fn(),
    addCandidate: jest.fn(),
    updateCandidate: jest.fn(),
    getCandidates: jest.fn(),
    getCandidateDemands: jest.fn(),
    updateCandidateDemand: jest.fn(),
    invalidateOdbiorEntriesCache: jest.fn(),
    invalidateBokResidentsCache: jest.fn(),
    invalidateCandidatesCache: jest.fn(),
    invalidateSettingsCache: jest.fn(),
    withTimeout: jest.fn().mockImplementation((p) => p),
    getEmployees: jest.fn(),
    getNonEmployees: jest.fn(),
    appendInterviewResult: jest.fn(),
}));

const mockedGetSheet = sheets.getSheet as jest.Mock;
const mockedGetControlCards = sheets.getControlCards as jest.Mock;
const mockedUpdateControlCard = sheets.updateControlCard as jest.Mock;
const mockedGetSettings = sheets.getSettings as jest.Mock;
const mockedGetCandidateDemands = sheets.getCandidateDemands as jest.Mock;
const mockedUpdateCandidateDemand = sheets.updateCandidateDemand as jest.Mock;
const mockedGetEmployees = sheets.getEmployees as jest.Mock;
const mockedGetNonEmployees = sheets.getNonEmployees as jest.Mock;

// Utility mock sheet factories
const makeSheet = (rows: unknown[] = [], extra = {}) => ({
    getRows: jest.fn().mockResolvedValue(rows),
    addRow: jest.fn().mockResolvedValue(undefined),
    addRows: jest.fn().mockResolvedValue(undefined),
    ...extra,
});

const mockSettings = {
    id: 'global-settings',
    coordinators: [
        { uid: 'coord-1', name: 'Jan Kowalski', isAdmin: true, isDriver: false, departments: [], pushSubscription: 'token-1' },
    ],
    localities: ['Warszawa'],
    departments: ['IT'],
    nationalities: ['Polska'],
    genders: ['Mężczyzna'],
    addresses: [],
    paymentTypesNZ: [],
    statuses: [],
    bokRoles: [],
    bokReturnOptions: [],
    bokStatuses: [],
};

const mockCard = {
    id: 'card-1',
    addressId: 'addr-1',
    addressName: 'Test Address',
    coordinatorId: 'coord-1',
    coordinatorName: 'Jan Kowalski',
    controlMonth: '2024-03',
    fillDate: '2024-03-28',
    roomRatings: [
        { roomId: 'room-1', roomName: 'Room 1', rating: 8, comment: 'Clean', photoUrls: [], status: 'Nie przyjęte' }
    ],
    cleanKitchen: 9,
    cleanBathroom: 7,
    kitchenPhotoUrls: [],
    bathroomPhotoUrls: [],
    appliancesWorking: true,
    comments: [
        { id: 'comm-1', text: 'Problem z grzejnikiem', status: 'Nie przyjęte', createdAt: '2024-03-28', createdBy: 'coord-1' }
    ],
    changeLog: [],
};

beforeEach(() => {
    jest.clearAllMocks();
    mockedGetSettings.mockResolvedValue(mockSettings);
    mockedGetEmployees.mockResolvedValue([]);
    mockedGetNonEmployees.mockResolvedValue([]);
    mockedGetSheet.mockResolvedValue(makeSheet());
    mockedGetControlCards.mockResolvedValue([mockCard]);
    mockedUpdateControlCard.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────
// updateControlCardCommentStatusAction
// ─────────────────────────────────────────────────────────────────────────

describe('updateControlCardCommentStatusAction', () => {
    it('updates general comment status and appends to changeLog', async () => {
        const result = await updateControlCardCommentStatusAction('card-1', 'comm-1', 'Temat rozwiązany');

        expect(result.success).toBe(true);
        expect(mockedUpdateControlCard).toHaveBeenCalledWith(
            'card-1',
            expect.objectContaining({
                comments: expect.arrayContaining([
                    expect.objectContaining({ id: 'comm-1', status: 'Temat rozwiązany' }),
                ]),
                changeLog: expect.arrayContaining([
                    expect.objectContaining({
                        changes: expect.stringContaining('Status komentarza'),
                    }),
                ]),
            })
        );
    });

    it('updates room rating status when commentId matches a roomId', async () => {
        const result = await updateControlCardCommentStatusAction('card-1', 'room-1', 'Temat rozwiązany');

        expect(result.success).toBe(true);
        expect(mockedUpdateControlCard).toHaveBeenCalledWith(
            'card-1',
            expect.objectContaining({
                roomRatings: expect.arrayContaining([
                    expect.objectContaining({ roomId: 'room-1', status: 'Temat rozwiązany' }),
                ]),
            })
        );
    });

    it('returns error when card not found', async () => {
        mockedGetControlCards.mockResolvedValue([]);

        const result = await updateControlCardCommentStatusAction('nonexistent', 'comm-1', 'Temat rozwiązany');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Control card not found');
    });

    it('returns error when comment not found in card or roomRatings', async () => {
        const result = await updateControlCardCommentStatusAction('card-1', 'nonexistent-comment', 'Temat rozwiązany');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Comment not found');
    });

    it('returns error on sheet failure', async () => {
        mockedUpdateControlCard.mockRejectedValue(new Error('Sheet write error'));

        const result = await updateControlCardCommentStatusAction('card-1', 'comm-1', 'Temat rozwiązany');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Sheet write error');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// deleteControlCardAction
// ─────────────────────────────────────────────────────────────────────────

describe('deleteControlCardAction', () => {
    it('soft-deletes control card by setting deleted: true', async () => {
        const result = await deleteControlCardAction('card-1');

        expect(result.success).toBe(true);
        expect(mockedUpdateControlCard).toHaveBeenCalledWith('card-1', { deleted: true });
    });

    it('returns error on sheet failure', async () => {
        mockedUpdateControlCard.mockRejectedValue(new Error('Sheet error'));

        const result = await deleteControlCardAction('card-1');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Sheet error');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// saveStartListAction
// ─────────────────────────────────────────────────────────────────────────

describe('saveStartListAction', () => {
    beforeEach(() => {
        (sheets.upsertStartList as jest.Mock).mockResolvedValue(undefined);
    });

    it('saves start list data with updatedAt timestamp', async () => {
        const data = {
            addressId: 'addr-1',
            addressName: 'Test Address',
            notes: 'Test notes',
        } as unknown as Omit<StartList, 'updatedAt'>;

        const result = await saveStartListAction(data);

        expect(result.success).toBe(true);
        expect(sheets.upsertStartList).toHaveBeenCalledWith(
            expect.objectContaining({
                addressId: 'addr-1',
                updatedAt: expect.any(String),
            })
        );
    });

    it('returns error when upsert throws', async () => {
        (sheets.upsertStartList as jest.Mock).mockRejectedValue(new Error('Upsert failed'));

        const result = await saveStartListAction({
            addressId: 'addr-1',
            addressName: 'Test',
        } as unknown as Omit<StartList, 'updatedAt'>);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Upsert failed');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// setAddressNoMetersRequiredAction
// ─────────────────────────────────────────────────────────────────────────

describe('setAddressNoMetersRequiredAction', () => {
    it('sets noMetersRequired = TRUE for existing address', async () => {
        const mockRow = {
            get: (key: string) => (key === 'id' ? 'addr-1' : ''),
            set: jest.fn(),
            save: jest.fn().mockResolvedValue(undefined),
        };
        mockedGetSheet.mockResolvedValue(makeSheet([mockRow]));

        const result = await setAddressNoMetersRequiredAction('addr-1', true);

        expect(result.success).toBe(true);
        expect(mockRow.set).toHaveBeenCalledWith('noMetersRequired', 'TRUE');
        expect(mockRow.save).toHaveBeenCalledTimes(1);
    });

    it('sets noMetersRequired = FALSE', async () => {
        const mockRow = {
            get: (key: string) => (key === 'id' ? 'addr-1' : ''),
            set: jest.fn(),
            save: jest.fn().mockResolvedValue(undefined),
        };
        mockedGetSheet.mockResolvedValue(makeSheet([mockRow]));

        const result = await setAddressNoMetersRequiredAction('addr-1', false);

        expect(result.success).toBe(true);
        expect(mockRow.set).toHaveBeenCalledWith('noMetersRequired', 'FALSE');
    });

    it('returns error when address not found', async () => {
        mockedGetSheet.mockResolvedValue(makeSheet([]));

        const result = await setAddressNoMetersRequiredAction('nonexistent', true);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Nie znaleziono adresu');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// generateDeductionsReport
// ─────────────────────────────────────────────────────────────────────────

describe('generateDeductionsReport', () => {
    const mockEmployees = [
        {
            id: 'emp-1',
            firstName: 'Adam',
            lastName: 'Kowalski',
            fullName: 'Kowalski Adam',
            coordinatorId: 'coord-1',
            status: 'dismissed',
            checkInDate: '2024-01-01',
            checkOutDate: '2024-01-31',
            zaklad: 'IT',
            nationality: 'Polska',
            gender: 'Mężczyzna',
            address: 'Testowa 1',
            roomNumber: '1',
            depositReturned: 'Tak',
            depositReturnAmount: 500,
            deductionNo30Days: true,
            deductionNo4Months: null,
            deductionRegulation: null,
            deductionReason: [{ id: 'reason-0', label: 'Uszkodzenie mebla', amount: 200, checked: true }],
            deductionEntryDate: '2024-01-31',
            contractStartDate: null,
            contractEndDate: null,
        },
    ];

    it('generates deductions report successfully', async () => {
        mockedGetEmployees.mockResolvedValue(mockEmployees);

        const result = await generateDeductionsReport(2024, 1, 'all');

        expect(result.success).toBe(true);
        expect(result.fileContent).toBeDefined();
        expect(result.fileName).toContain('Raport_Potracen');
    });

    it('filters by coordinator when coordinatorId is provided', async () => {
        mockedGetEmployees.mockResolvedValue(mockEmployees);

        const result = await generateDeductionsReport(2024, 1, 'coord-1');

        expect(result.success).toBe(true);
        expect(result.fileContent).toBeDefined();
    });

    it('returns empty report when no employees have deductions', async () => {
        mockedGetEmployees.mockResolvedValue([{
            ...mockEmployees[0],
            deductionNo30Days: null,
            deductionNo4Months: null,
            deductionRegulation: null,
            deductionReason: [],
        }]);

        const result = await generateDeductionsReport(2024, 1, 'all');

        expect(result.success).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// acknowledgeCandidateDemandAction
// ─────────────────────────────────────────────────────────────────────────

describe('acknowledgeCandidateDemandAction', () => {
    it('acknowledges demand with ackBy user id', async () => {
        mockedUpdateCandidateDemand.mockResolvedValue(undefined);

        const result = await acknowledgeCandidateDemandAction('demand-1', 'coord-1');

        expect(result.success).toBe(true);
        expect(mockedUpdateCandidateDemand).toHaveBeenCalledWith('demand-1', expect.objectContaining({
            status: 'acknowledged',
            acknowledgedBy: 'coord-1',
            acknowledgedAt: expect.any(String),
        }));
    });

    it('falls back to session uid when ackBy is not provided', async () => {
        mockedUpdateCandidateDemand.mockResolvedValue(undefined);

        const result = await acknowledgeCandidateDemandAction('demand-1');

        expect(result.success).toBe(true);
        // session from jest.setup.mjs mocks uid as 'test-user-id'
        expect(mockedUpdateCandidateDemand).toHaveBeenCalledWith('demand-1', expect.objectContaining({
            status: 'acknowledged',
        }));
    });

    it('returns error on sheet failure', async () => {
        mockedUpdateCandidateDemand.mockRejectedValue(new Error('Sheet error'));

        const result = await acknowledgeCandidateDemandAction('demand-1', 'coord-1');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Sheet error');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// retryCandidateDemandsAction
// ─────────────────────────────────────────────────────────────────────────

describe('retryCandidateDemandsAction', () => {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();

    const pendingDemand = {
        id: 'demand-1',
        status: 'pending' as const,
        requestedAt: sixMinutesAgo,
        acknowledgedAt: null,
        retryCount: 0,
        candidateFirstName: 'Jan',
        candidateLastName: 'Kowalski',
        candidateId: 'cand-1',
    };

    it('retries old pending demands and increments retryCount', async () => {
        mockedGetCandidateDemands.mockResolvedValue([pendingDemand]);
        mockedUpdateCandidateDemand.mockResolvedValue(undefined);

        const result = await retryCandidateDemandsAction();

        expect(result.success).toBe(true);
        expect(result.retried).toBe(1);
        expect(mockedUpdateCandidateDemand).toHaveBeenCalledWith('demand-1', expect.objectContaining({
            retryCount: 1,
        }));
    });

    it('skips demands that are too recent (< 5 minutes old)', async () => {
        mockedGetCandidateDemands.mockResolvedValue([
            { ...pendingDemand, requestedAt: oneMinuteAgo },
        ]);
        mockedUpdateCandidateDemand.mockResolvedValue(undefined);

        const result = await retryCandidateDemandsAction();

        expect(result.success).toBe(true);
        expect(result.retried).toBe(0);
    });

    it('expires demands that have been retried 3+ times', async () => {
        mockedGetCandidateDemands.mockResolvedValue([
            { ...pendingDemand, retryCount: 3 },
        ]);
        mockedUpdateCandidateDemand.mockResolvedValue(undefined);

        const result = await retryCandidateDemandsAction();

        expect(result.success).toBe(true);
        expect(result.retried).toBe(0);
        expect(mockedUpdateCandidateDemand).toHaveBeenCalledWith('demand-1', { status: 'expired' });
    });

    it('skips non-pending demands', async () => {
        mockedGetCandidateDemands.mockResolvedValue([
            { ...pendingDemand, status: 'acknowledged' as const },
        ]);

        const result = await retryCandidateDemandsAction();

        expect(result.success).toBe(true);
        expect(result.retried).toBe(0);
    });

    it('returns error on sheet failure', async () => {
        mockedGetCandidateDemands.mockRejectedValue(new Error('DB error'));

        const result = await retryCandidateDemandsAction();

        expect(result.success).toBe(false);
        expect(result.error).toBe('DB error');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// addOdbiorZakwaterowanieAction
// ─────────────────────────────────────────────────────────────────────────

describe('addOdbiorZakwaterowanieAction', () => {
    const baseInput = {
        type: 'zakwaterowanie' as const,
        firstName: 'Juan',
        lastName: 'Carlos',
        nationality: 'Polska',
        gender: 'Mężczyzna',
        passportNumber: 'EP123456',
        addressId: 'addr-1',
        addressName: 'Chopina 11a',
        roomNumber: '101',
        date: '2024-04-28',
        createdBy: 'Admin',
        createdById: 'admin-1',
    };

    beforeEach(() => {
        (sheets.addOdbiorEntry as jest.Mock).mockResolvedValue(undefined);
        (sheets.addCandidate as jest.Mock).mockResolvedValue(undefined);
        mockedGetSheet.mockImplementation((title: string) => {
            if (title === 'BOK') return Promise.resolve(makeSheet([], { addRow: jest.fn().mockResolvedValue({ get: (k: string) => k === 'id' ? 'bok-new' : '' }) }));
            return Promise.resolve(makeSheet());
        });
    });

    it('returns error when firstName is missing', async () => {
        const result = await addOdbiorZakwaterowanieAction({
            ...baseInput,
            firstName: '',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Imię i nazwisko są wymagane.');
    });

    it('returns error when lastName is missing', async () => {
        const result = await addOdbiorZakwaterowanieAction({
            ...baseInput,
            lastName: '',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Imię i nazwisko są wymagane.');
    });

    it('creates BOK resident and OdbiorEntry with status przekonwertowany', async () => {
        const result = await addOdbiorZakwaterowanieAction(baseInput);

        expect(result.success).toBe(true);
        expect(sheets.addOdbiorEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'przekonwertowany',
                firstName: 'Juan',
                lastName: 'Carlos',
            })
        );
    });
});
