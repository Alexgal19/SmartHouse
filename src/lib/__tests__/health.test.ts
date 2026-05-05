import { GET } from '@/app/api/health/route';

jest.mock('@/lib/sheets', () => ({
    pingSheets: jest.fn(),
}));

jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((body: unknown, init?: { status?: number }) => ({
            status: init?.status ?? 200,
            json: async () => body,
        })),
    },
}));

const { pingSheets } = require('@/lib/sheets') as { pingSheets: jest.Mock };

describe('GET /api/health', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 200 with status ok when Sheets is reachable', async () => {
        pingSheets.mockResolvedValueOnce(undefined);

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.status).toBe('ok');
        expect(json.sheets.status).toBe('ok');
        expect(typeof json.sheets.latencyMs).toBe('number');
        expect(typeof json.timestamp).toBe('string');
    });

    it('returns 503 with status degraded when Sheets throws', async () => {
        pingSheets.mockRejectedValueOnce(new Error('pingSheets timed out after 5000ms'));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(503);
        expect(json.status).toBe('degraded');
        expect(json.sheets.status).toBe('error');
        expect(json.sheets.error).toBe('pingSheets timed out after 5000ms');
    });
});
