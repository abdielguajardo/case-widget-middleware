interface CounterStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  windowSeconds: number;
}

const RATE_LIMIT_WINDOW_SECONDS = Number(
  process.env.RATE_LIMIT_WINDOW_SECONDS ?? "600"
);
const RATE_LIMIT_MAX_REQUESTS = Number(
  process.env.RATE_LIMIT_MAX_REQUESTS ?? "10"
);

function buildRateLimitKey(domain: string, clientIp: string): string {
  return `ratelimit:${domain}:${clientIp}`;
}

export async function enforceRateLimit(
  store: CounterStore,
  domain: string,
  clientIp: string
): Promise<RateLimitResult> {
  const key = buildRateLimitKey(domain, clientIp);
  const count = await store.incr(key);

  if (count === 1) {
    await store.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }

  return {
    allowed: count <= RATE_LIMIT_MAX_REQUESTS,
    count,
    limit: RATE_LIMIT_MAX_REQUESTS,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  };
}
