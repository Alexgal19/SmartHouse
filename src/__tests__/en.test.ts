/**
 * Testy słownika EN — spójność kluczy z PL i obecność kluczy bufora offline.
 */
import { pl } from '@/lib/translations/pl';
import { en } from '@/lib/translations/en';

describe('translations/en', () => {
    it('każdy klucz EN ma odpowiednik w PL (pełna dwujęzyczność UI)', () => {
        const enKeys = Object.keys(en);
        const plKeys = new Set(Object.keys(pl));
        const missing = enKeys.filter(k => !plKeys.has(k));
        expect(missing).toEqual([]);
    });

    it('zawiera klucze synchronizacji zdjęć offline', () => {
        for (const key of [
            'controlCards.savedPendingPhotos',
            'controlCards.savedPendingPhotosDesc',
            'controlCards.offlinePhotosSafe',
            'controlCards.offlinePhotosSafeDesc',
            'controlCards.photosSynced',
            'controlCards.photosSyncedDesc',
            'controlCards.pendingSyncBadge',
        ]) {
            expect(en[key as keyof typeof en]).toBeTruthy();
        }
    });

    it('nie zawiera pustych wartości', () => {
        const empty = Object.entries(en).filter(([, v]) => typeof v === 'string' && v.trim() === '');
        expect(empty).toEqual([]);
    });
});
