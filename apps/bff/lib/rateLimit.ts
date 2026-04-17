/**
 * Rate limit in-memory con ventana deslizante simple. Suficiente para
 * deploy en Vercel Edge en una sola región; para multi-región conviene KV.
 */
interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>();

export function checkRateLimit(ip: string, limit = 10, windowMs = 60_000): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(ip, fresh);
    return { ok: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }
  if (b.count >= limit) return { ok: false, remaining: 0, resetAt: b.resetAt };
  b.count += 1;
  return { ok: true, remaining: limit - b.count, resetAt: b.resetAt };
}
