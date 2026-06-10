/**
 * Testy trwałego bufora offline dla zdjęć (IndexedDB przez fake-indexeddb).
 */
import { serialize, deserialize } from 'v8';
// jsdom nie udostępnia structuredClone, którego wymaga fake-indexeddb
if (typeof globalThis.structuredClone === 'undefined') {
    globalThis.structuredClone = (<T,>(val: T): T => deserialize(serialize(val))) as typeof structuredClone;
}
import 'fake-indexeddb/auto';
import {
    addPendingPhoto,
    getPendingPhotos,
    getPhotosForContext,
    claimForUpload,
    releaseClaim,
    removePendingPhoto,
    bindContext,
    cleanupOldPhotos,
    newPendingPhotoId,
    unboundContextId,
    isPendingPlaceholder,
    dataUrlToBlob,
    blobToDataUrl,
} from '../offline-photo-store';

const TINY_JPEG_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

const makePhoto = (overrides: Partial<Parameters<typeof addPendingPhoto>[0]> = {}) => ({
    id: newPendingPhotoId(),
    blob: dataUrlToBlob(TINY_JPEG_DATA_URL),
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    context: 'start-list' as const,
    contextId: 'addr-1',
    field: 'kitchenPhotoUrls',
    ...overrides,
});

describe('offline-photo-store', () => {
    beforeEach(async () => {
        // Wyczyść bufor między testami
        const all = await getPendingPhotos();
        await Promise.all(all.map(p => removePendingPhoto(p.id)));
    });

    it('zapisuje i odczytuje zdjęcie (roundtrip przeżywa "restart")', async () => {
        const photo = makePhoto();
        expect(await addPendingPhoto(photo)).toBe(true);

        const all = await getPendingPhotos();
        expect(all).toHaveLength(1);
        expect(all[0].id).toBe(photo.id);
        expect(all[0].status).toBe('pending');
        expect(all[0].createdAt).toBeTruthy();
    });

    it('filtruje zdjęcia po kontekście', async () => {
        await addPendingPhoto(makePhoto({ contextId: 'addr-1' }));
        await addPendingPhoto(makePhoto({ contextId: 'addr-2' }));
        await addPendingPhoto(makePhoto({ context: 'control-card', contextId: 'cc-1' }));

        expect(await getPhotosForContext('start-list', 'addr-1')).toHaveLength(1);
        expect(await getPhotosForContext('control-card', 'cc-1')).toHaveLength(1);
        expect(await getPhotosForContext('control-card', 'addr-1')).toHaveLength(0);
    });

    it('claimForUpload jest atomowy — drugi claim zwraca null (ochrona przed podwójnym uploadem)', async () => {
        const photo = makePhoto();
        await addPendingPhoto(photo);

        const first = await claimForUpload(photo.id);
        expect(first?.status).toBe('uploading');

        const second = await claimForUpload(photo.id);
        expect(second).toBeNull();
    });

    it('releaseClaim przywraca status pending i pozwala na ponowny claim', async () => {
        const photo = makePhoto();
        await addPendingPhoto(photo);
        await claimForUpload(photo.id);
        await releaseClaim(photo.id);

        const reclaimed = await claimForUpload(photo.id);
        expect(reclaimed?.id).toBe(photo.id);
    });

    it('removePendingPhoto usuwa rekord po synchronizacji', async () => {
        const photo = makePhoto();
        await addPendingPhoto(photo);
        await removePendingPhoto(photo.id);
        expect(await getPendingPhotos()).toHaveLength(0);
    });

    it('bindContext wiąże zdjęcia "unbound" z realnym ID karty', async () => {
        const unbound = unboundContextId('addr-1', '2026-06');
        await addPendingPhoto(makePhoto({ context: 'control-card', contextId: unbound }));
        await addPendingPhoto(makePhoto({ context: 'control-card', contextId: 'cc-other' }));

        await bindContext('control-card', unbound, 'cc-123');

        expect(await getPhotosForContext('control-card', 'cc-123')).toHaveLength(1);
        expect(await getPhotosForContext('control-card', unbound)).toHaveLength(0);
        expect(await getPhotosForContext('control-card', 'cc-other')).toHaveLength(1);
    });

    it('cleanupOldPhotos usuwa stare rekordy, świeże zostawia', async () => {
        await addPendingPhoto(makePhoto());
        expect(await cleanupOldPhotos(30)).toBe(0);
        expect(await getPendingPhotos()).toHaveLength(1);
        await new Promise(r => setTimeout(r, 10)); // createdAt musi być starsze niż cutoff
        expect(await cleanupOldPhotos(0)).toBe(1);
        expect(await getPendingPhotos()).toHaveLength(0);
    });

    it('konwersja dataUrl ↔ Blob jest odwracalna', async () => {
        const blob = dataUrlToBlob(TINY_JPEG_DATA_URL);
        expect(blob.type).toBe('image/jpeg');
        const back = await blobToDataUrl(blob);
        expect(back).toBe(TINY_JPEG_DATA_URL);
    });

    it('placeholdery mają prefix pending_ i są rozpoznawane', () => {
        const id = newPendingPhotoId();
        expect(isPendingPlaceholder(id)).toBe(true);
        expect(isPendingPlaceholder('https://storage.googleapis.com/x.jpg')).toBe(false);
        expect(isPendingPlaceholder('data:image/jpeg;base64,x')).toBe(false);
    });
});
