/**
 * offline-photo-store.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * IndexedDB wrapper used as a persistent offline buffer for photos taken in
 * Karty Kontroli and Start Lists.
 *
 * Key guarantees:
 *  - Data survives browser tab close, app backgrounding, and phone restarts.
 *  - Each record is keyed by a unique pending ID (e.g. "pending_<uuid>").
 *  - After a successful upload the record is removed from the store.
 *  - SSR-safe: all access is guarded by typeof window check.
 */

export type PendingPhotoContext = 'control-card' | 'start-list';

export type PendingPhoto = {
    /** Unique ID used in the form state, e.g. "pending_<uuid>" */
    id: string;
    /** Compressed Base64 data URL (data:image/jpeg;base64,...) */
    base64: string;
    fileName: string;
    mimeType: string;
    /** Which form this photo belongs to */
    context: PendingPhotoContext;
    /** addressId for start-list, cardId for control-card (may be empty for new cards) */
    contextId: string;
    /** e.g. "kitchenPhotoUrls", "bathroomPhotoUrls", "roomRatings:roomId" */
    field: string;
    status: 'pending' | 'uploading' | 'uploaded' | 'failed';
    createdAt: string; // ISO
    /** Set after successful upload */
    serverUrl?: string;
};

const DB_NAME = 'smarthouse-offline-photos';
const STORE_NAME = 'pending-photos';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') {
            reject(new Error('IndexedDB is not available in SSR'));
            return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('context', 'context', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

/** Generate a unique pending ID */
export function generatePendingId(): string {
    return `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Check if a URL is a pending (not yet uploaded) photo */
export function isPendingUrl(url: string): boolean {
    return url.startsWith('pending_') || url.startsWith('data:');
}

/**
 * Persist a new photo to IndexedDB immediately after compression.
 * Returns the photo object with the generated ID.
 */
export async function addPendingPhoto(
    photo: Omit<PendingPhoto, 'id' | 'status' | 'createdAt'>
): Promise<PendingPhoto> {
    const record: PendingPhoto = {
        ...photo,
        id: generatePendingId(),
        status: 'pending',
        createdAt: new Date().toISOString(),
    };
    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).add(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        // Non-fatal — photo is still in RAM, just not persisted to disk
        console.warn('[offline-photo-store] addPendingPhoto failed:', err);
    }
    return record;
}

/** Get all photos with status "pending" or "failed" */
export async function getPendingPhotos(): Promise<PendingPhoto[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAll();
            req.onsuccess = () => {
                const all: PendingPhoto[] = req.result || [];
                resolve(all.filter(p => p.status === 'pending' || p.status === 'failed'));
            };
            req.onerror = () => reject(req.error);
        });
    } catch {
        return [];
    }
}

/** Get a single record by its pending ID */
export async function getPhotoById(id: string): Promise<PendingPhoto | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

/** Mark a photo as uploaded and store the server URL */
export async function markPhotoUploaded(id: string, serverUrl: string): Promise<void> {
    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const record: PendingPhoto = getReq.result;
                if (!record) { resolve(); return; }
                const putReq = store.put({ ...record, status: 'uploaded', serverUrl });
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    } catch (err) {
        console.warn('[offline-photo-store] markPhotoUploaded failed:', err);
    }
}

/** Mark a photo as failed (will be retried on next sync) */
export async function markPhotoFailed(id: string): Promise<void> {
    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getReq = store.get(id);
            getReq.onsuccess = () => {
                const record: PendingPhoto = getReq.result;
                if (!record) { resolve(); return; }
                const putReq = store.put({ ...record, status: 'failed' });
                putReq.onsuccess = () => resolve();
                putReq.onerror = () => reject(putReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    } catch (err) {
        console.warn('[offline-photo-store] markPhotoFailed failed:', err);
    }
}

/** Remove a photo from the store (call after successful sync + sheet update) */
export async function removePendingPhoto(id: string): Promise<void> {
    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('[offline-photo-store] removePendingPhoto failed:', err);
    }
}

/** Count pending photos — used for logout warning */
export async function countPendingPhotos(): Promise<number> {
    try {
        const photos = await getPendingPhotos();
        return photos.length;
    } catch {
        return 0;
    }
}

/** Clear ALL pending photos (used only in tests or after logout confirmation) */
export async function clearAllPendingPhotos(): Promise<void> {
    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const req = tx.objectStore(STORE_NAME).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn('[offline-photo-store] clearAllPendingPhotos failed:', err);
    }
}
