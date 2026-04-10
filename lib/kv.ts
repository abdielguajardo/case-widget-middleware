import { Redis } from "@upstash/redis";
import { CaseWidgetConfig } from "./case-widget";
import { enforceRateLimit } from "./rate-limit";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getDomainConfig(
  domain: string
): Promise<CaseWidgetConfig | null> {
  return redis.get<CaseWidgetConfig>(`domain:${domain}`);
}

export async function setDomainConfig(
  domain: string,
  config: CaseWidgetConfig
): Promise<void> {
  await redis.set(`domain:${domain}`, config);
}

export async function deleteDomainConfig(domain: string): Promise<void> {
  await redis.del(`domain:${domain}`);
}

export async function rateLimitSubmit(domain: string, clientIp: string) {
  return enforceRateLimit(redis, domain, clientIp);
}
