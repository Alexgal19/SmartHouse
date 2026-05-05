# Stability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent cache stampede, add redundancy, and add a health endpoint for monitoring — without changing any business logic.

**Architecture:** Add a `singleflight` utility that deduplicates concurrent Sheets API calls on cache miss; wrap all 9 read functions in `sheets.ts`; add `pingSheets` export; create `/api/health` route; bump `appInstances` to 2 in `apphosting.yaml`.

**Tech Stack:** TypeScript, Next.js 14 App Router, Jest (jsdom), `google-spreadsheet`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/singleflight.ts` | **Create** | Deduplicates concurrent in-flight Promises by key |
| `src/lib/__tests__/singleflight.test.ts` | **Create** | Unit tests for singleflight |
| `src/lib/sheets.ts` | **Modify** | Import singleflight; wrap 9 read functions; add `pingSheets` export |
| `src/app/api/health/route.ts` | **Create** | Health check endpoint (`GET /api/health`) |
| `src/lib/__tests__/health.test.ts` | **Create** | Unit tests for health route |
| `apphosting.yaml` | **Modify** | `maxInstances: 1 → 2`, add `minInstances: 1` |

---

## Task 1: Create `singleflight` utility

**Files:**
- Create: `src/lib/singleflight.ts`
- Create: `src/lib/__tests__/singleflight.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/singleflight.test.ts`:

```typescript
import { singleflight } from '../singleflight';

