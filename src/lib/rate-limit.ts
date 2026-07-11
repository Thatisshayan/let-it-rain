type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * In-memory sliding-window limiter. Fine for a single-instance MVP, but each
 * instance has its own Map — under multi-replica deployment this silently
 * stops enforcing limits consistently. Used as the default and as a fallback
 * if Upstash is unreachable.
 */
function checkRateLimitInMemory(key: string, limit: number, windowMs: number): boolean {
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

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Fixed-window limiter backed by Upstash Redis's REST API (no client SDK
 * needed — just fetch). Safe across multiple instances/regions. Only used
 * when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set.
 */
async function checkRateLimitUpstash(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, String(windowMs), "NX"],
    ]),
  });

  if (!res.ok) throw new Error(`Upstash rate-limit request failed: ${res.status}`);

  const [incrResult] = (await res.json()) as [{ result: number }, { result: number }];
  return incrResult.result <= limit;
}

/**
 * Returns true if the request under `key` is within `limit` per `windowMs`.
 * Uses Upstash Redis when configured (durable, multi-instance safe); falls
 * back to an in-memory counter otherwise, and also on Upstash errors so a
 * Redis outage degrades to best-effort limiting rather than blocking logins.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await checkRateLimitUpstash(key, limit, windowMs);
    } catch {
      return checkRateLimitInMemory(key, limit, windowMs);
    }
  }
  return checkRateLimitInMemory(key, limit, windowMs);
}
