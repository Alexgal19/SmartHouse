/**
 * In-memory sliding-window rate limiter for Next.js API routes.
 * No external dependencies — uses a simple Map with TTL cleanup.
 *
 * Limits are keyed by:
 *  - endpoint path  (e.g. "/api/odbior/zgloszenie")
 *  - user id or IP   (falls back to IP when no session)
 */

type LimitConfig = {
  windowMs: number;   // time window in milliseconds
  maxRequests: number;
};

const DEFAULT_CONFIG: Record<string, LimitConfig> = {
  // Receiving — creating entries (moderate)
  "/api/odbior/zgloszenie": { windowMs: 60_000, maxRequests: 10 },

  // OCR — expensive, strict
  "/api/odbior/ocr": { windowMs: 60_000, maxRequests: 5 },

  // Passport photo upload
  "/api/odbior/passport-photo": { windowMs: 60_000, maxRequests: 10 },

  // Candidate demand — notifications to many users
  "/api/candidate-demand/run": { windowMs: 60_000, maxRequests: 5 },
  "/api/candidate-demand/ack":  { windowMs: 60_000, maxRequests: 20 },
  "/api/candidate-demand/retry": { windowMs: 60_000, maxRequests: 10 },

  // Alerts — push notifications
  "/api/alerts": { windowMs: 60_000, maxRequests: 10 },
  "/api/alerts/run": { windowMs: 60_000, maxRequests: 5 },

  // Data guard — bulk operations
  "/api/data-guard": { windowMs: 60_000, maxRequests: 10 },
  "/api/data-guard/run": { windowMs: 60_000, maxRequests: 3 },
};

/** Simple sliding-window entry. */
type WindowEntry = {
  requests: number[]; // timestamps of requests
};

const store = new Map<string, WindowEntry>();

/** Build a rate-limit key from endpoint + identifier. */
function makeKey(endpoint: string, identifier: string): string {
  return `rl:${endpoint}:${identifier}`;
}

/**
 * Check if a request is allowed and record it.
 * Returns true if allowed, false if rate-limited.
 */
export function checkRateLimit(
  endpoint: string,
  identifier: string,
  customConfig?: LimitConfig
): { allowed: boolean; retryAfterMs: number; limit: number; remaining: number } {
  const config = customConfig ?? DEFAULT_CONFIG[endpoint];
  if (!config) {
    // No rate limit configured for this endpoint — allow unconditionally.
    return { allowed: true, retryAfterMs: 0, limit: Infinity, remaining: Infinity };
  }

  const key = makeKey(endpoint, identifier);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const entry = store.get(key);
  if (!entry) {
    store.set(key, { requests: [now] });
    return { allowed: true, retryAfterMs: 0, limit: config.maxRequests, remaining: config.maxRequests - 1 };
  }

  // Purge old timestamps outside the window.
  const fresh = entry.requests.filter((t) => t > windowStart);
  entry.requests = fresh;

  if (fresh.length >= config.maxRequests) {
    const oldest = fresh[0];
    const retryAfterMs = oldest + config.windowMs - now;
    return { allowed: false, retryAfterMs, limit: config.maxRequests, remaining: 0 };
  }

  fresh.push(now);
  return { allowed: true, retryAfterMs: 0, limit: config.maxRequests, remaining: config.maxRequests - fresh.length };
}

/**
 * Extract an identifier from a NextRequest.
 * Prefers the Firebase auth UID from a header or cookie,
 * falls back to the forwarded IP or remote address.
 */
export function getIdentifier(req: Request): string {
  // Try to read a user id from a custom header (set by your auth middleware)
  const uid = req.headers.get("x-user-uid");
  if (uid) return `u:${uid}`;

  // Fall back to IP address.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    return `ip:${first}`;
  }

  // If nothing else, use a generic placeholder (not great for production).
  return "ip:unknown";
}
