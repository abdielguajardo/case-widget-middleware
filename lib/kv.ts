import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface DomainConfig {
  recaptchaSiteKey: string;
  recaptchaSecretKeyEncrypted: string;
  widgetConfig: Record<string, unknown>;
  rateLimitPerDay: number;
  isActive: boolean;
}

export async function getDomainConfig(
  domain: string
): Promise<DomainConfig | null> {
  return redis.get<DomainConfig>(`domain:${domain}`);
}

export async function setDomainConfig(
  domain: string,
  config: DomainConfig
): Promise<void> {
  await redis.set(`domain:${domain}`, config);
}

export async function deleteDomainConfig(domain: string): Promise<void> {
  await redis.del(`domain:${domain}`);
}