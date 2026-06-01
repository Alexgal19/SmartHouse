/**
 * @jest-environment node
 */
// Testy dla API routes: alerts/mine, employees/stats, start-lists, data-guard
import { GET as GetAlertsMine } from '../alerts/mine/route';
import { GET as GetEmployeeStats } from '../employees/stats/route';
import { GET as GetStartLists } from '../start-lists/route';
import { GET as GetDataGuard, POST as PostDataGuard } from '../data-guard/route';
import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEmployees, getNonEmployees, getBokResidents, getSettings, getStartLists } from '@/lib/sheets';

jest.mock('@/lib/sheets', () => ({
    getEmployees: jest.fn(),
    getNonEmployees: jest.fn(),
    getBokResidents: jest.fn(),
    getSettings: jest.fn(),
    getStartLists: jest.fn(),
}));

jest.mock('@/lib/alert-utils', () => ({
    extractAlertDetails: jest.fn().mockReturnValue({
        contractExpiry: [],
        capacityExceeded: [],
        missingPaymentData: [],
        duplicatePersons: [],
    }),
}));

jest.mock('@/lib/actions', () => ({
    sendPushNotification: jest.fn().mockResolvedValue({ success: true }),
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
