/**
 * @jest-environment node
 */
/**
 * @jest-environment node
 */
// Testy dla API routes: alerts/mine, employees/stats, start-lists, data-guard, alerts, control-cards, verify-passport
import { GET as GetAlertsMine } from '../alerts/mine/route';
import { GET as GetEmployeeStats } from '../employees/stats/route';
import { GET as GetStartLists } from '../start-lists/route';
import { GET as GetDataGuard, POST as PostDataGuard } from '../data-guard/route';
import { POST as PostAlerts } from '../alerts/route';
import { GET as GetControlCards } from '../control-cards/route';
import { POST as PostVerifyPassport } from '../verify-passport/route';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEmployees, getNonEmployees, getBokResidents, getSettings, getStartLists, getControlCards } from '@/lib/sheets';

jest.mock('@/lib/sheets', () => ({
    getEmployees: jest.fn(),
    getNonEmployees: jest.fn(),
    getBokResidents: jest.fn(),
    getSettings: jest.fn(),
    getStartLists: jest.fn(),
    getControlCards: jest.fn(),
}));

jest.mock('@/lib/alert-utils', () => ({
    alertToday: jest.fn().mockReturnValue(new Date('2024-06-01')),
    parseAlertDate: jest.fn().mockImplementation((val: string) => (val ? new Date(val) : null)),
    daysDiff: jest.fn().mockImplementation((a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))),
    extractAlertDetails: jest.fn().mockReturnValue({
        contractExpiry: [],
        capacityExceeded: [],
        missingPaymentData: [],
        duplicatePersons: [],
    }),
}));

jest.mock('@/lib/actions', () => ({
    sendPushNotification: jest.fn().mockResolvedValue({ success: true }),
    checkAndUpdateStatuses: jest.fn().mockResolvedValue({ updated: 0 }),
}));

// Mock google-spreadsheet for data-guard
jest.mock('google-spreadsheet', () => {
    const mockRows = [
        {
            get: (key: string) => {
                if (key === 'sheetName') return 'Employees';
                if (key === 'rowCount') return '10';
                if (key === 'checkedAt') return new Date().toISOString();
                return '';
            },
            set: jest.fn(),
            save: jest.fn().mockResolvedValue(undefined),
        },
    ];
    const mockSnapshotSheet = {
        getRows: jest.fn().mockResolvedValue(mockRows),
        addRow: jest.fn().mockResolvedValue(undefined),
        loadHeaderRow: jest.fn().mockResolvedValue(undefined),
    };
    const mockDataSheet = {
        getRows: jest.fn().mockResolvedValue(Array(10).fill({})),
    };
    class GoogleSpreadsheet {
        loadInfo = jest.fn().mockResolvedValue(undefined);
        sheetsByTitle: Record<string, typeof mockSnapshotSheet | typeof mockDataSheet> = {
            DataGuardSnapshots: mockSnapshotSheet,
            Employees: mockDataSheet,
            NonEmployees: { getRows: jest.fn().mockResolvedValue(Array(5).fill({})) },
            BOK: { getRows: jest.fn().mockResolvedValue(Array(3).fill({})) },
            Addresses: { getRows: jest.fn().mockResolvedValue(Array(2).fill({})) },
            Rooms: { getRows: jest.fn().mockResolvedValue(Array(8).fill({})) },
            AddressHistory: { getRows: jest.fn().mockResolvedValue(Array(20).fill({})) },
            ControlCards: { getRows: jest.fn().mockResolvedValue(Array(5).fill({})) },
            Coordinators: { getRows: jest.fn().mockResolvedValue(Array(3).fill({})) },
        };
        addSheet = jest.fn().mockResolvedValue(mockSnapshotSheet);
    }
    return { GoogleSpreadsheet };
});

jest.mock('google-auth-library', () => ({
    JWT: jest.fn().mockImplementation(() => ({})),
}));

const mockedGetEmployees = getEmployees as jest.Mock;
const mockedGetNonEmployees = getNonEmployees as jest.Mock;
const mockedGetBokResidents = getBokResidents as jest.Mock;
const mockedGetSettings = getSettings as jest.Mock;
const mockedGetStartLists = getStartLists as jest.Mock;
const mockedGetControlCards = getControlCards as jest.Mock;

