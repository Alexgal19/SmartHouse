/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST as PostAck } from '../ack/route';
import { acknowledgeCandidateDemandAction } from '@/lib/actions';
import { getSession } from '@/lib/auth';

jest.mock('@/lib/actions', () => ({
    acknowledgeCandidateDemandAction: jest.fn(),
}));

const mockedAcknowledgeAction = acknowledgeCandidateDemandAction as jest.Mock;

describe('POST /api/candidate-demand/ack', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getSession as jest.Mock).mockResolvedValue({
            isLoggedIn: true,
            uid: 'coord-1',
            name: 'Koordynator',
            isAdmin: true,
        });
    });

    const makeRequest = (body: object) =>
        new NextRequest('http://localhost/api/candidate-demand/ack', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        });

    it('returns 400 when demandId is missing', async () => {
        const res = await PostAck(makeRequest({}));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Missing demandId');
    });

    it('returns 400 when demandId is not a string', async () => {
        const res = await PostAck(makeRequest({ demandId: 123 }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Missing demandId');
    });

    it('returns 401 when user is not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });

        const res = await PostAck(makeRequest({ demandId: 'demand-1' }));
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Nieautoryzowany dostęp.');
    });

    it('calls acknowledgeCandidateDemandAction and returns result on success', async () => {
        mockedAcknowledgeAction.mockResolvedValue({ success: true, demandId: 'demand-1' });

        const res = await PostAck(makeRequest({ demandId: 'demand-1' }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(mockedAcknowledgeAction).toHaveBeenCalledWith('demand-1', 'coord-1');
    });

    it('returns 500 when action throws', async () => {
        mockedAcknowledgeAction.mockRejectedValue(new Error('Sheet error'));

        const res = await PostAck(makeRequest({ demandId: 'demand-1' }));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toBe('Sheet error');
    });
});
