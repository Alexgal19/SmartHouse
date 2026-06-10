'use client';

import { useCallback, useEffect, useRef } from 'react';
import { uploadControlCardPhotoAction, attachSyncedPhotoUrlsAction } from '@/lib/actions';
import {
    getPendingPhotos,
    claimForUpload,
    releaseClaim,
    removePendingPhoto,
    cleanupOldPhotos,
    blobToDataUrl,
    isOfflinePhotoStoreSupported,
    UNBOUND_CONTEXT_PREFIX,
} from '@/lib/offline-photo-store';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/i18n';

/**
 * Synchronizuje zdjęcia z bufora offline (IndexedDB) do Firebase Storage
 * i podmienia placeholdery "pending_*" w Sheets na realne URL-e.
 *
 * Triggery: mount, `online`, powrót do aplikacji (`visibilitychange`) —
 * event `online` w Android webview bywa zawodny, stąd podwójny mechanizm.
 */
export function useOfflinePhotoSync() {
    const syncingRef = useRef(false);
    const { toast } = useToast();
    const { t } = useLanguage();

    const syncNow = useCallback(async () => {
        if (!isOfflinePhotoStoreSupported() || syncingRef.current) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        syncingRef.current = true;
        try {
            const photos = await getPendingPhotos();
            // Niezwiązane z zapisaną kartą (porzucony formularz) — zostają do TTL cleanup
            const bound = photos.filter(p => !p.contextId.startsWith(UNBOUND_CONTEXT_PREFIX));
            let synced = 0;
            for (const photo of bound) {
                const claimed = await claimForUpload(photo.id);
                if (!claimed) continue; // ktoś inny właśnie uploaduje
                try {
                    const dataUrl = await blobToDataUrl(claimed.blob);
                    const res = await uploadControlCardPhotoAction(dataUrl, claimed.fileName, claimed.mimeType);
                    if (!res.url) {
                        await releaseClaim(photo.id);
                        continue;
                    }
                    const attach = await attachSyncedPhotoUrlsAction(claimed.context, claimed.contextId, [
                        { placeholder: claimed.id, url: res.url },
                    ]);
                    if (!attach.success) {
                        await releaseClaim(photo.id);
                        continue;
                    }
                    await removePendingPhoto(photo.id);
                    synced++;
                } catch {
                    await releaseClaim(photo.id);
                }
            }
            if (synced > 0) {
                toast({
                    title: t('controlCards.photosSynced'),
                    description: t('controlCards.photosSyncedDesc', { count: synced }),
                });
                window.dispatchEvent(new Event('control-cards-updated'));
            }
        } finally {
            syncingRef.current = false;
        }
    }, [t, toast]);

    useEffect(() => {
        cleanupOldPhotos().catch(() => {});
        syncNow();
        const onOnline = () => { syncNow(); };
        const onVisible = () => {
            if (document.visibilityState === 'visible') syncNow();
        };
        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener('online', onOnline);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [syncNow]);

    return { syncNow };
}
