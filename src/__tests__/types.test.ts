/**
 * Testy kontraktu typów — pole hasPendingPhotos (bufor offline zdjęć).
 * Konstrukcja obiektów weryfikuje kompilację typów i dokumentuje kontrakt.
 */
import type { ControlCard, StartList } from '@/types';

describe('types — hasPendingPhotos', () => {
    it('ControlCard przyjmuje opcjonalne hasPendingPhotos (wstecznie kompatybilne)', () => {
        const base: ControlCard = {
            id: 'cc-1',
            addressId: 'addr-1',
            addressName: 'Chopina 11a',
            coordinatorId: 'u1',
            coordinatorName: 'Koordynator',
            controlMonth: '2026-06',
            fillDate: '2026-06-10',
            roomRatings: [],
            cleanKitchen: 10,
            cleanBathroom: 10,
            appliancesWorking: true,
            comments: [],
        };
        expect(base.hasPendingPhotos).toBeUndefined();

        const withPending: ControlCard = { ...base, hasPendingPhotos: true };
        expect(withPending.hasPendingPhotos).toBe(true);
    });

    it('StartList przyjmuje opcjonalne hasPendingPhotos (wstecznie kompatybilne)', () => {
        const base: StartList = {
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
            kitchenPhotoUrls: [],
            bathroomPhotoUrls: [],
            roomsPhotoUrls: [],
            hallwayPhotoUrls: [],
            updatedAt: '2026-06-10T10:00:00.000Z',
            updatedBy: 'Koordynator',
            updatedById: 'u1',
        };
        expect(base.hasPendingPhotos).toBeUndefined();

        const withPending: StartList = { ...base, hasPendingPhotos: true };
        expect(withPending.hasPendingPhotos).toBe(true);
    });
});