const adminSession = { isLoggedIn: true, uid: 'coord-1', name: 'Admin', isAdmin: true, isDriver: false };
const regularSession = { isLoggedIn: true, uid: 'coord-1', name: 'Koordynator', isAdmin: false, isDriver: false };

const mockSettings = {
    coordinators: [
        { uid: 'coord-1', name: 'Admin', isAdmin: true, pushSubscription: 'token-1' },
    ],
    addresses: [],
};

const CRON_SECRET = 'test-secret';

const makeCronRequest = (method: string, secret?: string) =>
    new NextRequest(`http://localhost/api/data-guard`, {
        method,
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    });

beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'test@example.com';
    process.env.GOOGLE_PRIVATE_KEY = 'test-key';
    mockedGetSettings.mockResolvedValue(mockSettings);
    mockedGetEmployees.mockResolvedValue([]);
    mockedGetNonEmployees.mockResolvedValue([]);
    mockedGetBokResidents.mockResolvedValue([]);
    mockedGetStartLists.mockResolvedValue([]);
    mockedGetControlCards.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/alerts/mine
// ─────────────────────────────────────────────────────────────────────────

describe('GET /api/alerts/mine', () => {
    it('returns 401 when not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });

        const res = await GetAlertsMine();
        expect(res.status).toBe(401);
    });

    it('returns filtered alerts for the logged-in coordinator', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);

        const res = await GetAlertsMine();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('checkedAt');
        expect(body).toHaveProperty('details');
        expect(body.details).toHaveProperty('contractExpiry');
        expect(body.details).toHaveProperty('capacityExceeded');
    });

    it('returns 500 on internal error', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);
        mockedGetEmployees.mockRejectedValue(new Error('Sheet error'));

        const res = await GetAlertsMine();
        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/employees/stats
// ─────────────────────────────────────────────────────────────────────────

describe('GET /api/employees/stats', () => {
    it('returns 401 when not authenticated or not admin', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });

        const res = await GetEmployeeStats();
        expect(res.status).toBe(401);
    });

    it('returns 401 for non-admin users', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);

        const res = await GetEmployeeStats();
        expect(res.status).toBe(401);
    });

    it('returns correct employee counts for admin', async () => {
        (getSession as jest.Mock).mockResolvedValue(adminSession);
        mockedGetEmployees.mockResolvedValue([
            { id: 'emp-1', status: 'active' },
            { id: 'emp-2', status: 'active' },
            { id: 'emp-3', status: 'dismissed' },
        ]);

        const res = await GetEmployeeStats();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.active).toBe(2);
        expect(body.dismissed).toBe(1);
        expect(body.total).toBe(3);
    });

    it('returns 500 on internal error', async () => {
        (getSession as jest.Mock).mockResolvedValue(adminSession);
        mockedGetEmployees.mockRejectedValue(new Error('Sheet error'));

        const res = await GetEmployeeStats();
        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/start-lists
// ─────────────────────────────────────────────────────────────────────────

describe('GET /api/start-lists', () => {
    it('returns 401 when not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });

        const res = await GetStartLists();
        expect(res.status).toBe(401);
    });

    it('returns start lists for authenticated user', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);
        mockedGetStartLists.mockResolvedValue([
            { addressId: 'addr-1', addressName: 'Test', rooms: [], notes: '', noMetersRequired: false, updatedAt: '' },
        ]);

        const res = await GetStartLists();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(1);
        expect(body[0].addressId).toBe('addr-1');
    });

    it('returns 500 on internal error', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);
        mockedGetStartLists.mockRejectedValue(new Error('Sheet error'));

        const res = await GetStartLists();
        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// GET + POST /api/data-guard (CRON protected)
// ─────────────────────────────────────────────────────────────────────────

describe('POST /api/data-guard', () => {
    it('returns 401 without Authorization header', async () => {
        const res = await PostDataGuard(makeCronRequest('POST'));
        expect(res.status).toBe(401);
    });

    it('returns 401 with wrong CRON_SECRET', async () => {
        const res = await PostDataGuard(makeCronRequest('POST', 'wrong-secret'));
        expect(res.status).toBe(401);
    });

    it('runs data guard check and returns ok=true with correct secret', async () => {
        const res = await PostDataGuard(makeCronRequest('POST', CRON_SECRET));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body).toHaveProperty('checkedAt');
        expect(body).toHaveProperty('sheets');
        expect(body).toHaveProperty('anomalies');
    });
});

