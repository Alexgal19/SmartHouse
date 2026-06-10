/**
 * Testy attachSyncedPhotoUrlsAction — targeted podmiana placeholderów "pending_*"
 * na realne URL-e po synchronizacji zdjęć offline.
 */
import * as actions from '../actions';
import * as sheets from '../sheets';
import * as auth from '../auth';
import type { ControlCard, StartList } from '../../types';

jest.mock('../sheets');
jest.mock('../auth');
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

const mockSession = { isLoggedIn: true, uid: 'user-1', name: 'Koordynator', isAdmin: false };

const baseCard: ControlCard = {
    id: 'cc-1',
    addressId: 'addr-1',
    addressName: 'Chopina 11a',
    coordinatorId: 'user-1',
    coordinatorName: 'Koordynator',
    controlMonth: '2026-06',
    fillDate: '2026-06-10',
    roomRatings: [
        { roomId: 'r1', roomName: '101', rating: 10, comment: '', photoUrls: ['pending_room1'] },
    ],
    cleanKitchen: 10,
    cleanBathroom: 10,
    kitchenPhotoUrls: ['pending_abc', 'https://storage.example.com/old.jpg'],
    bathroomPhotoUrls: [],
    meterPhotoUrls: [],
    appliancesWorking: true,
    comments: [
        { id: 'c1', text: 'Uwaga', status: 'Nie przyjęte', photoUrls: ['pending_comment1'] },
    ],
    hasPendingPhotos: true,
};

const baseStartList: StartList = {
    addressId: 'addr-1',
    addressName: 'Chopina 11a',
    housingType: 'Kwatera',
    distanceToWork: '1km',
    transport: [],
    distanceToShop: '500m',
    floorsCount: 0,
    floorInBuilding: 1,
    roomsCount: 2,
    kitchensCount: 1,
    bathroomsCount: 1,
    placesCount: 4,
    hasBalcony: false,
    standard: 'Normalny',
    heating: 'Centralne',
    heatingOther: '',
    kitchenPhotoUrls: ['pending_sl1'],
    bathroomPhotoUrls: ['https://storage.example.com/b.jpg'],
    roomsPhotoUrls: [],
    hallwayPhotoUrls: [],
    updatedAt: '2026-06-10T10:00:00.000Z',
    updatedBy: 'Koordynator',
    updatedById: 'user-1',
    hasPendingPhotos: true,
};

describe('attachSyncedPhotoUrlsAction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (auth.getSession as jest.Mock).mockResolvedValue(mockSession);
        (sheets.getControlCards as jest.Mock).mockResolvedValue([baseCard]);
        (sheets.updateControlCard as jest.Mock).mockResolvedValue(undefined);
        (sheets.getStartLists as jest.Mock).mockResolvedValue([baseStartList]);
        (sheets.updateStartListFields as jest.Mock).mockResolvedValue(undefined);
    });

    it('podmienia placeholder w karcie kontroli i zostawia hasPendingPhotos=true gdy zostały inne', async () => {
        const res = await actions.attachSyncedPhotoUrlsAction('control-card', 'cc-1', [
            { placeholder: 'pending_abc', url: 'https://storage.example.com/new.jpg' },
        ]);

        expect(res.success).toBe(true);
        expect(res.remaining).toBe(2); // pending_room1 + pending_comment1

        const [cardId, updates] = (sheets.updateControlCard as jest.Mock).mock.calls[0];
        expect(cardId).toBe('cc-1');
        expect(updates.kitchenPhotoUrls).toEqual(['https://storage.example.com/new.jpg', 'https://storage.example.com/old.jpg']);
        expect(updates.hasPendingPhotos).toBe(true);
        // Targeted update — nie dotyka pól spoza zdjęć (ochrona przed nadpisaniem równoległej edycji)
        expect(updates).not.toHaveProperty('cleanKitchen');
        expect(updates).not.toHaveProperty('appliancesWorking');
        expect(updates).not.toHaveProperty('changeLog');
    });

    it('podmienia placeholdery w pokojach i komentarzach; hasPendingPhotos=false gdy wszystko zsynchronizowane', async () => {
        const res = await actions.attachSyncedPhotoUrlsAction('control-card', 'cc-1', [
            { placeholder: 'pending_abc', url: 'https://storage.example.com/1.jpg' },
            { placeholder: 'pending_room1', url: 'https://storage.example.com/2.jpg' },
            { placeholder: 'pending_comment1', url: 'https://storage.example.com/3.jpg' },
        ]);

        expect(res.success).toBe(true);
        expect(res.remaining).toBe(0);

        const updates = (sheets.updateControlCard as jest.Mock).mock.calls[0][1];
        expect(updates.roomRatings[0].photoUrls).toEqual(['https://storage.example.com/2.jpg']);
        expect(updates.comments[0].photoUrls).toEqual(['https://storage.example.com/3.jpg']);
        expect(updates.hasPendingPhotos).toBe(false);
    });

    it('podmienia placeholder w Start Liście przez targeted update', async () => {
        const res = await actions.attachSyncedPhotoUrlsAction('start-list', 'addr-1', [
            { placeholder: 'pending_sl1', url: 'https://storage.example.com/k.jpg' },
        ]);

        expect(res.success).toBe(true);
        expect(res.remaining).toBe(0);

        const [addressId, updates] = (sheets.updateStartListFields as jest.Mock).mock.calls[0];
        expect(addressId).toBe('addr-1');
        expect(updates.kitchenPhotoUrls).toEqual(['https://storage.example.com/k.jpg']);
        expect(updates.bathroomPhotoUrls).toEqual(['https://storage.example.com/b.jpg']);
        expect(updates.hasPendingPhotos).toBe(false);
        expect(updates).not.toHaveProperty('housingType');
        expect(updates).not.toHaveProperty('placesCount');
    });

    it('odrzuca podmiany bez prefixu pending_ lub z URL-em niebędącym http(s)', async () => {
        const res = await actions.attachSyncedPhotoUrlsAction('control-card', 'cc-1', [
            { placeholder: 'https://x.jpg', url: 'https://y.jpg' },
            { placeholder: 'pending_abc', url: 'data:image/jpeg;base64,xxx' },
        ]);
        expect(res.success).toBe(false);
        expect(sheets.updateControlCard).not.toHaveBeenCalled();
    });

    it('zwraca błąd gdy karta nie istnieje', async () => {
        const res = await actions.attachSyncedPhotoUrlsAction('control-card', 'cc-missing', [
            { placeholder: 'pending_abc', url: 'https://storage.example.com/new.jpg' },
        ]);
        expect(res.success).toBe(false);
        expect(res.error).toContain('not found');
    });

    it('wymaga sesji', async () => {
        (auth.getSession as jest.Mock).mockResolvedValue({ isLoggedIn: false });
        const res = await actions.attachSyncedPhotoUrlsAction('control-card', 'cc-1', [
            { placeholder: 'pending_abc', url: 'https://storage.example.com/new.jpg' },
        ]);
        expect(res.success).toBe(false);
        expect(sheets.updateControlCard).not.toHaveBeenCalled();
    });
});
