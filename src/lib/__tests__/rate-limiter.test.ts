import { checkRateLimit, getIdentifier } from '../rate-limiter';

// Use unique identifiers per test to avoid shared-store collisions.
const uid = () => `test-${Math.random().toString(36).slice(2)}`;

describe('checkRateLimit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows any request for an unknown endpoint (no config)', () => {
    const result = checkRateLimit('/api/nonexistent', uid());
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
    expect(result.limit).toBe(Infinity);
    expect(result.remaining).toBe(Infinity);
  });

  it('allows first request and returns remaining = maxRequests - 1', () => {
    const id = uid();
    const result = checkRateLimit('/api/odbior/zgloszenie', id);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
    expect(result.limit).toBe(10);
    expect(result.remaining).toBe(9);
  });

  it('remaining decreases with each successive request', () => {
    const id = uid();
    const endpoint = '/api/odbior/zgloszenie'; // maxRequests=10

    for (let i = 9; i >= 1; i--) {
      const result = checkRateLimit(endpoint, id);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(i);
    }
  });

  it('last allowed request has remaining=0', () => {
    const id = uid();
    const endpoint = '/api/odbior/ocr'; // maxRequests=5

    // Make 4 requests first (remaining goes 4,3,2,1)
    for (let i = 0; i < 4; i++) {
      checkRateLimit(endpoint, id);
    }
    // 5th request — exactly at the limit
    const result = checkRateLimit(endpoint, id);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('rejects request when limit is exceeded and returns retryAfterMs > 0', () => {
    const id = uid();
    const endpoint = '/api/odbior/ocr'; // maxRequests=5

    for (let i = 0; i < 5; i++) {
      checkRateLimit(endpoint, id);
    }
    const result = checkRateLimit(endpoint, id);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets requests after the window expires', () => {
    const id = uid();
    const endpoint = '/api/odbior/ocr'; // windowMs=60_000, maxRequests=5

    for (let i = 0; i < 5; i++) {
      checkRateLimit(endpoint, id);
    }
    // Confirm blocked
    expect(checkRateLimit(endpoint, id).allowed).toBe(false);

    // Advance time past the window
    jest.advanceTimersByTime(61_000);

    // Should be allowed again
    const result = checkRateLimit(endpoint, id);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('customConfig overrides default config', () => {
    const id = uid();
    const custom = { windowMs: 60_000, maxRequests: 2 };

    const r1 = checkRateLimit('/api/odbior/zgloszenie', id, custom);
    expect(r1.allowed).toBe(true);
    expect(r1.limit).toBe(2);
    expect(r1.remaining).toBe(1);

    const r2 = checkRateLimit('/api/odbior/zgloszenie', id, custom);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    const r3 = checkRateLimit('/api/odbior/zgloszenie', id, custom);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('customConfig applies to unknown endpoint', () => {
    const id = uid();
    const custom = { windowMs: 60_000, maxRequests: 1 };

    const r1 = checkRateLimit('/api/nonexistent', id, custom);
    expect(r1.allowed).toBe(true);
    expect(r1.limit).toBe(1);

    const r2 = checkRateLimit('/api/nonexistent', id, custom);
    expect(r2.allowed).toBe(false);
  });

  it('different identifiers do not interfere with each other', () => {
    const idA = uid();
    const idB = uid();
    const endpoint = '/api/odbior/ocr'; // maxRequests=5

    // Exhaust idA
    for (let i = 0; i < 5; i++) {
      checkRateLimit(endpoint, idA);
    }
    expect(checkRateLimit(endpoint, idA).allowed).toBe(false);

    // idB should be unaffected
    const result = checkRateLimit(endpoint, idB);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('retryAfterMs reflects time until oldest request leaves the window', () => {
    const id = uid();
    const custom = { windowMs: 30_000, maxRequests: 2 };
    const endpoint = '/api/alerts';

    checkRateLimit(endpoint, id, custom); // t=0
    jest.advanceTimersByTime(5_000);      // t=5s
    checkRateLimit(endpoint, id, custom); // t=5s

    jest.advanceTimersByTime(1_000);      // t=6s — now blocked
    const result = checkRateLimit(endpoint, id, custom);
    expect(result.allowed).toBe(false);
    // Oldest request was at t=0, window=30s → retry = 30_000 - 6_000 = 24_000ms
    expect(result.retryAfterMs).toBeCloseTo(24_000, -2); // within 100ms
  });
});

// Minimal Request stub — jsdom does not expose the Fetch Request global.
function makeRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}

describe('getIdentifier', () => {
  it('returns u:{uid} when x-user-uid header is present', () => {
    const req = makeRequest({ 'x-user-uid': 'abc123' });
    expect(getIdentifier(req)).toBe('u:abc123');
  });

  it('returns ip:{first} when x-forwarded-for is present', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.5' });
    expect(getIdentifier(req)).toBe('ip:203.0.113.5');
  });

  it('returns only the first IP when x-forwarded-for has multiple values', () => {
    const req = makeRequest({ 'x-forwarded-for': '10.0.0.1, 172.16.0.1, 192.168.1.1' });
    expect(getIdentifier(req)).toBe('ip:10.0.0.1');
  });

  it('prefers x-user-uid over x-forwarded-for', () => {
    const req = makeRequest({ 'x-user-uid': 'user42', 'x-forwarded-for': '10.0.0.1' });
    expect(getIdentifier(req)).toBe('u:user42');
  });

  it('returns ip:unknown when no identifying headers are present', () => {
    const req = makeRequest();
    expect(getIdentifier(req)).toBe('ip:unknown');
  });
});