describe('singleflight', () => {
  it('calls fn exactly once for concurrent requests', async () => {
    const fn = jest.fn(async () => {
      await new Promise(r => setTimeout(r, 30));
      return 'result';
    });

    const results = await Promise.all([
      singleflight('key1', fn),
      singleflight('key1', fn),
      singleflight('key1', fn),
    ]);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['result', 'result', 'result']);
  });

  it('allows a new call after the previous one completes', async () => {
    const fn = jest.fn(async () => 'result');

    await singleflight('key2', fn);
    await singleflight('key2', fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propagates errors to all concurrent callers', async () => {
    const fn = jest.fn(async () => {
      throw new Error('Sheets error');
    });

    const results = await Promise.allSettled([
      singleflight('key3', fn),
      singleflight('key3', fn),
    ]);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect((results[0] as PromiseRejectedResult).reason.message).toBe('Sheets error');
  });

  it('handles different keys independently', async () => {
    const fnA = jest.fn(async () => 'a');
    const fnB = jest.fn(async () => 'b');

    const [a, b] = await Promise.all([
      singleflight('keyA', fnA),
      singleflight('keyB', fnB),
    ]);

    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
    expect(a).toBe('a');
    expect(b).toBe('b');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest src/lib/__tests__/singleflight.test.ts --no-coverage
```

Expected: `Cannot find module '../singleflight'`

- [ ] **Step 3: Create `src/lib/singleflight.ts`**

```typescript
const inFlight = new Map<string, Promise<unknown>>();

export function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) return inFlight.get(key) as Promise<T>;
  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest src/lib/__tests__/singleflight.test.ts --no-coverage
```

Expected: `4 tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/singleflight.ts src/lib/__tests__/singleflight.test.ts
git commit -m "feat(perf): add singleflight utility to deduplicate concurrent Sheets reads"
```

---

## Task 2: Apply singleflight to all read functions in `sheets.ts`

**Files:**
- Modify: `src/lib/sheets.ts` (import + wrap 9 functions)

- [ ] **Step 1: Add import at top of `sheets.ts`**

At the top of `src/lib/sheets.ts`, after the existing imports, add:

```typescript
import { singleflight } from './singleflight';
```

- [ ] **Step 2: Wrap `getEmployees` (line ~624)**

Replace:
```typescript
export async function getEmployees(): Promise<Employee[]> {
    if (employeesCache && (Date.now() - employeesCache.timestamp < DATA_CACHE_TTL)) {
        return employeesCache.data;
    }
    const doc = await getDoc();
    const rows = await getSheetData(doc, SHEET_NAME_EMPLOYEES);
    const data = rows.map(row => deserializeEmployee(row)).filter((e): e is Employee => e !== null);
    employeesCache = { data, timestamp: Date.now() };
    return data;
}
```

With:
```typescript
export async function getEmployees(): Promise<Employee[]> {
    if (employeesCache && (Date.now() - employeesCache.timestamp < DATA_CACHE_TTL)) {
        return employeesCache.data;
    }
    return singleflight('employees', async () => {
        const doc = await getDoc();
        const rows = await getSheetData(doc, SHEET_NAME_EMPLOYEES);
        const data = rows.map(row => deserializeEmployee(row)).filter((e): e is Employee => e !== null);
        employeesCache = { data, timestamp: Date.now() };
        return data;
    });
}
```

- [ ] **Step 3: Wrap `getNonEmployees` (line ~635)**

Replace:
```typescript
export async function getNonEmployees(): Promise<NonEmployee[]> {
    if (nonEmployeesCache && (Date.now() - nonEmployeesCache.timestamp < DATA_CACHE_TTL)) {
        return nonEmployeesCache.data;
    }
    const doc = await getDoc();
    const rows = await getSheetData(doc, SHEET_NAME_NON_EMPLOYEES);
    const data = rows.map(row => deserializeNonEmployee(row)).filter((e): e is NonEmployee => e !== null);
    nonEmployeesCache = { data, timestamp: Date.now() };
    return data;
}
```

With:
```typescript
export async function getNonEmployees(): Promise<NonEmployee[]> {
    if (nonEmployeesCache && (Date.now() - nonEmployeesCache.timestamp < DATA_CACHE_TTL)) {
        return nonEmployeesCache.data;
    }
    return singleflight('nonEmployees', async () => {
        const doc = await getDoc();
        const rows = await getSheetData(doc, SHEET_NAME_NON_EMPLOYEES);
        const data = rows.map(row => deserializeNonEmployee(row)).filter((e): e is NonEmployee => e !== null);
        nonEmployeesCache = { data, timestamp: Date.now() };
        return data;
    });
}
```

- [ ] **Step 4: Wrap `getBokResidents` (line ~646)**

Replace:
```typescript
export async function getBokResidents(): Promise<BokResident[]> {
    if (bokResidentsCache && (Date.now() - bokResidentsCache.timestamp < DATA_CACHE_TTL)) {
        return bokResidentsCache.data;
    }
    const doc = await getDoc();
    const rows = await getSheetData(doc, SHEET_NAME_BOK_RESIDENTS);
    const data = rows.map(row => deserializeBokResident(row)).filter((e): e is BokResident => e !== null);
    bokResidentsCache = { data, timestamp: Date.now() };
    return data;
}
```

With:
```typescript
export async function getBokResidents(): Promise<BokResident[]> {
    if (bokResidentsCache && (Date.now() - bokResidentsCache.timestamp < DATA_CACHE_TTL)) {
        return bokResidentsCache.data;
    }
    return singleflight('bokResidents', async () => {
        const doc = await getDoc();
        const rows = await getSheetData(doc, SHEET_NAME_BOK_RESIDENTS);
        const data = rows.map(row => deserializeBokResident(row)).filter((e): e is BokResident => e !== null);
        bokResidentsCache = { data, timestamp: Date.now() };
        return data;
    });
}
```

- [ ] **Step 5: Wrap `getRawAddressHistory` (line ~662)**

Replace:
```typescript
export async function getRawAddressHistory(): Promise<AddressHistory[]> {
    if (addressHistoryCache && (Date.now() - addressHistoryCache.timestamp < DATA_CACHE_TTL)) {
        return addressHistoryCache.data;
    }
    const doc = await getDoc();
    const rows = await getSheetData(doc, SHEET_NAME_ADDRESS_HISTORY);
    const data = rows.map(row => deserializeAddressHistory(row)).filter((h): h is AddressHistory => h !== null);
    addressHistoryCache = { data, timestamp: Date.now() };
    return data;
}
```

With:
```typescript
export async function getRawAddressHistory(): Promise<AddressHistory[]> {
    if (addressHistoryCache && (Date.now() - addressHistoryCache.timestamp < DATA_CACHE_TTL)) {
        return addressHistoryCache.data;
    }
    return singleflight('addressHistory', async () => {
        const doc = await getDoc();
        const rows = await getSheetData(doc, SHEET_NAME_ADDRESS_HISTORY);
        const data = rows.map(row => deserializeAddressHistory(row)).filter((h): h is AddressHistory => h !== null);
        addressHistoryCache = { data, timestamp: Date.now() };
        return data;
    });
}
```

- [ ] **Step 6: Wrap `getSettings` (line ~619)**

Replace:
```typescript
export async function getSettings(bypassCache = false): Promise<Settings> {
    const doc = await getDoc();
    return await getSettingsFromSheet(doc, bypassCache);
}
```

With:
```typescript
export async function getSettings(bypassCache = false): Promise<Settings> {
    if (bypassCache) {
        const doc = await getDoc();
        return getSettingsFromSheet(doc, true);
    }
    return singleflight('settings', async () => {
        const doc = await getDoc();
        return getSettingsFromSheet(doc, false);
    });
}
```

- [ ] **Step 7: Wrap `getControlCards` (line ~825)**

Replace:
```typescript
export async function getControlCards(): Promise<ControlCard[]> {
    if (controlCardsCache && (Date.now() - controlCardsCache.timestamp < DATA_CACHE_TTL)) {
        return controlCardsCache.data;
    }
    const doc = await getDoc();
    const sheet = doc.sheetsByTitle[SHEET_NAME_CONTROL_CARDS];
    if (!sheet) return [];
    const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(ControlCards)');
    const data = rows
        .map(row => deserializeControlCard(row))
        .filter((c): c is ControlCard => c !== null && !c.deleted);
    controlCardsCache = { data, timestamp: Date.now() };
    return data;
}
```

With:
```typescript
export async function getControlCards(): Promise<ControlCard[]> {
    if (controlCardsCache && (Date.now() - controlCardsCache.timestamp < DATA_CACHE_TTL)) {
        return controlCardsCache.data;
    }
    return singleflight('controlCards', async () => {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle[SHEET_NAME_CONTROL_CARDS];
        if (!sheet) return [];
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(ControlCards)');
        const data = rows
            .map(row => deserializeControlCard(row))
            .filter((c): c is ControlCard => c !== null && !c.deleted);
        controlCardsCache = { data, timestamp: Date.now() };
        return data;
    });
}
```

- [ ] **Step 8: Wrap `getStartLists` (line ~948)**

Replace:
```typescript
export async function getStartLists(): Promise<StartList[]> {
    if (startListsCache && (Date.now() - startListsCache.timestamp < DATA_CACHE_TTL)) {
        return startListsCache.data;
    }
    const doc = await getDoc();
    const sheet = doc.sheetsByTitle[SHEET_NAME_START_LISTS];
    if (!sheet) {
        startListsCache = { data: [], timestamp: Date.now() };
        return [];
    }
    const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(StartLists)');
    const data = rows.map(row => deserializeStartList(row)).filter((s): s is StartList => s !== null);
    startListsCache = { data, timestamp: Date.now() };
    return data;
}
```

With:
```typescript
export async function getStartLists(): Promise<StartList[]> {
    if (startListsCache && (Date.now() - startListsCache.timestamp < DATA_CACHE_TTL)) {
        return startListsCache.data;
    }
    return singleflight('startLists', async () => {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle[SHEET_NAME_START_LISTS];
        if (!sheet) {
            startListsCache = { data: [], timestamp: Date.now() };
            return [];
        }
        const rows = await withTimeout(sheet.getRows(), TIMEOUT_MS, 'sheet.getRows(StartLists)');
        const data = rows.map(row => deserializeStartList(row)).filter((s): s is StartList => s !== null);
        startListsCache = { data, timestamp: Date.now() };
        return data;
    });
}
```

- [ ] **Step 9: Wrap `getOdbiorEntries` (line ~1036)**

Replace:
```typescript
export async function getOdbiorEntries(): Promise<OdbiorEntry[]> {
    if (odbiorEntriesCache && (Date.now() - odbiorEntriesCache.timestamp < DATA_CACHE_TTL)) {
        return odbiorEntriesCache.data;
    }
    const doc = await getDoc();
    const rows = await getSheetData(doc, SHEET_NAME_ODBIOR_ENTRIES);
    const data = rows.map(row => deserializeOdbiorEntry(row)).filter((e): e is OdbiorEntry => e !== null);
    odbiorEntriesCache = { data, timestamp: Date.now() };
    return data;
}
```

With:
```typescript
export async function getOdbiorEntries(): Promise<OdbiorEntry[]> {
    if (odbiorEntriesCache && (Date.now() - odbiorEntriesCache.timestamp < DATA_CACHE_TTL)) {
        return odbiorEntriesCache.data;
    }
    return singleflight('odbiorEntries', async () => {
        const doc = await getDoc();
        const rows = await getSheetData(doc, SHEET_NAME_ODBIOR_ENTRIES);
        const data = rows.map(row => deserializeOdbiorEntry(row)).filter((e): e is OdbiorEntry => e !== null);
        odbiorEntriesCache = { data, timestamp: Date.now() };
        return data;
    });
}
```

- [ ] **Step 10: Wrap `getOdbiorZgloszenia` (line ~1136)**

Replace:
```typescript
export async function getOdbiorZgloszenia(): Promise<OdbiorZgloszenie[]> {
    if (odbiorCache) return odbiorCache;
    const doc = await getDoc();
    const rows = await getSheetData(doc, SHEET_NAME_ODBIOR);
    odbiorCache = rows.map(row => ({
        id: row['id'] ?? '',
        dataZgloszenia: row['dataZgloszenia'] ?? '',
        numerTelefonu: row['numerTelefonu'] ?? '',
        skad: (row['skad'] ?? 'inne') as OdbiorZgloszenie['skad'],
        komentarzSkad: row['komentarzSkad'] ?? '',
        iloscOsob: parseInt(row['iloscOsob'] ?? '0', 10),
        komentarz: row['komentarz'] ?? '',
        zdjeciaUrls: row['zdjeciaUrls'] ?? '',
        rekruterId: row['rekruterId'] ?? '',
        rekruterNazwa: row['rekruterNazwa'] ?? '',
        status: (row['status'] ?? 'Nieprzyjęte') as OdbiorZgloszenie['status'],
        kierowcaId: row['kierowcaId'] ?? '',
        kierowcaNazwa: row['kierowcaNazwa'] ?? '',
        osoby: row['osoby'] ?? '[]',
        nastepnyKrok: row['nastepnyKrok'] ?? '',
        dataZakonczenia: row['dataZakonczenia'] ?? '',
    }));
    return odbiorCache;
}
```

With:
```typescript
export async function getOdbiorZgloszenia(): Promise<OdbiorZgloszenie[]> {
    if (odbiorCache) return odbiorCache;
    return singleflight('odbiorZgloszenia', async () => {
        const doc = await getDoc();
        const rows = await getSheetData(doc, SHEET_NAME_ODBIOR);
        odbiorCache = rows.map(row => ({
            id: row['id'] ?? '',
            dataZgloszenia: row['dataZgloszenia'] ?? '',
            numerTelefonu: row['numerTelefonu'] ?? '',
            skad: (row['skad'] ?? 'inne') as OdbiorZgloszenie['skad'],
            komentarzSkad: row['komentarzSkad'] ?? '',
            iloscOsob: parseInt(row['iloscOsob'] ?? '0', 10),
            komentarz: row['komentarz'] ?? '',
            zdjeciaUrls: row['zdjeciaUrls'] ?? '',
            rekruterId: row['rekruterId'] ?? '',
            rekruterNazwa: row['rekruterNazwa'] ?? '',
            status: (row['status'] ?? 'Nieprzyjęte') as OdbiorZgloszenie['status'],
            kierowcaId: row['kierowcaId'] ?? '',
            kierowcaNazwa: row['kierowcaNazwa'] ?? '',
            osoby: row['osoby'] ?? '[]',
            nastepnyKrok: row['nastepnyKrok'] ?? '',
            dataZakonczenia: row['dataZakonczenia'] ?? '',
        }));
        return odbiorCache!;
    });
}
```

- [ ] **Step 11: Run existing tests — expect all PASS**

```bash
npx jest --no-coverage
```

Expected: all existing tests pass (singleflight changes are additive — no logic changed).

- [ ] **Step 12: Commit**

```bash
git add src/lib/sheets.ts
git commit -m "feat(perf): apply singleflight to all Sheets read functions"
```

---

## Task 3: Add `pingSheets` export + health endpoint

**Files:**
- Modify: `src/lib/sheets.ts` (add `pingSheets`)
- Create: `src/app/api/health/route.ts`
- Create: `src/lib/__tests__/health.test.ts`

- [ ] **Step 1: Add `pingSheets` to `sheets.ts`**

At the end of `src/lib/sheets.ts`, append:

```typescript
export async function pingSheets(): Promise<void> {
    await withTimeout(getDoc(), 5000, 'pingSheets');
}
```

- [ ] **Step 2: Write the failing health endpoint test**

Create `src/lib/__tests__/health.test.ts`:

```typescript
import { GET } from '@/app/api/health/route';

jest.mock('@/lib/sheets', () => ({
    pingSheets: jest.fn(),
}));

const { pingSheets } = require('@/lib/sheets') as { pingSheets: jest.Mock };

describe('GET /api/health', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 200 with status ok when Sheets is reachable', async () => {
        pingSheets.mockResolvedValueOnce(undefined);

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.status).toBe('ok');
        expect(json.sheets.status).toBe('ok');
        expect(typeof json.sheets.latencyMs).toBe('number');
        expect(typeof json.timestamp).toBe('string');
    });

    it('returns 503 with status degraded when Sheets throws', async () => {
        pingSheets.mockRejectedValueOnce(new Error('pingSheets timed out after 5000ms'));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(503);
        expect(json.status).toBe('degraded');
        expect(json.sheets.status).toBe('error');
        expect(json.sheets.error).toBe('pingSheets timed out after 5000ms');
    });
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npx jest src/lib/__tests__/health.test.ts --no-coverage
```

Expected: `Cannot find module '@/app/api/health/route'`

- [ ] **Step 4: Create `src/app/api/health/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { pingSheets } from '@/lib/sheets';

export async function GET() {
    const timestamp = new Date().toISOString();
    const start = Date.now();
    try {
        await pingSheets();
        return NextResponse.json({
            status: 'ok',
            timestamp,
            sheets: { status: 'ok', latencyMs: Date.now() - start },
        });
    } catch (error) {
        return NextResponse.json(
            {
                status: 'degraded',
                timestamp,
                sheets: {
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 503 }
        );
    }
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npx jest src/lib/__tests__/health.test.ts --no-coverage
```

Expected: `2 tests passed`

- [ ] **Step 6: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/sheets.ts src/app/api/health/route.ts src/lib/__tests__/health.test.ts
git commit -m "feat(ops): add pingSheets and /api/health endpoint for uptime monitoring"
```

---

## Task 4: Update `apphosting.yaml`

**Files:**
- Modify: `apphosting.yaml`

- [ ] **Step 1: Update `apphosting.yaml`**

Replace:
```yaml
runConfig:
  # Increase this value if you'd like to automatically spin up
  # more instances in response to increased traffic.
  maxInstances: 1
```

With:
```yaml
runConfig:
  minInstances: 1
  maxInstances: 2
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add apphosting.yaml
git commit -m "feat(infra): bump to minInstances=1 maxInstances=2 for rolling deploy resilience"
```

---

## Self-Review Checklist (completed)

- **Spec coverage:** singleflight ✅ | sheets.ts wrapping (9 functions) ✅ | maxInstances ✅ | health endpoint ✅
- **Placeholders:** none found
- **Type consistency:** `singleflight<T>` returns `Promise<T>` throughout; `pingSheets(): Promise<void>` matches health route usage; response shapes match spec
- **getNonEmployees and getRawAddressHistory** added (not in original spec count of 7 but both have caches — included for completeness)
