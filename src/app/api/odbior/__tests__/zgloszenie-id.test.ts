/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { DELETE, PATCH } from '../zgloszenie/[id]/route';
import { getSession } from '@/lib/auth';
import { updateOdbiorZgloszenie, softDeleteOdbiorZgloszenie, getOdbiorZgloszenia } from '@/lib/sheets';

jest.mock('@/lib/sheets', () => ({
    updateOdbiorZgloszenie: jest.fn(),
    softDeleteOdbiorZgloszenie: jest.fn(),
    getOdbiorZgloszenia: jest.fn(),
}));

const mockedUpdateOdbiorZgloszenie = updateOdbiorZgloszenie as jest.Mock;
const mockedSoftDeleteOdbiorZgloszenie = softDeleteOdbiorZgloszenie as jest.Mock;
const mockedGetOdbiorZgloszenia = getOdbiorZgloszenia as jest.Mock;

const adminSession = { isLoggedIn: true, uid: 'admin-1', name: 'Admin', isAdmin: true, isDriver: false };
const driverSession = { isLoggedIn: true, uid: 'driver-1', name: 'Driver', isAdmin: false, isDriver: true };
const rekrutacjaSession = { isLoggedIn: true, uid: 'rec-1', name: 'Rec', isAdmin: false, isDriver: false };

