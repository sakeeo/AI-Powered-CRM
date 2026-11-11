import { redis } from "@/lib/redis";

/**
 * Rate limit jendela tetap berbasis Redis (INCR atomik; TTL dipasang saat counter dibuat).
 * Gagal-terbuka bila Redis tidak tersedia agar endpoint tidak mati total.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const k = `rl:${key}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, windowSeconds);
    return { allowed: n <= limit, remaining: Math.max(0, limit - n) };
  } catch {
    return { allowed: true, remaining: limit };
  }
}
