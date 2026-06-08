/**
 * Tests for the settings refresh race condition guard (Lesson #21).
 *
 * Context: `refreshData` runs every 30 s via setInterval. It fetches settings
 * from Google Sheets and calls `setRawSettings(settings)`. When an admin
 * toggles room/address lock state, `handleUpdateSettings` writes optimistically
 * to local state and then persists to Sheets. Because Sheets persistence is
 * async, a `refreshData` cycle that fires shortly after can fetch stale data
 * and **revert** the optimistic change.
 *
 * Fix: `settingsLastUpdatedRef` tracks when `handleUpdateSettings` last
 * succeeded. `refreshData` skips `setRawSettings` if fewer than
 * SETTINGS_REFRESH_GUARD_MS (15 000 ms) have elapsed since that timestamp.
 */

// ---------------------------------------------------------------------------
// Pure logic extracted from main-layout.tsx for isolated unit-testing
// ---------------------------------------------------------------------------

const SETTINGS_REFRESH_GUARD_MS = 15_000;

/**
 * Returns true when refreshData SHOULD update rawSettings,
 * false when the guard should suppress the update.
 */
function shouldUpdateSettings(
    settingsLastUpdatedAt: number,
    nowMs: number = Date.now(),
): boolean {
    if (settingsLastUpdatedAt === 0) return true; // never updated — always refresh
    const age = nowMs - settingsLastUpdatedAt;
    return age > SETTINGS_REFRESH_GUARD_MS;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shouldUpdateSettings — settings refresh guard', () => {
    const NOW = 1_000_000; // fixed "current time" for deterministic tests

    describe('when settings have never been updated (timestamp === 0)', () => {
        it('allows refresh immediately', () => {
            expect(shouldUpdateSettings(0, NOW)).toBe(true);
        });

        it('allows refresh even if called at time 0', () => {
            expect(shouldUpdateSettings(0, 0)).toBe(true);
        });
    });

    describe('when settings were updated recently (within guard window)', () => {
        it('blocks refresh 1 ms after update', () => {
            const lastUpdated = NOW - 1;
            expect(shouldUpdateSettings(lastUpdated, NOW)).toBe(false);
        });

        it('blocks refresh 5 seconds after update', () => {
            const lastUpdated = NOW - 5_000;
            expect(shouldUpdateSettings(lastUpdated, NOW)).toBe(false);
        });

        it('blocks refresh exactly at the guard boundary', () => {
            const lastUpdated = NOW - SETTINGS_REFRESH_GUARD_MS;
            // age === SETTINGS_REFRESH_GUARD_MS → NOT strictly greater → blocked
            expect(shouldUpdateSettings(lastUpdated, NOW)).toBe(false);
        });

        it('blocks refresh 14 999 ms after update', () => {
            const lastUpdated = NOW - (SETTINGS_REFRESH_GUARD_MS - 1);
            expect(shouldUpdateSettings(lastUpdated, NOW)).toBe(false);
        });
    });

    describe('when settings were updated long ago (outside guard window)', () => {
        it('allows refresh 15 001 ms after update', () => {
            const lastUpdated = NOW - (SETTINGS_REFRESH_GUARD_MS + 1);
            expect(shouldUpdateSettings(lastUpdated, NOW)).toBe(true);
        });

        it('allows refresh 30 seconds after update', () => {
            const lastUpdated = NOW - 30_000;
            expect(shouldUpdateSettings(lastUpdated, NOW)).toBe(true);
        });

        it('allows refresh 5 minutes after update', () => {
            const lastUpdated = NOW - 5 * 60 * 1_000;
            expect(shouldUpdateSettings(lastUpdated, NOW)).toBe(true);
        });
    });

    describe('guard semantics — race condition scenario', () => {
        it('blocks the first background refresh after handleUpdateSettings succeeds', () => {
            // Admin unlocks a room — handleUpdateSettings marks timestamp
            const updateCompletedAt = NOW;

            // refreshData fires 1 second later (within 30-second interval)
            const firstRefreshAt = NOW + 1_000;
            expect(shouldUpdateSettings(updateCompletedAt, firstRefreshAt)).toBe(false);
        });

        it('allows the second background refresh (30 s later, outside guard)', () => {
            const updateCompletedAt = NOW;

            // refreshData fires 30 seconds later
            const secondRefreshAt = NOW + 30_000;
            expect(shouldUpdateSettings(updateCompletedAt, secondRefreshAt)).toBe(true);
        });

        it('allows refresh after two consecutive admin updates, once guard expires', () => {
            // Second update at t+5s (admin quickly changes another room)
            const secondUpdate = NOW + 5_000;

            // Refresh at t+10s — within 15s of SECOND update
            const refreshAt = NOW + 10_000;
            expect(shouldUpdateSettings(secondUpdate, refreshAt)).toBe(false);

            // Refresh at t+25s — outside 15s of second update
            const laterRefresh = NOW + 25_000;
            expect(shouldUpdateSettings(secondUpdate, laterRefresh)).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// Simulation of the full updateSettings + refreshData interaction
// ---------------------------------------------------------------------------

describe('settings race condition simulation', () => {
    it('correctly models the optimistic-update → refresh flow', () => {
        let settingsLastUpdatedAt = 0;
        const rawSettingsUpdates: string[] = [];

        // Simulated setRawSettings collector
        const setRawSettings = (label: string) => {
            rawSettingsUpdates.push(label);
        };

        const NOW = Date.now();

        // Step 1: initial app load — refreshData fires at t=0, no guard needed
        const t0 = NOW;
        if (shouldUpdateSettings(settingsLastUpdatedAt, t0)) {
            setRawSettings('initial-load-settings');
        }

        // Step 2: admin unlocks room at t=500ms
        const t500 = NOW + 500;
        settingsLastUpdatedAt = t500; // handleUpdateSettings succeeded

        // Step 3: background refresh fires at t=1000ms (within 15s guard)
        const t1000 = NOW + 1_000;
        if (shouldUpdateSettings(settingsLastUpdatedAt, t1000)) {
            setRawSettings('stale-settings-from-sheets'); // should NOT appear
        }

        // Step 4: background refresh fires at t=30s (outside guard)
        const t30s = NOW + 30_000;
        if (shouldUpdateSettings(settingsLastUpdatedAt, t30s)) {
            setRawSettings('fresh-settings-from-sheets');
        }

        expect(rawSettingsUpdates).toEqual([
            'initial-load-settings',
            // 'stale-settings-from-sheets' is intentionally absent — guard blocked it
            'fresh-settings-from-sheets',
        ]);
    });

    it('does NOT guard when handleUpdateSettings has not been called yet', () => {
        const settingsLastUpdatedAt = 0;
        const updates: string[] = [];

        const NOW = Date.now();

        // Multiple refreshes before any admin action — all should go through
        for (let i = 0; i < 3; i++) {
            const t = NOW + i * 30_000;
            if (shouldUpdateSettings(settingsLastUpdatedAt, t)) {
                updates.push(`refresh-${i}`);
            }
        }

        expect(updates).toEqual(['refresh-0', 'refresh-1', 'refresh-2']);
    });

    it('ensures guard resets correctly with each new handleUpdateSettings call', () => {
        const updates: string[] = [];
        const NOW = Date.now();

        // Admin updates at t=0
        const settingsLastUpdatedAt = NOW;

        // Refresh at t=1s — blocked
        if (shouldUpdateSettings(settingsLastUpdatedAt, NOW + 1_000)) {
            updates.push('refresh-1s-blocked');
        }

        // Admin updates again at t=20s (guard would have expired, but new update extends it)
        const latestUpdatedAt = NOW + 20_000;

        // Refresh at t=22s — now within 15s of NEW update, should be blocked
        if (shouldUpdateSettings(latestUpdatedAt, NOW + 22_000)) {
            updates.push('refresh-22s-blocked');
        }

        // Refresh at t=40s — outside 15s of second update, should pass
        if (shouldUpdateSettings(latestUpdatedAt, NOW + 40_000)) {
            updates.push('refresh-40s-ok');
        }

        expect(updates).toEqual(['refresh-40s-ok']);
    });
});
