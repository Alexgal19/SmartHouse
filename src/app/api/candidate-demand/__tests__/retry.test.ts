/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST as PostRetry } from '../retry/route';
import { retryCandidateDemandsAction } from '@/lib/actions';

jest.mock('@/lib/actions', () => ({
    retryCandidateDemandsAction: jest.fn(),
}));

const mockedRetryAction = retryCandidateDemandsAction as jest.Mock;

const CRON_SECRET = 'test-cron-secret';

const makeRequest = (authHeader?: string) =>
    new NextRequest('http://localhost/api/candidate-demand/retry', {
        method: 'POST',
        headers: authHeader ? { Authorization: authHeader } : {},
    });

describe('POST /api/candidate-demand/retry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CRON_SECRET = CRON_SECRET;
    });

    it('returns 401 when Authorization header is missing', async () => {
        const res = await PostRetry(makeRequest());
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when Authorization header has wrong secret', async () => {
        const res = await PostRetry(makeRequest('Bearer wrong-secret'));
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when CRON_SECRET env is not set', async () => {
        delete process.env.CRON_SECRET;
        const res = await PostRetry(makeRequest(`Bearer ${CRON_SECRET}`));
        expect(res.status).toBe(401);
    });

    it('calls retryCandidateDemandsAction and returns result on success', async () => {
        mockedRetryAction.mockResolvedValue({ success: true, retried: 3 });

        const res = await PostRetry(makeRequest(`Bearer ${CRON_SECRET}`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.retried).toBe(3);
        expect(mockedRetryAction).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when action throws', async () => {
        mockedRetryAction.mockRejectedValue(new Error('DB error'));

        const res = await PostRetry(makeRequest(`Bearer ${CRON_SECRET}`));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toBe('DB error');
    });
});
