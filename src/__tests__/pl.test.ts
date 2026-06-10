/**
 * Testy słownika PL — spójność kluczy z EN i obecność kluczy bufora offline.
 */
import { pl } from '@/lib/translations/pl';
import { en } from '@/lib/translations/en';

describe('translations/pl', () => {
    it('każdy klucz PL ma odpowiednik w EN (pełna dwujęzyczność UI)', () => {
        const plKeys = Object.keys(pl);
        const enKeys = new Set(Object.keys(en));
        const missing = plKeys.filter(k => !enKeys.has(k));
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
            expect(pl[key as keyof typeof pl]).toBeTruthy();
        }
    });

    it('nie zawiera pustych wartości', () => {
        const empty = Object.entries(pl).filter(([, v]) => typeof v === 'string' && v.trim() === '');
        expect(empty).toEqual([]);
    });
});
