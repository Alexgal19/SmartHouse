/**
 * Merges fresh server data with current local state, preserving optimistic
 * items that the server hasn't seen yet (read-after-write race).
 */
export function mergeWithOptimistic<T extends { id: string }>(current: T[] | null, fresh: T[]): T[] {
    if (!current || current.length === 0) return fresh;
    const freshIds = new Set(fresh.map((item) => item.id));
    const optimisticExtras = current.filter((item) => !freshIds.has(item.id));
    return optimisticExtras.length > 0 ? [...fresh, ...optimisticExtras] : fresh;
}
