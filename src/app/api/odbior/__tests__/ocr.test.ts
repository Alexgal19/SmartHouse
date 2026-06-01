/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../ocr/route';
import { getSession } from '@/lib/auth';
import { extractPassportData } from '@/ai/flows/extract-passport-data-flow';

jest.mock('@/ai/flows/extract-passport-data-flow', () => ({
    extractPassportData: jest.fn(),
}));

const mockedExtractPassportData = extractPassportData as jest.Mock;

describe('POST /api/odbior/ocr', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const makeRequest = (body: FormData) =>
        new NextRequest('http://localhost/api/odbior/ocr', {
            method: 'POST',
            body: body as unknown as BodyInit,
        });

    it('returns 401 when not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });

        const res = await POST(makeRequest(new FormData()));
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Nieautoryzowany dostęp.');
    });

    it('returns 403 when user is not admin or driver', async () => {
        (getSession as jest.Mock).mockResolvedValue({
            isLoggedIn: true,
            uid: 'rec-1',
            isAdmin: false,
            isDriver: false,
        });

        const res = await POST(makeRequest(new FormData()));
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('Brak uprawnień.');
    });

    it('returns 400 when photo is missing', async () => {
        (getSession as jest.Mock).mockResolvedValue({
            isLoggedIn: true,
            uid: 'user-1',
            isAdmin: true,
            isDriver: false,
        });

        const formData = new FormData();
        const res = await POST(makeRequest(formData));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Brak zdjęcia.');
    });

    it('extracts passport data and returns result', async () => {
        (getSession as jest.Mock).mockResolvedValue({
            isLoggedIn: true,
            uid: 'user-1',
            isAdmin: true,
            isDriver: false,
        });
        mockedExtractPassportData.mockResolvedValue({
            firstName: 'Jan',
            lastName: 'Kowalski',
            passportNumber: 'AB123456',
        });

        const formData = new FormData();
        const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
        formData.append('photo', blob, 'passport.jpg');

        const res = await POST(makeRequest(formData));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.imie).toBe('Jan');
        expect(body.nazwisko).toBe('Kowalski');
        expect(body.paszport).toBe('AB123456');
    });

    it('returns 500 on extractPassportData error', async () => {
        (getSession as jest.Mock).mockResolvedValue({
            isLoggedIn: true,
            uid: 'user-1',
            isAdmin: true,
            isDriver: false,
        });
        mockedExtractPassportData.mockRejectedValue(new Error('AI error'));

        const formData = new FormData();
        const blob = new Blob(['data'], { type: 'image/jpeg' });
        formData.append('photo', blob, 'photo.jpg');

        const res = await POST(makeRequest(formData));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('AI error');
    });

    it('returns 429 on rate limit error from AI', async () => {
        (getSession as jest.Mock).mockResolvedValue({
            isLoggedIn: true,
            uid: 'user-1',
            isAdmin: false,
            isDriver: true,
        });
        mockedExtractPassportData.mockRejectedValue(
            new Error('Przekroczono limit zapytań API [429]')
        );

        const formData = new FormData();
        const blob = new Blob(['data'], { type: 'image/jpeg' });
        formData.append('photo', blob, 'photo.jpg');

        const res = await POST(makeRequest(formData));
        expect(res.status).toBe(429);
    });
});
