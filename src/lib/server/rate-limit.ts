import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const WINDOW = '1 h';
const LIMIT = Number(process.env.SERVER_HOURLY_LIMIT ?? 10);

function upstashConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

const limiter = upstashConfigured()
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(LIMIT, WINDOW),
      prefix: 'muzeel:bg',
      analytics: false,
    })
  : null;

/**
 * Fallback for local dev and single-instance deploys. Serverless runtimes don't
 * share this map, so it is a speed bump rather than a real limit — configure
 * Upstash in production, where an open endpoint would otherwise drain the
 * fal.ai balance.
 */
const memory = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;

function memoryLimit(key: string) {
  const now = Date.now();
  const hits = (memory.get(key) ?? []).filter((at) => now - at < WINDOW_MS);

  if (hits.length >= LIMIT) {
    memory.set(key, hits);
    return { success: false, remaining: 0 };
  }

  hits.push(now);
  memory.set(key, hits);

  // Opportunistic sweep so the map can't grow without bound.
  if (memory.size > 5_000) {
    for (const [id, times] of memory) {
      if (!times.some((at) => now - at < WINDOW_MS)) memory.delete(id);
    }
  }

  return { success: true, remaining: LIMIT - hits.length };
}

export function clientKey(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

export async function checkRateLimit(key: string) {
  if (!limiter) return memoryLimit(key);

  const { success, remaining } = await limiter.limit(key);
  return { success, remaining };
}

export const hourlyLimit = LIMIT;
