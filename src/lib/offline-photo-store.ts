/**
 * Trwały bufor offline dla zdjęć (IndexedDB).
 *
 * Zdjęcia zrobione bez sieci są zapisywane tutaj jako Blob i przeżywają
 * zamknięcie karty, crash przeglądarki i restart telefonu. Synchronizacją
 * zajmuje się hook `useOfflinePhotoSync`.
 *
 * Moduł działa wyłącznie po stronie klienta. Każda funkcja jest odporna na
 * brak IndexedDB (SSR, stare webview) — zwraca bezpieczne wartości zamiast
 * rzucać, żeby awaria bufora nigdy nie zepsuła formularza.
 */

export type PendingPhotoContext = 'control-card' | 'start-list';

export type PendingPhoto = {
    /** "pending_<uuid>" — ten sam string trafia do Sheets jako placeholder URL-a */
    id: string;
    blob: Blob;
    fileName: string;
    mimeType: string;
    context: PendingPhotoContext;
    /** cardId / addressId, albo "unbound:<addressId>:<month>" dopóki karta nie ma ID */
    contextId: string;
    /** np. "kitchenPhotoUrls", "room:<roomId>", "comment:<commentId>" */
    field: string;
    status: 'pending' | 'uploading';
    claimedAt: string | null;
    createdAt: string;
};

/** Rekord w IndexedDB — bajty zamiast Blob (Blob nie jest klonowalny w każdym webview) */
type PendingPhotoRecord = Omit<PendingPhoto, 'blob'> & { bytes: ArrayBuffer };

/** blob.arrayBuffer() z fallbackiem przez FileReader (stare webview / jsdom) */
const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
};

const toRecord = async (photo: PendingPhoto): Promise<PendingPhotoRecord> => {
    const { blob, ...rest } = photo;
    return { ...rest, bytes: await blobToArrayBuffer(blob) };
};

const fromRecord = (rec: PendingPhotoRecord): PendingPhoto => {
    const { bytes, ...rest } = rec;
    return { ...rest, blob: new Blob([bytes], { type: rec.mimeType }) };
};

const DB_NAME = 'smarthouse-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingPhotos';
/** Po tym czasie "uploading" traktujemy jako porzucony claim (crash w trakcie uploadu) */
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_AGE_DAYS = 30;

export const PENDING_PHOTO_PREFIX = 'pending_';
export const UNBOUND_CONTEXT_PREFIX = 'unbound:';

export const isPendingPlaceholder = (url: string): boolean => url.startsWith(PENDING_PHOTO_PREFIX);

export function isOfflinePhotoStoreSupported(): boolean {
    return typeof indexedDB !== 'undefined';
}

let idFallbackCounter = 0;

export function newPendingPhotoId(): string {
    let uuid: string;
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        uuid = crypto.randomUUID();
    } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        uuid = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    } else {
        // Środowiska bez Web Crypto (bardzo stare webview) — unikalność per urządzenie
        // zapewnia timestamp + licznik; ID nie pełni funkcji kryptograficznej
        uuid = `${Date.now()}-${idFallbackCounter++}`;
    }
    return `${PENDING_PHOTO_PREFIX}${uuid}`;
}

export function unboundContextId(addressId: string, month: string): string {
    return `${UNBOUND_CONTEXT_PREFIX}${addressId}:${month}`;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => Promise<T>,
    fallback: T
): Promise<T> {
    if (!isOfflinePhotoStoreSupported()) return fallback;
    try {
        const db = await openDb();
        try {
            const tx = db.transaction(STORE_NAME, mode);
            return await fn(tx.objectStore(STORE_NAME));
        } finally {
            db.close();
        }
    } catch {
        return fallback;
    }
}

