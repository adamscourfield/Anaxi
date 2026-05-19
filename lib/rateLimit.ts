import { prisma } from "@/lib/prisma";

type Bucket = { count: number; resetAt: number };
type RateLimitResult = { allowed: boolean; retryAfterSec?: number };

const memoryBuckets = new Map<string, Bucket>();

function shouldUseMemoryBackend(): boolean {
  return (
    process.env.RATE_LIMIT_BACKEND === "memory" ||
    process.env.VITEST === "true" ||
    !process.env.DATABASE_URL
  );
}

function checkRateLimitMemory(
  key: string,
  options: { max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = memoryBuckets.get(key);

  if (!existing || now >= existing.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true };
  }

  if (existing.count >= options.max) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { allowed: true };
}

async function checkRateLimitDb(
  key: string,
  options: { max: number; windowMs: number },
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + options.windowMs);

  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });

  if (!bucket || bucket.resetAt <= now) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return { allowed: true };
  }

  if (bucket.count >= options.max) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000),
    };
  }

  const updated = await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  if (updated.count > options.max) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((updated.resetAt.getTime() - now.getTime()) / 1000),
    };
  }

  return { allowed: true };
}

/** Rate limiter with in-memory (dev/test) or Postgres-backed (production) storage. */
export async function checkRateLimit(
  key: string,
  options: { max: number; windowMs: number },
): Promise<RateLimitResult> {
  if (shouldUseMemoryBackend()) {
    return checkRateLimitMemory(key, options);
  }
  try {
    return await checkRateLimitDb(key, options);
  } catch {
    return checkRateLimitMemory(key, options);
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
