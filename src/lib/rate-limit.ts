// Tiny in-memory sliding-window limiter. No Redis (forbidden in the MVP) — this
// is best-effort per serverless instance, which is enough to stop a single
// client hammering /api/request and spraying pings at every pharmacy (the
// "ping fatigue" anti-signal the playbook warns kills the model).

interface Window {
  hits: number[]; // timestamps (ms)
}

const buckets = new Map<string, Window>();

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key       caller identity (IP, session…)
 * @param limit     max requests within the window
 * @param windowMs  window length in ms
 */
export function rateLimit(key: string, limit = 5, windowMs = 5 * 60_000): RateResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const w = buckets.get(key) ?? { hits: [] };

  // Drop expired hits.
  w.hits = w.hits.filter((t) => t > cutoff);

  if (w.hits.length >= limit) {
    buckets.set(key, w);
    const retryAfterSec = Math.ceil((w.hits[0] + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  w.hits.push(now);
  buckets.set(key, w);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.hits.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }

  return { allowed: true, remaining: limit - w.hits.length, retryAfterSec: 0 };
}

/** Best-effort client IP from common proxy headers. */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