export async function addPendingPhoto(
    photo: Omit<PendingPhoto, 'status' | 'claimedAt' | 'createdAt'>
): Promise<boolean> {
    let record: PendingPhotoRecord;
    try {
        record = await toRecord({
            ...photo,
            status: 'pending',
            claimedAt: null,
            createdAt: new Date().toISOString(),
        });
    } catch {
        return false;
    }
    return withStore('readwrite', async (store) => {
        await requestToPromise(store.put(record));
        return true;
    }, false);
}

export async function getPendingPhotos(): Promise<PendingPhoto[]> {
    return withStore('readonly', async (store) => {
        const all = await requestToPromise(store.getAll());
        return ((all as PendingPhotoRecord[]) || []).map(fromRecord);
    }, []);
}

export async function getPhotosForContext(
    context: PendingPhotoContext,
    contextId: string
): Promise<PendingPhoto[]> {
    const all = await getPendingPhotos();
    return all.filter(p => p.context === context && p.contextId === contextId);
}

/**
 * Atomowe przejęcie zdjęcia do uploadu (pending → uploading).
 * Zwraca rekord albo null, gdy ktoś inny właśnie je uploaduje —
 * chroni przed podwójnym uploadem z 3 ścieżek (tło / zapis / hook sync).
 */
export async function claimForUpload(id: string): Promise<PendingPhoto | null> {
    return withStore('readwrite', async (store) => {
        const rec = await requestToPromise(store.get(id)) as PendingPhotoRecord | undefined;
        if (!rec) return null;
        if (rec.status === 'uploading' && rec.claimedAt) {
            const age = Date.now() - new Date(rec.claimedAt).getTime();
            if (age < CLAIM_TIMEOUT_MS) return null;
        }
        const claimed: PendingPhotoRecord = { ...rec, status: 'uploading', claimedAt: new Date().toISOString() };
        await requestToPromise(store.put(claimed));
        return fromRecord(claimed);
    }, null);
}

/** Zwolnienie claimu po nieudanym uploadzie (uploading → pending). */
export async function releaseClaim(id: string): Promise<void> {
    await withStore('readwrite', async (store) => {
        const rec = await requestToPromise(store.get(id)) as PendingPhotoRecord | undefined;
        if (rec) {
            await requestToPromise(store.put({ ...rec, status: 'pending', claimedAt: null }));
        }
        return undefined;
    }, undefined);
}

/** Usunięcie rekordu po udanej synchronizacji. Dotyczy WYŁĄCZNIE lokalnego IndexedDB. */
export async function removePendingPhoto(id: string): Promise<void> {
    await withStore('readwrite', async (store) => {
        await requestToPromise(store.delete(id));
        return undefined;
    }, undefined);
}

/** Po pierwszym zapisie karty wiąże zdjęcia "unbound:..." z realnym ID karty. */
export async function bindContext(
    context: PendingPhotoContext,
    oldContextId: string,
    newContextId: string
): Promise<void> {
    await withStore('readwrite', async (store) => {
        const all = (await requestToPromise(store.getAll()) as PendingPhotoRecord[]) || [];
        for (const rec of all) {
            if (rec.context === context && rec.contextId === oldContextId) {
                await requestToPromise(store.put({ ...rec, contextId: newContextId }));
            }
        }
        return undefined;
    }, undefined);
}

/** TTL: usuwa rekordy starsze niż 30 dni (osierocone zdjęcia z porzuconych formularzy). */
export async function cleanupOldPhotos(maxAgeDays: number = MAX_AGE_DAYS): Promise<number> {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    return withStore('readwrite', async (store) => {
        const all = (await requestToPromise(store.getAll()) as PendingPhotoRecord[]) || [];
        let removed = 0;
        for (const rec of all) {
            if (new Date(rec.createdAt).getTime() < cutoff) {
                await requestToPromise(store.delete(rec.id));
                removed++;
            }
        }
        return removed;
    }, 0);
}

// ─── Konwersje Blob ↔ data URL ───────────────────────────────────────────────

export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export function dataUrlToBlob(dataUrl: string): Blob {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}
