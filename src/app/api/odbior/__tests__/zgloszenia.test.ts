/**
 * @jest-environment node
 */
import { GET } from '../zgloszenia/route';
import { getSession } from '@/lib/auth';
import { getOdbiorZgloszenia } from '@/lib/sheets';

jest.mock('@/lib/sheets', () => ({
    getOdbiorZgloszenia: jest.fn(),
}));

const mockedGetOdbiorZgloszenia = getOdbiorZgloszenia as jest.Mock;

describe('GET /api/odbior/zgloszenia', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });

        const res = await GET();
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Nieautoryzowany dostęp.');
    });

    it('returns active submissions sorted descending and excludes deleted', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: true });
        mockedGetOdbiorZgloszenia.mockResolvedValue([
            { id: 'z-1', dataZgloszenia: '2024-04-28 10:00', deletedAt: '', status: 'Nieprzyjęte' },
            { id: 'z-2', dataZgloszenia: '2024-04-29 10:00', deletedAt: '', status: 'W trakcie' },
            { id: 'z-3', dataZgloszenia: '2024-04-27 10:00', deletedAt: '2024-04-30', status: 'Nieprzyjęte' },
        ]);

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(2);
        expect(body[0].id).toBe('z-2');
        expect(body[1].id).toBe('z-1');
    });

    it('returns empty array when no active submissions', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: true });
        mockedGetOdbiorZgloszenia.mockResolvedValue([]);

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual([]);
    });
});
