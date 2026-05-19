/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../zgloszenie/route';
import { getSession } from '@/lib/auth';
import { addOdbiorZgloszenieRow, getSettings } from '@/lib/sheets';
import { uploadFileToDrive } from '@/lib/drive';
import { sendPushNotification } from '@/lib/actions';

jest.mock('@/lib/sheets', () => ({
    addOdbiorZgloszenieRow: jest.fn(),
    getSettings: jest.fn(),
}));

jest.mock('@/lib/drive', () => ({
    uploadFileToDrive: jest.fn(),
}));

jest.mock('@/lib/actions', () => ({
    sendPushNotification: jest.fn(),
}));

const mockedAddOdbiorZgloszenieRow = addOdbiorZgloszenieRow as jest.Mock;
const mockedGetSettings = getSettings as jest.Mock;
const mockedUploadFileToDrive = uploadFileToDrive as jest.Mock;
const mockedSendPushNotification = sendPushNotification as jest.Mock;

describe('POST /api/odbior/zgloszenie', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const makeRequest = (formData: FormData) => {
        return new NextRequest('http://localhost/api/odbior/zgloszenie', {
            method: 'POST',
            body: formData as any,
        });
    };

    it('returns 401 when not authenticated', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });

        const formData = new FormData();
        const req = makeRequest(formData);
        const res = await POST(req);

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('Nieautoryzowany dostęp.');
    });

    it('returns 400 when required fields missing', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: true, uid: 'user-1', name: 'Test' });

        const formData = new FormData();
        formData.append('skad', 'autobusowa');
        // missing numerTelefonu and iloscOsob
        const req = makeRequest(formData);
        const res = await POST(req);

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Brakujące wymagane pola.');
    });

    it('returns 400 when iloscOsob is not a number', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: true, uid: 'user-1', name: 'Test' });

        const formData = new FormData();
        formData.append('numerTelefonu', '123456789');
        formData.append('skad', 'autobusowa');
        formData.append('iloscOsob', 'abc');
        const req = makeRequest(formData);
        const res = await POST(req);

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Brakujące wymagane pola.');
    });

    it('creates submission with photos and notifies drivers', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: true, uid: 'user-1', name: 'Test' });
        mockedAddOdbiorZgloszenieRow.mockResolvedValue({ id: 'zgl-new' });
        mockedGetSettings.mockResolvedValue({
            coordinators: [
                { uid: 'driver-1', isAdmin: false, isDriver: true, pushSubscription: 'sub-1' },
                { uid: 'driver-2', isAdmin: false, isDriver: true, pushSubscription: null },
                { uid: 'rec-1', isAdmin: false, isDriver: false, pushSubscription: 'sub-2' },
            ],
        });
        mockedUploadFileToDrive.mockResolvedValue({ url: 'https://drive.google.com/photo1.jpg' });
        mockedSendPushNotification.mockResolvedValue(undefined);

        const formData = new FormData();
        formData.append('numerTelefonu', '123456789');
        formData.append('skad', 'autobusowa');
        formData.append('iloscOsob', '3');
        formData.append('komentarz', 'Urgent');

        const blob = new Blob(['fake-image-data'], { type: 'image/jpeg' });
        formData.append('zdjecia', blob, 'photo.jpg');

        const req = makeRequest(formData);
        const res = await POST(req);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(mockedAddOdbiorZgloszenieRow).toHaveBeenCalledWith(
            expect.objectContaining({
                numerTelefonu: '123456789',
                skad: 'autobusowa',
                iloscOsob: 3,
                komentarz: 'Urgent',
                zdjeciaUrls: 'https://drive.google.com/photo1.jpg',
                status: 'Nieprzyjęte',
                rekruterId: 'user-1',
                rekruterNazwa: 'Test',
            })
        );
        expect(mockedSendPushNotification).toHaveBeenCalledWith(
            'driver-1',
            'Nowe zgłoszenie odbioru',
            expect.stringContaining('Stacja autobusowa'),
            '/dashboard?view=odbior'
        );
        // driver-2 has no pushSubscription, rec-1 is not a driver
        expect(mockedSendPushNotification).toHaveBeenCalledTimes(1);
    });

    it('creates submission without photos', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: true, uid: 'user-1', name: 'Test' });
        mockedAddOdbiorZgloszenieRow.mockResolvedValue({ id: 'zgl-new' });
        mockedGetSettings.mockResolvedValue({ coordinators: [] });

        const formData = new FormData();
        formData.append('numerTelefonu', '987654321');
        formData.append('skad', 'pociagowa');
        formData.append('iloscOsob', '1');

        const req = makeRequest(formData);
        const res = await POST(req);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(mockedUploadFileToDrive).not.toHaveBeenCalled();
    });

    it('returns 500 when addOdbiorZgloszenieRow throws', async () => {
        (getSession as jest.Mock).mockResolvedValue({ isLoggedIn: true, uid: 'user-1', name: 'Test' });
        mockedAddOdbiorZgloszenieRow.mockRejectedValue(new Error('Sheet write failed'));
        mockedGetSettings.mockResolvedValue({ coordinators: [] });

        const formData = new FormData();
        formData.append('numerTelefonu', '123456789');
        formData.append('skad', 'autobusowa');
        formData.append('iloscOsob', '2');

        const req = makeRequest(formData);
        const res = await POST(req);

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Sheet write failed');
    });
});
