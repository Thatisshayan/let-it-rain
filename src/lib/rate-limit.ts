type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Minimal in-memory sliding-window limiter. Fine for a single-instance MVP;
 * swap for a shared store (Redis) if this ever runs multi-instance.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
