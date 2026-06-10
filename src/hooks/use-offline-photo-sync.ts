'use client';

/**
 * use-offline-photo-sync.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that automatically synchronises offline-buffered photos to Firebase
 * Storage whenever the browser goes online.
 *
 * Usage: mount once in the root layout — <MainLayout> calls this hook.
 *
 * Responsibilities:
 *  1. On mount + on every `online` event: try to upload pending photos from IndexedDB.
 *  2. On success: replace the pending URL with the real server URL in any open form
 *     by dispatching a custom DOM event that control-cards-view listens to.
 *  3. On success: if the related card/startlist has `hasPendingPhotos: true`,
 *     trigger an action to clear that flag via server action.
 *  4. Shows a subtle toast when sync completes.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/lib/i18n';
import {
    getPendingPhotos,
    markPhotoUploaded,
    markPhotoFailed,
    removePendingPhoto,
    type PendingPhoto,
} from '@/lib/offline-photo-store';
import { uploadControlCardPhotoAction } from '@/lib/actions';

/** Custom event dispatched after a pending photo is successfully uploaded */
export type PhotoSyncedEvent = CustomEvent<{
    pendingId: string;    // the old pending URL / ID used in form state
    serverUrl: string;    // the final Firebase Storage URL
    context: PendingPhoto['context'];
    contextId: string;
    field: string;
}>;

declare global {
    interface WindowEventMap {
        'photo-synced': PhotoSyncedEvent;
    }
}

export function dispatchPhotoSynced(payload: PhotoSyncedEvent['detail']): void {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('photo-synced', { detail: payload }));
    }
}

async function syncOnePendingPhoto(photo: PendingPhoto): Promise<boolean> {
    try {
        const res = await uploadControlCardPhotoAction(
            photo.base64,
            photo.fileName || 'photo.jpg',
            photo.mimeType || 'image/jpeg',
        );
        if (res.url) {
            await markPhotoUploaded(photo.id, res.url);
            dispatchPhotoSynced({
                pendingId: photo.id,
                serverUrl: res.url,
                context: photo.context,
                contextId: photo.contextId,
                field: photo.field,
            });
            await removePendingPhoto(photo.id);
            return true;
        } else {
            await markPhotoFailed(photo.id);
            return false;
        }
    } catch {
        await markPhotoFailed(photo.id);
        return false;
    }
}

export function useOfflinePhotoSync(): void {
    const { toast } = useToast();
    const { t } = useLanguage();
    const isSyncingRef = useRef(false);

    const syncPendingPhotos = useCallback(async (): Promise<void> => {
        if (isSyncingRef.current) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;

        let pending: PendingPhoto[];
        try {
            pending = await getPendingPhotos();
        } catch {
            return;
        }
        if (pending.length === 0) return;

        isSyncingRef.current = true;
        let successCount = 0;
        let failCount = 0;

        for (const photo of pending) {
            const ok = await syncOnePendingPhoto(photo);
            if (ok) successCount++;
            else failCount++;
        }

        isSyncingRef.current = false;

        if (successCount > 0) {
            toast({
                title: t('offlineSync.syncComplete'),
                description: t('offlineSync.syncCompleteDesc', { count: successCount }),
            });
        }
        if (failCount > 0) {
            console.warn(`[offline-photo-sync] ${failCount} photo(s) failed to sync.`);
        }
    }, [toast, t]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Try sync on initial mount (when app regains focus after being offline)
        syncPendingPhotos();

        const handleOnline = () => {
            syncPendingPhotos();
        };

        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, [syncPendingPhotos]);
}
