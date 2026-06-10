/**
 * Testy hooka useOfflinePhotoSync — automatyczna synchronizacja zdjęć
 * z bufora offline po odzyskaniu sieci.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useOfflinePhotoSync } from '../use-offline-photo-sync';
import * as store from '@/lib/offline-photo-store';
import * as actions from '@/lib/actions';

jest.mock('@/lib/offline-photo-store', () => ({
    ...jest.requireActual('@/lib/offline-photo-store'),
    isOfflinePhotoStoreSupported: jest.fn(() => true),
    getPendingPhotos: jest.fn(),
    claimForUpload: jest.fn(),
    releaseClaim: jest.fn(),
    removePendingPhoto: jest.fn(),
    cleanupOldPhotos: jest.fn().mockResolvedValue(0),
    blobToDataUrl: jest.fn().mockResolvedValue('data:image/jpeg;base64,xxx'),
}));
jest.mock('@/lib/actions', () => ({
    uploadControlCardPhotoAction: jest.fn(),
    attachSyncedPhotoUrlsAction: jest.fn(),
}));
jest.mock('@/lib/i18n', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/use-toast', () => ({
    useToast: () => ({ toast: jest.fn() }),
}));

const boundPhoto = {
    id: 'pending_bound',
    blob: new Blob(['x'], { type: 'image/jpeg' }),
    fileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    context: 'control-card' as const,
    contextId: 'cc-1',
    field: 'kitchenPhotoUrls',
    status: 'pending' as const,
    claimedAt: null,
    createdAt: new Date().toISOString(),
};

const unboundPhoto = {
    ...boundPhoto,
    id: 'pending_unbound',
    contextId: 'unbound:addr-1:2026-06',
};

describe('useOfflinePhotoSync', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (store.getPendingPhotos as jest.Mock).mockResolvedValue([boundPhoto, unboundPhoto]);
        (store.claimForUpload as jest.Mock).mockImplementation(async (id: string) =>
            id === boundPhoto.id ? { ...boundPhoto, status: 'uploading' } : null
        );
        (actions.uploadControlCardPhotoAction as jest.Mock).mockResolvedValue({ url: 'https://storage.example.com/x.jpg' });
        (actions.attachSyncedPhotoUrlsAction as jest.Mock).mockResolvedValue({ success: true, remaining: 0 });
    });

    it('synchronizuje powiązane zdjęcia, pomija unbound (porzucone formularze)', async () => {
        renderHook(() => useOfflinePhotoSync());

        await waitFor(() => expect(store.removePendingPhoto).toHaveBeenCalledWith('pending_bound'));

        expect(store.claimForUpload).toHaveBeenCalledTimes(1);
        expect(store.claimForUpload).toHaveBeenCalledWith('pending_bound');
        expect(actions.uploadControlCardPhotoAction).toHaveBeenCalledTimes(1);
        expect(actions.attachSyncedPhotoUrlsAction).toHaveBeenCalledWith('control-card', 'cc-1', [
            { placeholder: 'pending_bound', url: 'https://storage.example.com/x.jpg' },
        ]);
    });

    it('zwalnia claim gdy upload się nie powiedzie (zdjęcie zostaje w buforze)', async () => {
        (actions.uploadControlCardPhotoAction as jest.Mock).mockResolvedValue({ url: '', error: 'offline' });

        renderHook(() => useOfflinePhotoSync());

        await waitFor(() => expect(store.releaseClaim).toHaveBeenCalledWith('pending_bound'));
        expect(store.removePendingPhoto).not.toHaveBeenCalled();
        expect(actions.attachSyncedPhotoUrlsAction).not.toHaveBeenCalled();
    });

    it('zwalnia claim gdy podmiana w Sheets się nie powiedzie', async () => {
        (actions.attachSyncedPhotoUrlsAction as jest.Mock).mockResolvedValue({ success: false, error: 'not found' });

        renderHook(() => useOfflinePhotoSync());

        await waitFor(() => expect(store.releaseClaim).toHaveBeenCalledWith('pending_bound'));
        expect(store.removePendingPhoto).not.toHaveBeenCalled();
    });

    it('nie robi nic gdy brak sieci', async () => {
        const onLineSpy = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

        renderHook(() => useOfflinePhotoSync());

        await new Promise(r => setTimeout(r, 50));
        expect(store.getPendingPhotos).not.toHaveBeenCalled();
        onLineSpy.mockRestore();
    });
});
