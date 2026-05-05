# Stability Hardening — Design Spec

**Date:** 2026-05-05
**Context:** SmartHouse — Next.js 14 / Firebase App Hosting / Google Sheets
**Scope:** Preventive hardening for 5-10 concurrent coordinators
**Approach chosen:** A — Lightweight hardening (no new infrastructure)

---

## Problem Statement

The application uses Google Sheets as its primary data store. Under concurrent load, three risks exist:

1. **Cache stampede** — when the 60s TTL expires, multiple simultaneous requests each trigger a separate Sheets API call instead of sharing one result.
2. **Single point of failure** — `maxInstances: 1` means deployments and restarts cause ~10-30s downtime.
3. **No observability** — there is no way to detect Sheets latency issues before users report them.

At 5-10 concurrent coordinators these risks are manageable but real. This spec addresses all three with minimal changes to the existing codebase.

---

## Architecture

### Current

```
User → Next.js API Route → sheets.ts (in-memory cache TTL 60s) → Google Sheets API
```

### After

```
User → Next.js API Route → sheets.ts (in-memory cache + singleflight) → Google Sheets API
                ↕ (2 independent instances, each with own cache)
/api/health → checks Sheets latency → returns status JSON
```

All business logic, cache TTL values, and data models remain unchanged.

---

## Changes

### 1. Singleflight Pattern — `src/lib/singleflight.ts` (new file)

A minimal in-process deduplication utility. When the cache is empty and multiple concurrent requests arrive for the same key, only one fetch is initiated; all others await the same Promise.

```typescript
const inFlight = new Map<string, Promise<unknown>>();

export function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) return inFlight.get(key) as Promise<T>;
  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
```

**Applied to these read functions in `src/lib/sheets.ts`:**
- `getEmployees` → key: `'employees'`
- `getBokResidents` → key: `'bokResidents'`
- `getControlCards` → key: `'controlCards'`
- `getStartLists` → key: `'startLists'`
- `getOdbiorEntries` → key: `'odbiorEntries'`
- `getOdbiorZgloszenia` → key: `'odbiorZgloszenia'`
- `getSettings` → key: `'settings'`

Write functions (add/update) are not wrapped — they must always execute independently.

**Pattern for each function:**
```typescript
// Before:
export async function getEmployees(): Promise<Employee[]> {
  if (employeesCache && (Date.now() - employeesCache.timestamp < DATA_CACHE_TTL)) {
    return employeesCache.data;
  }
  // ... fetch logic
}

// After:
export async function getEmployees(): Promise<Employee[]> {
  if (employeesCache && (Date.now() - employeesCache.timestamp < DATA_CACHE_TTL)) {
    return employeesCache.data;
  }
  return singleflight('employees', async () => {
    // ... fetch logic (unchanged)
  });
}
```

Cache check stays outside singleflight so hot-path reads (cache hit) return immediately without entering the Map.

### 2. maxInstances — `apphosting.yaml`

```yaml
# Before:
runConfig:
  maxInstances: 1

# After:
runConfig:
  minInstances: 1
  maxInstances: 2
```

- `minInstances: 1` keeps one warm instance always running (eliminates cold starts).
- `maxInstances: 2` allows Firebase to spin up a second instance during rolling deployments or traffic spikes.
- Two instances have separate in-memory caches. Worst case: 2 parallel Sheets requests on cache miss (one per instance), both protected by singleflight internally. Well within Google Sheets API quota (500 req/100s).

### 3. Health Endpoint — `src/app/api/health/route.ts` (new file)

No auth required — monitoring must work without a session.

**Response shape (200 — healthy):**
```json
{
  "status": "ok",
  "timestamp": "2026-05-05T08:51:00.000Z",
  "sheets": { "status": "ok", "latencyMs": 312 }
}
```

**Response shape (503 — degraded):**
```json
{
  "status": "degraded",
  "timestamp": "2026-05-05T08:51:00.000Z",
  "sheets": { "status": "error", "error": "Operation timed out after 5000ms" }
}
```

Implementation: calls `getDoc()` with a 5s timeout (shorter than the global 15s). Returns no business data. Can be polled by UptimeRobot or any HTTP monitor.

---

## Files Changed / Created

| File | Action | Notes |
|------|--------|-------|
| `src/lib/singleflight.ts` | Create | ~20 lines |
| `src/lib/sheets.ts` | Modify | Wrap 7 read functions with singleflight |
| `apphosting.yaml` | Modify | 1 line change + add minInstances |
| `src/app/api/health/route.ts` | Create | ~30 lines |

---

## What This Does NOT Change

- Cache TTL values (60s data, 5min doc, no-TTL for odbiorZgloszenia)
- Google Sheets as primary data store
- Authentication and session logic
- Business logic in actions.ts
- Any existing API routes

---

## Error Handling

- Singleflight: if the in-flight request throws, the error propagates to all waiting callers. This is correct — all callers should see the error rather than hanging indefinitely.
- Health endpoint: catches all errors from `getDoc()` and returns 503 with the error message. Never throws to the caller.

---

## Testing

- **Singleflight unit test** — call `singleflight('x', fn)` 5 times concurrently; assert `fn` was called exactly once.
- **Health endpoint** — GET `/api/health` returns 200 with `status: "ok"` when Sheets is reachable.
- **Manual smoke test** — deploy, open app with 2 browser tabs, verify normal operation.

---

## Out of Scope

- Redis / shared cache (Approach B — not needed at this scale)
- Request queue / rate limiter for outbound Sheets calls
- Metrics dashboard / Firestore logging
- Write operation optimization (read-all-rows-then-update pattern)
