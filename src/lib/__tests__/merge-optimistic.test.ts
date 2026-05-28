import { mergeWithOptimistic } from '../merge-optimistic';

describe('mergeWithOptimistic', () => {
    it('returns fresh array when current is null', () => {
        const fresh = [{ id: 'a' }, { id: 'b' }];
        expect(mergeWithOptimistic(null, fresh)).toEqual(fresh);
    });

    it('returns fresh array when current is empty', () => {
        const fresh = [{ id: 'a' }];
        expect(mergeWithOptimistic([], fresh)).toEqual(fresh);
    });

    it('preserves optimistic items not yet in fresh data', () => {
        const current = [
            { id: 'a', name: 'Alice' },
            { id: 'optimistic-1', name: 'Bob' },
        ];
        const fresh = [{ id: 'a', name: 'Alice Updated' }];
        const result = mergeWithOptimistic(current, fresh);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ id: 'a', name: 'Alice Updated' });
        expect(result[1]).toEqual({ id: 'optimistic-1', name: 'Bob' });
    });

    it('updates existing items with fresh data and keeps extras', () => {
        const current = [
            { id: 'a', name: 'Alice', age: 30 },
            { id: 'b', name: 'Bob', age: 25 },
            { id: 'c', name: 'Charlie', age: 35 },
        ];
        const fresh = [
            { id: 'a', name: 'Alice Updated', age: 31 },
            { id: 'c', name: 'Charlie', age: 35 },
        ];
        const result = mergeWithOptimistic(current, fresh);
        expect(result).toHaveLength(3);
        expect(result).toEqual([
            { id: 'a', name: 'Alice Updated', age: 31 },
            { id: 'c', name: 'Charlie', age: 35 },
            { id: 'b', name: 'Bob', age: 25 },
        ]);
    });

    it('returns fresh only when all IDs match', () => {
        const current = [{ id: 'a' }, { id: 'b' }];
        const fresh = [{ id: 'a' }, { id: 'b' }];
        expect(mergeWithOptimistic(current, fresh)).toEqual(fresh);
    });

    it('preserves multiple optimistic extras', () => {
        const current = [
            { id: 'x' },
            { id: 'optimistic-1' },
            { id: 'optimistic-2' },
        ];
        const fresh = [{ id: 'x' }];
        const result = mergeWithOptimistic(current, fresh);
        expect(result).toHaveLength(3);
        expect(result).toEqual([
            { id: 'x' },
            { id: 'optimistic-1' },
            { id: 'optimistic-2' },
        ]);
    });

    it('handles objects with complex types correctly', () => {
        interface Person { id: string; name: string; active: boolean }
        const current: Person[] = [
            { id: '1', name: 'One', active: true },
            { id: '2', name: 'Two', active: false },
        ];
        const fresh: Person[] = [{ id: '1', name: 'OneUpdated', active: true }];
        const result = mergeWithOptimistic(current, fresh);
        expect(result).toEqual([
            { id: '1', name: 'OneUpdated', active: true },
            { id: '2', name: 'Two', active: false },
        ]);
    });

    it('preserves dismissed status when server returns active (stale cache race condition)', () => {
        interface Employee { id: string; name: string; status: string; checkOutDate?: string }
        const current: Employee[] = [
            { id: '1', name: 'Alice', status: 'dismissed', checkOutDate: '2023-10-01' },
            { id: '2', name: 'Bob', status: 'active' }
        ];
        // Server returns Alice as active (e.g. stale cache read)
        const fresh: Employee[] = [
            { id: '1', name: 'Alice', status: 'active', checkOutDate: '' },
            { id: '2', name: 'Bob', status: 'active' }
        ];
        
        const result = mergeWithOptimistic(current, fresh);
        expect(result).toEqual([
            { id: '1', name: 'Alice', status: 'dismissed', checkOutDate: '2023-10-01' }, // preserved!
            { id: '2', name: 'Bob', status: 'active' }
        ]);
    });

    it('updates dismissed status from server if local is active (regular dismissal)', () => {
        interface Employee { id: string; name: string; status: string; checkOutDate?: string }
        const current: Employee[] = [
            { id: '1', name: 'Alice', status: 'active' }
        ];
        const fresh: Employee[] = [
            { id: '1', name: 'Alice', status: 'dismissed', checkOutDate: '2023-10-01' }
        ];
        
        const result = mergeWithOptimistic(current, fresh);
        expect(result).toEqual([
            { id: '1', name: 'Alice', status: 'dismissed', checkOutDate: '2023-10-01' } // server wins
        ]);
    });
});