describe('GET /api/data-guard', () => {
    it('returns 401 without Authorization header', async () => {
        const res = await GetDataGuard(makeCronRequest('GET'));
        expect(res.status).toBe(401);
    });

    it('returns snapshot data with correct secret', async () => {
        const res = await GetDataGuard(makeCronRequest('GET', CRON_SECRET));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('snapshot');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/alerts (CRON protected)
// ─────────────────────────────────────────────────────────────────────────

describe('POST /api/alerts', () => {
    it('returns 401 without Authorization header', async () => {
        const res = await PostAlerts(makeCronRequest('POST'));
        expect(res.status).toBe(401);
    });

    it('returns 401 with wrong CRON_SECRET', async () => {
        const res = await PostAlerts(makeCronRequest('POST', 'wrong-secret'));
        expect(res.status).toBe(401);
    });

    it('runs alert check and returns summary with correct secret', async () => {
        mockedGetEmployees.mockResolvedValue([
            { id: 'e1', fullName: 'Jan Kowalski', status: 'active', coordinatorId: 'coord-1', contractEndDate: '2099-12-31' },
        ]);
        mockedGetNonEmployees.mockResolvedValue([]);
        mockedGetBokResidents.mockResolvedValue([]);
        mockedGetSettings.mockResolvedValue({
            ...mockSettings,
            addresses: [{ id: 'a1', name: 'Test', coordinatorIds: ['coord-1'], rooms: [{ id: 'r1', name: '101', capacity: 2, isActive: true }] }],
        });

        const res = await PostAlerts(makeCronRequest('POST', CRON_SECRET));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body).toHaveProperty('checkedAt');
        expect(body).toHaveProperty('summary');
        expect(body).toHaveProperty('details');
        expect(body.summary).toHaveProperty('contractExpiry');
        expect(body.summary).toHaveProperty('capacityExceeded');
        expect(body.summary).toHaveProperty('missingPaymentData');
        expect(body.summary).toHaveProperty('duplicatePersons');
    });

    it('returns 500 on internal error', async () => {
        mockedGetEmployees.mockRejectedValue(new Error('Sheet error'));
        const res = await PostAlerts(makeCronRequest('POST', CRON_SECRET));
        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// GET /api/control-cards
// ─────────────────────────────────────────────────────────────────────────

describe('GET /api/control-cards', () => {
    it('returns 401 when not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });
        const res = await GetControlCards();
        expect(res.status).toBe(401);
    });

    it('returns control cards for authenticated user', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);
        mockedGetControlCards.mockResolvedValue([
            { id: 'c1', employeeId: 'e1', date: '2024-01-01', meters: true },
        ]);

        const res = await GetControlCards();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(1);
        expect(body[0].id).toBe('c1');
    });

    it('returns 500 on internal error', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);
        mockedGetControlCards.mockRejectedValue(new Error('Sheet error'));

        const res = await GetControlCards();
        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// POST /api/verify-passport
// ─────────────────────────────────────────────────────────────────────────

describe('POST /api/verify-passport', () => {
    it('returns 401 when not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });
        const req = new NextRequest('http://localhost/api/verify-passport', {
            method: 'POST',
            body: JSON.stringify({ input: 'test', type: 'quick' }),
        });
        const res = await PostVerifyPassport(req);
        expect(res.status).toBe(401);
    });

    it('returns 400 when body is missing required fields', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);
        const req = new NextRequest('http://localhost/api/verify-passport', {
            method: 'POST',
            body: JSON.stringify({ input: 'test' }),
        });
        const res = await PostVerifyPassport(req);
        expect(res.status).toBe(400);
    });

    it('returns valid=true when hash matches quick secret', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);
        process.env.PASSPORT_HASH_QUICK = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
        const req = new NextRequest('http://localhost/api/verify-passport', {
            method: 'POST',
            body: JSON.stringify({ input: '123', type: 'quick' }),
        });
        const res = await PostVerifyPassport(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.valid).toBe(true);
    });

    it('returns valid=false when hash does not match', async () => {
        (getSession as jest.Mock).mockResolvedValue(regularSession);
        process.env.PASSPORT_HASH_QUICK = 'wrong-hash';
        const req = new NextRequest('http://localhost/api/verify-passport', {
            method: 'POST',
            body: JSON.stringify({ input: '123', type: 'quick' }),
        });
        const res = await PostVerifyPassport(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.valid).toBe(false);
    });
});
