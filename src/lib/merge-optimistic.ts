/**
 * Merges fresh server data with current local state, preserving optimistic
 * items that the server hasn't seen yet (read-after-write race).
 * 
 * Also handles race conditions where the UI optimistically sets status: 'dismissed'
 * but a concurrent serverless instance or cached GET request returns status: 'active'.
 */

const deletedEntityIds = new Set<string>();

export function trackDeletedEntityId(id: string | string[]) {
    if (Array.isArray(id)) {
        id.forEach(i => deletedEntityIds.add(i));
    } else {
        deletedEntityIds.add(id);
    }
}

export function mergeWithOptimistic<T extends { id: string }>(current: T[] | null, fresh: T[]): T[] {
    const filteredFresh = fresh.filter(item => !deletedEntityIds.has(item.id));
    if (!current || current.length === 0) return filteredFresh;
    const freshIds = new Set(filteredFresh.map((item) => item.id));
    const optimisticExtras = current.filter((item) => !freshIds.has(item.id));

    const mergedFresh = filteredFresh.map(freshItem => {
        const currentItem = current.find(c => c.id === freshItem.id);
        if (currentItem) {
            // Treat as any to safely check status and checkOutDate fields
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const curr = currentItem as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fr = freshItem as any;
            
            // If the local state is 'dismissed' but the server returned 'active',
            // it's almost certainly a stale cache read (dismissals are permanent).
            if (curr.status === 'dismissed' && fr.status === 'active') {
                return { ...freshItem, status: 'dismissed', checkOutDate: curr.checkOutDate || fr.checkOutDate };
            }
        }
        return freshItem;
    });

    return optimisticExtras.length > 0 ? [...mergedFresh, ...optimisticExtras] : mergedFresh;
}
