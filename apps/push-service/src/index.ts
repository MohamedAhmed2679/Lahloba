import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const THROTTLE = parseInt(process.env.PUSH_THROTTLE_TTL_SECONDS || '90');
const BURST_N = parseInt(process.env.PUSH_BURST_THRESHOLD || '3');
const DEDUPE = parseInt(process.env.PUSH_DEDUPE_TTL_HOURS || '24') * 3600;
const SUPPRESS = parseInt(process.env.PUSH_SUPPRESS_TTL_SECONDS || '90');

export async function evaluatePush(p: { userId: string; orderId: string; storeId?: string; templateId: string; isCritical?: boolean; isStoreProgress?: boolean }) {
  const dedupeKey = `push:dedupe:order:${p.orderId}:store:${p.storeId || 'none'}:tpl:${p.templateId}`;
  if (await redis.exists(dedupeKey)) return { send: false, reason: 'DEDUPLICATED' };
  if (p.isCritical) { await redis.setex(dedupeKey, DEDUPE, '1'); return { send: true }; }
  if (await redis.exists(`ws:presence:user:${p.userId}`) && await redis.exists(`app:fg:user:${p.userId}`)) return { send: false, reason: 'FOREGROUND' };
  if (p.isStoreProgress) {
    if (await redis.exists(`push:suppress:user:${p.userId}:order:${p.orderId}:sp`)) return { send: false, reason: 'BURST_SUPPRESSED' };
    const rk = `push:rate:user:${p.userId}:order:${p.orderId}:sp`;
    const cnt = await redis.incr(rk); if (cnt === 1) await redis.expire(rk, THROTTLE);
    if (cnt > 1) {
      const bk = `push:burst:user:${p.userId}:order:${p.orderId}:sp`;
      const bc = await redis.incr(bk); if (bc === 1) await redis.expire(bk, THROTTLE);
      if (bc >= BURST_N) { await redis.setex(`push:suppress:user:${p.userId}:order:${p.orderId}:sp`, SUPPRESS, '1'); await redis.setex(dedupeKey, DEDUPE, '1'); return { send: true, summary: true }; }
      return { send: false, reason: 'THROTTLED' };
    }
  }
  await redis.setex(dedupeKey, DEDUPE, '1');
  return { send: true };
}

export async function sendPush(p: { userId: string; title: string; body: string; data?: Record<string, string> }) {
  console.log(`[PUSH] -> ${p.userId}: ${p.title}`);
  // TODO: FCM admin SDK / APNs integration
}

console.log('Push Service ready');