describe('DELETE /api/odbior/zgloszenie/[id]', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 when not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });

        const res = await DELETE({} as NextRequest, { params: { id: 'zgl-1' } });
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Nieautoryzowany dostęp.');
    });

    it('returns 403 when non-admin driver attempts deletion', async () => {
        (getSession as jest.Mock).mockResolvedValue(driverSession);

        const res = await DELETE({} as NextRequest, { params: { id: 'zgl-1' } });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('Brak uprawnień.');
    });

    it('returns 400 when id param missing', async () => {
        (getSession as jest.Mock).mockResolvedValue(adminSession);

        const res = await DELETE({} as NextRequest, { params: { id: '' } });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Brak ID zgłoszenia.');
    });

    it('soft deletes successfully for admin', async () => {
        (getSession as jest.Mock).mockResolvedValue(adminSession);
        mockedSoftDeleteOdbiorZgloszenie.mockResolvedValue(undefined);

        const res = await DELETE({} as NextRequest, { params: { id: 'zgl-1' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(mockedSoftDeleteOdbiorZgloszenie).toHaveBeenCalledWith('zgl-1', 'Admin');
    });

    it('soft deletes successfully for non-driver recruiter', async () => {
        (getSession as jest.Mock).mockResolvedValue(rekrutacjaSession);

        const res = await DELETE({} as NextRequest, { params: { id: 'zgl-1' } });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('Brak uprawnień.');
    });
});

describe('PATCH /api/odbior/zgloszenie/[id]', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetOdbiorZgloszenia.mockResolvedValue([
            {
                id: 'zgl-1',
                status: 'Nieprzyjęte',
                numerTelefonu: '123',
                skad: 'autobusowa',
                komentarzSkad: '',
                iloscOsob: 2,
                komentarz: '',
                zdjeciaUrls: '',
                nastepnyKrok: '',
                osoby: '[]',
                changeLog: '',
                dataZakonczenia: '',
                zakonczoneAt: '',
            },
        ]);
    });

    const makePatchRequest = (body: object) => {
        return new NextRequest('http://localhost/api/odbior/zgloszenie/zgl-1', {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    };

    it('returns 401 when not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });

        const res = await PATCH(makePatchRequest({ action: 'przyjmij' }), { params: { id: 'zgl-1' } });
        expect(res.status).toBe(401);
    });

    it('returns 400 when id param missing', async () => {
        (getSession as jest.Mock).mockResolvedValue(adminSession);

        const res = await PATCH(makePatchRequest({ action: 'przyjmij' }), { params: { id: '' } });
        expect(res.status).toBe(400);
    });

    it('przyjmij: transitions to W trakcie and sets driver', async () => {
        (getSession as jest.Mock).mockResolvedValue(driverSession);
        mockedUpdateOdbiorZgloszenie.mockResolvedValue(undefined);

        const res = await PATCH(makePatchRequest({ action: 'przyjmij' }), { params: { id: 'zgl-1' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.updates.status).toBe('W trakcie');
        expect(body.updates.kierowcaId).toBe('driver-1');
        expect(body.updates.kierowcaNazwa).toBe('Driver');
        expect(body.updates.przyjeteAt).toBeDefined();
    });

    it('odrzuc: transitions to Nieprzyjęte and clears driver', async () => {
        (getSession as jest.Mock).mockResolvedValue(driverSession);
        mockedUpdateOdbiorZgloszenie.mockResolvedValue(undefined);

        const res = await PATCH(makePatchRequest({ action: 'odrzuc' }), { params: { id: 'zgl-1' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.updates.status).toBe('Nieprzyjęte');
        expect(body.updates.kierowcaId).toBe('');
        expect(body.updates.kierowcaNazwa).toBe('');
    });

    it('zakoncz: transitions to Zakończone and sets completion date', async () => {
        (getSession as jest.Mock).mockResolvedValue(driverSession);
        mockedUpdateOdbiorZgloszenie.mockResolvedValue(undefined);

        const res = await PATCH(makePatchRequest({ action: 'zakoncz' }), { params: { id: 'zgl-1' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.updates.status).toBe('Zakończone');
        expect(body.updates.dataZakonczenia).toBeDefined();
        expect(body.updates.zakonczoneAt).toBeDefined();
    });

    it('anuluj_zakonczenie: returns 403 for non-admin', async () => {
        (getSession as jest.Mock).mockResolvedValue(driverSession);

        const res = await PATCH(makePatchRequest({ action: 'anuluj_zakonczenie' }), { params: { id: 'zgl-1' } });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('Brak uprawnień.');
    });

    it('anuluj_zakonczenie: reverts to W trakcie for admin', async () => {
        (getSession as jest.Mock).mockResolvedValue(adminSession);
        mockedUpdateOdbiorZgloszenie.mockResolvedValue(undefined);

        const res = await PATCH(makePatchRequest({ action: 'anuluj_zakonczenie' }), { params: { id: 'zgl-1' } });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.updates.status).toBe('W trakcie');
        expect(body.updates.dataZakonczenia).toBe('');
        expect(body.updates.zakonczoneAt).toBe('');
    });

    it('update: appends changeLog with diff', async () => {
        (getSession as jest.Mock).mockResolvedValue(adminSession);
        mockedUpdateOdbiorZgloszenie.mockResolvedValue(undefined);

        const res = await PATCH(
            makePatchRequest({ action: 'update', numerTelefonu: '999', iloscOsob: '5' }),
            { params: { id: 'zgl-1' } }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.updates.changeLog).toBeDefined();
        const log = JSON.parse(body.updates.changeLog);
        expect(log).toHaveLength(1);
        expect(log[0].changes).toContain('Zmieniono numer telefonu');
        expect(log[0].changes).toContain('Zmieniono ilość osób');
        expect(log[0].userName).toBe('Admin');
    });

    it('update: does not append empty changeLog when nothing changed', async () => {
        (getSession as jest.Mock).mockResolvedValue(adminSession);
        mockedUpdateOdbiorZgloszenie.mockResolvedValue(undefined);

        const res = await PATCH(
            makePatchRequest({ action: 'update', numerTelefonu: '123' }), // same as existing
            { params: { id: 'zgl-1' } }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        // When nothing changed, changeLog should not be set in updates
        expect(body.updates.changeLog).toBeUndefined();
    });

    it('returns 400 for unknown action', async () => {
        (getSession as jest.Mock).mockResolvedValue(adminSession);

        const res = await PATCH(makePatchRequest({ action: 'nieznana' }), { params: { id: 'zgl-1' } });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Nieznana akcja.');
    });
});
